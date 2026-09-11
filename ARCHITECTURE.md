# Geoclick — Architecture

Geoclick is a geography learning game: users are guided through the landmarks
of a map ("tour" mode), then quizzed on them with a spaced-repetition
workflow (Anki/Clozemaster-style). Portfolio project, not commercial.
First milestone is a local desktop POC.

## Strategy: one shared web core, three shells

Maintaining three separate native codebases isn't worth it for a solo
project. Instead: a single web app is the source of truth, packaged three
ways.

- **Browser** — runs directly.
- **Desktop** — wrapped in **Tauri** (Rust shell around the system webview —
  small binaries, fast startup, real local SQLite for free).
- **Mobile** — wrapped in **Capacitor** (same web core in a native webview,
  plugin access to device SQLite/filesystem).

This beats Electron (bloated) and a separate React Native map stack (doubles
map-styling/interaction work for no real gain in a quiz app that isn't
scroll/perf-critical). The map viewer, tour player, and quiz engine are
written once.

**Framework: Svelte** (SvelteKit for the app shell). Lighter than React,
pairs well with a canvas/map-heavy UI.

## Map rendering: MapLibre GL JS + PMTiles

- **MapLibre GL JS** — open-source WebGL vector-tile renderer. Gives custom
  styling, smooth camera flights, labels that fade/scale with zoom — this is
  what makes the map "gorgeous" instead of Seterra's flat SVG look.
- **PMTiles** — a single static file format for vector tiles, servable over
  plain HTTP range requests, or read straight off disk in Tauri. No tile
  server to run; ships as an app asset; works fully offline. Ideal for the
  local-install POC.
- **Source data**: tiles built from **Natural Earth** (genuinely public
  domain) via `tippecanoe`. OpenStreetMap extracts are the natural next step
  for finer landmarks, but note OSM is **ODbL** (attribution + share-alike
  required) — not public domain.
- **No always-on name labels**: `data/styles/base.json` deliberately has no
  layer rendering target names on the map. Geoclick is a place-recognition
  game — labeling every region by default would give away the answer
  before the user even guesses. Names appear only on demand: a popup at
  the clicked location right now (Iteration 2), and during a guided tour's
  scripted reveal later (Iteration 3). The underlying `labels` source-layer
  (one point per target, at its centroid) still exists in the tiles for
  that on-demand use — it's just not wired into the default style.

## Domain model

**Target** — the thing being learned. Not just points: a river or mountain
range is a line, a country/region/lake is a polygon.

```
Target {
  id, name, aliases[], type: region|state|city|river|mountain|lake|landmark,
  geometry: Point | LineString | Polygon,
  tier, hint/image?
}
```

Hit-testing differs by type (radius for points, buffer for lines, fill for
polygons); the interaction model is otherwise the same.

**Map** — a base style + a curated set of targets + per-target
visibility/zoom rules. Stored as **JSON/GeoJSON files**, not DB rows —
portable, diffable, git-friendly, exportable/shareable.

**Tour** — an ordered, data-driven script over a subset of a map's targets:

```
TourStep { targetId, cameraBounds, dwellMs, narrationText? }
```

A generic Tour Player walks the array, driving MapLibre's `flyTo`/`easeTo`
and animating in a marker/label per step. Authoring a tour is just authoring
more JSON — same editor as maps.

**Quiz** — a drag-to-match game, not a flashcard form: every target in the
map appears as a name "slip" in a tray; drag one onto the region it names.
The region highlights while the slip is over it (neutral color — not
colored by correctness, so hovering doesn't leak the answer), sticks
(green, permanent) on a correct drop, and bounces back with a shake on a
wrong one. An earlier flashcard-style design (recognition: highlight a
point → guess the name; recall: show the name → click the location) was
the original plan but got replaced before building anything — the drag
mechanic reuses the same click/highlight infrastructure the explore and
tour views already have, just triggered by drag-hover instead of click,
and it reads as an actual *game* rather than a quiz form. Implemented as
`packages/quiz-engine` (pure session/scoring logic: `createQuizSession`,
`attemptMatch`, `isSessionComplete`, `scoreSession` — no UI or map
dependency) plus `QuizView.svelte` (the drag interaction: Pointer Events,
not HTML5 drag-and-drop, both for touch support later and so the drag can
continuously hit-test the map for the hover highlight).

An item's status is `'pending' | 'correct' | 'revealed'`, not just a
correct/incorrect boolean — after `MAX_ATTEMPTS_BEFORE_REVEAL` wrong drops
on the same slip, it auto-resolves as `'revealed'`: the name is shown and
the slip leaves the tray like a correct answer, but scored and colored
differently (excluded from `scoreSession`'s `perfect` count, a muted color
on the map rather than the real-success green) so a session can end
without every target having been genuinely solved, not stuck on one slip
forever.

The two-direction flashcard idea isn't gone, just deferred — nothing about
the drag-to-match mechanic blocks adding it later as a second quiz mode.
Each target's per-attempt result is the natural input to spaced repetition
once Iteration 6 adds it: targets missed more often get scheduled sooner.
Start with **SM-2**; FSRS is a drop-in upgrade later since the scheduler
interface (`rate(cardId, grade) -> nextDueDate`) doesn't change. Iteration 6
also changes what a quiz session *is*: only due (or never-seen) targets
become slips, the rest show pre-solved as already "discovered" — see
ROADMAP.md's Iteration 6 section for the full design, including the
empty-queue/"practice all" fallback once a map has nothing due.

## Storage — local-first

No backend for the POC. Progress (per-target SRS card state, last quiz
result per map) and, later, custom maps live in SQLite (Tauri plugin on
desktop, Capacitor SQLite plugin on mobile, `sql.js`/IndexedDB in plain
browser), behind one repository interface so the rest of the app never
touches platform-specific storage code — see ROADMAP.md's Iteration 5 for
the concrete data shape. Deliberately no user accounts for this: spaced
repetition only needs somewhere to remember state across sessions on one
device, not a login. A sync backend (accounts, shared maps, cross-device
progress) is a clean later addition precisely because it's local-first
now — same shape as Anki's own architecture. First concrete trigger for
that addition: recording quiz scores per user across devices, which needs
sign-in first (Google + other OAuth providers) — planned in ROADMAP.md's
Iteration 8+, not started.

## Repo layout

```
/app                          shared web core: map viewer, tour player,
                               quiz UI, editor
/packages/quiz-engine          pure TS, framework-agnostic, unit-testable
/packages/srs                  pure TS scheduler (SM-2 now, FSRS later)
/data                          map definitions + build pipeline (see below)
/desktop                       Tauri wrapper
/mobile                        Capacitor wrapper
```

## Demo maps & map-creation process

First three demo maps: **Italy (regioni)**, **Germany (Bundesländer)**,
**USA (states)**. All three are administrative-level-1 subdivisions of their
country, so a single Natural Earth dataset —
`ne_10m_admin_1_states_provinces` — covers all of them consistently. That
also means the same pipeline and the same base map style serve all three.

### Pipeline

```
/data
  /source                     raw downloaded Natural Earth files (gitignored)
  /scripts
    fetch-natural-earth.sh    downloads + caches the admin-1 dataset
    build-map.ts              filter → simplify → tile → derive targets
  /maps
    italy-regions/
      map.json                Map Definition (metadata + curated targets)
      tiles.pmtiles
    germany-states/
      map.json
      tiles.pmtiles
    usa-states/
      map.json
      tiles.pmtiles
  /styles
    base.json                 shared MapLibre style (coastlines, context)
```

**Steps to add a new admin-1 map:**

1. `fetch-natural-earth.sh` — downloads `ne_10m_admin_1_states_provinces`
   into `/data/source` if not already cached.
2. `build-map.ts --country="Italy" --out=data/maps/italy-regions`:
   - filters the source dataset to the target country (`ogr2ogr`/`mapshaper`
     by the `admin` attribute),
   - simplifies geometry for smaller tiles (`mapshaper -simplify`),
   - runs `tippecanoe` to produce `tiles.pmtiles`,
   - derives a draft `Target[]` list from the filtered GeoJSON (`id`, `name`
     from `name`/`name_en`, `type: region|state`, polygon geometry), and a
     default tour order sorted by centroid latitude/longitude as a starting
     point.
3. **Manual curation of `map.json`** — this step is intentionally not
   automated:
   - aliases for quiz matching (diacritics, alternate spellings, e.g.
     "Baden-Württemberg" / "Baden-Wurttemberg"),
   - difficulty tier,
   - final tour order (a sensible narrative sweep, not just a lat/lon sort),
   - optional hint text/image per target.
4. Preview the map in the app's map viewer/editor to sanity-check hit-testing
   and label placement at each zoom level.
5. Commit `map.json` + `tiles.pmtiles` (or regenerate tiles at build time and
   commit only `map.json`, if repo size becomes a concern).

### Known snags (found while building the demo maps)

- **Italy**: Natural Earth's admin-1 layer for Italy is actually at
  **province** granularity (110 features), not regions — the 20 regioni
  only exist as a `region` attribute on those province features.
  `build-map.ts` supports a `--dissolve=<field>` option to merge same-value
  features (here, by `region`) into the level we actually want, before
  deriving targets. Germany and USA were checked too: Germany's admin-1
  is already the 16 Bundesländer and USA's is already the 50 states + DC,
  so neither needs dissolving. Also, two of Natural Earth's Italian region
  names came through in English ("Apulia", "Sicily") rather than Italian —
  corrected to "Puglia"/"Sicilia" with the English kept as an alias.
- **USA — antimeridian bug**: Alaska's Aleutian Islands cross 180°
  longitude, which broke naive min/max centroid math (`(minLon+maxLon)/2`
  landed around 0°E — the wrong hemisphere entirely). `build-map.ts` now
  detects longitude spans over 180° and shifts the smaller side by 360°
  before averaging, unwrapping the result back into [-180, 180]. The `usa-states`
  demo map no longer has any target that exercises this (Alaska is
  excluded — see below), but the fix stays: it's still correct, general
  logic worth having if a future map includes Russia, Fiji, or another
  dateline-crossing territory.
- **USA — Alaska/Hawaii**: superseded the original "accept the dead space,
  no inset" call — excluded entirely instead (`build-map.ts --exclude`
  drops named features from the admin-1 filter before anything downstream
  sees them). Decided once actually looking at the rendered map: the
  contiguous 48 + DC fill the frame far better without two distant outliers
  stretching the bounds.

## Hosting / deployment

The browser leg needs a public host. Because the app is **local-first with
no backend** (see Storage, above), the browser build ships as a fully
static site — `@sveltejs/adapter-static` instead of `adapter-auto`. Not
every route prerenders, though: `/map/[mapId]` and its `/tour` route are
`ssr=false` (MapLibre needs the DOM) and not enumerated at build time
(we don't hardcode the list of map ids into the build), so they're served
via adapter-static's SPA fallback (`200.html` — the filename Cloudflare
Pages and Netlify both recognize) instead of a prerendered file per map.
That constrains the hosting decision usefully: any static host with SPA
fallback support works, chosen on cost/convenience, not runtime
capability.

**Two adapter-static + SPA-fallback gotchas hit while actually testing the
built output** (not just a successful `vite build` — see ROADMAP.md's
Iteration 3.5 for the full story):

- Default relative asset paths (`./_app/...`) break once `200.html` is
  served for a nested URL — the browser resolves them against the
  requested path, not the site root. Fixed with `paths: { relative: false
  }` in `vite.config.ts`.
- maplibre-gl's worker file is invisible to Vite's static-asset analysis
  (its URL is built from a runtime template literal), so it never makes it
  into `vite build`'s output at all — a *different* failure from the dev-
  server worker issue in Iteration 2, hit again on the production build
  path specifically. Fixed with a `postbuild` script that copies it (and
  its own dependency, `maplibre-gl-shared.mjs`) into the build output by
  hand. Both bugs were silent: no error in `vite build`, no error in the
  browser console — tiles fetched fine, the map just never rendered.
  Caught only by serving the actual `build/` output and hard-loading a
  deep-linked route in a real browser.

**Cloudflare Pages — tried, abandoned.** Was the original recommendation
(generous free tier, git-integrated, global CDN). In practice, getting an
actual deploy working surfaced one account-side bug and three platform
behavior surprises in a row: an unresolvable "build token belongs to a
user who left your organization" error in their Git-integration product;
the dashboard silently creating the project as a **Worker**, not a classic
**Pages** project, despite every settings screen looking Pages-shaped
(`wrangler pages deploy` errors with "project does not exist" against a
project that's right there); `_redirects` being applied *before* checking
for an existing static file at all, the opposite of their own classic
Pages documentation, which broke every real asset (tiles, `map.json`)
until scoped narrowly; and murky, seemingly non-working HTTP Range-request
support on Workers static assets specifically (their own tracking issue is
closed as "completed," but our live deploy still returned the whole
40 KB `.pmtiles` file with `200` instead of a partial `206`) — a hard
blocker, since `pmtiles-js` refuses to run at all without real byte-range
serving. None of this was guessable from their docs; each was found by
actually deploying and testing the live result. Full blow-by-blow in
ROADMAP.md's Iteration 3.5. Decision: stop spending further effort on
Cloudflare specifically and evaluate the alternatives below in parallel,
each in its own branch, to see which one actually works with the least
fighting.

**Netlify — chosen.** Live at
[zesty-centaur-40e7c5.netlify.app](https://zesty-centaur-40e7c5.netlify.app/).
Confirmed to have exactly the properties Cloudflare didn't: `_redirects`
only applies to genuinely unmatched paths (existing files win), and real
HTTP Range-request support — the live deploy returns `206 Partial
Content` with a correct `Content-Range` header for `.pmtiles` requests,
which is the one thing Cloudflare could never get right. `netlify.toml`
at the repo root is the entire hosting-specific config: a build command
and a publish directory, no adapter changes, no redirect-scoping
workarounds needed. The friction that did show up was ordinary
dashboard-configuration stuff, not platform bugs: a team-wide "private by
default" visitor-access setting gating every request behind an SSO login
wall (found and fixed directly through Netlify's own MCP integration,
once the user connected it — `update-visitor-access-controls`), and the
production branch defaulting to `main` instead of `deploy/netlify` (no
`netlify.toml` on `main`, so build command/publish directory showed as
"Not set" until the branch was corrected in Site configuration → Build &
deploy).

Other candidates considered, not pursued further once Netlify worked:

- **Vercel** — prepared (`vercel.json`, `deploy/vercel` branch) but never
  connected, since Netlify already worked. Would work fine with the
  static adapter; more oriented toward Next.js but not disqualifying for
  a plain static site.
- **GitHub Pages** — prepared (`deploy/github-pages` branch: Actions
  workflow + a `BASE_PATH`-driven subpath fix, since project repos serve
  from `user.github.io/repo-name/` rather than the domain root) but never
  connected — would've required making the repo public first (GitHub
  Free doesn't serve Pages from private repos), and Netlify made that
  trade-off unnecessary.
- **Replit** (Static Deployment) — no confirmed account, not tried. Worth
  reconsidering later if the optional sync backend from Iteration 8+
  materializes (Replit could host a Node API + Postgres alongside the
  static frontend without switching platforms).
- **itch.io** — different category: not a CI/CD host, but the place
  people actually go looking for indie/portfolio browser games. Worth
  doing *in addition to* Netlify once there's a polished build to show
  off, not instead of it.

**Status**: deployed and verified — all three demo maps, click-to-highlight,
and tour mode all confirmed working against the live Netlify URL (not
just a successful build). See ROADMAP.md's Iteration 3.5 for the full
story, Cloudflare included.
