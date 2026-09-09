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

**Quiz card** — each target yields two independent SRS cards:

- *Recognition*: highlight a point on the map → user recalls/types/picks the
  name.
- *Recall*: show the name → user clicks the correct location (optionally
  with decoys).

Each `(user, target, direction)` triple has its own ease factor, interval,
and due date. Start with **SM-2**; FSRS is a drop-in upgrade later since the
scheduler interface (`rate(cardId, grade) -> nextDueDate`) doesn't change.

## Storage — local-first

No backend for the POC. Progress and custom maps live in SQLite (Tauri
plugin on desktop, Capacitor SQLite plugin on mobile, `sql.js`/IndexedDB in
plain browser), behind one repository interface so the rest of the app never
touches platform-specific storage code. A sync backend (accounts, shared
maps) is a clean later addition precisely because it's local-first now —
same shape as Anki's own architecture.

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

**Recommendation: Cloudflare Pages** — generous free tier, connects
directly to the (private) GitHub repo and auto-deploys on push, global CDN
with solid HTTP Range-request support (important for streaming PMTiles
efficiently — the PMTiles/Protomaps ecosystem itself is commonly paired
with Cloudflare).

Alternatives considered:

- **Netlify** — essentially equivalent to Cloudflare Pages: git-integrated,
  free tier, private repos supported.
- **Vercel** — works fine with the static adapter, but more oriented
  toward Next.js; no clear edge here over Cloudflare/Netlify.
- **GitHub Pages** — free and zero extra service since the repo is already
  on GitHub, but on GitHub Free, Pages only works with **public** repos.
  This repo is private, so it'd require making it public or upgrading to
  GitHub Pro.
- **Replit** (Static Deployment) — also a good fit for the same reasons as
  Cloudflare Pages, and worth reconsidering if/when the optional sync
  backend from Iteration 8+ materializes, since Replit could then host a
  Node API + Postgres alongside the static frontend without switching
  platforms.
- **itch.io** — different category: not a CI/CD host, but the place people
  actually go looking for indie/portfolio browser games. Upload a zip of
  the static build. Worth listing there *in addition to* a proper host,
  once there's a polished build worth showing off.

**Status**: the static build itself is ready and verified (all three demo
maps, tour mode included, tested against the actual `build/` output).
Connecting Cloudflare Pages to the repo for continuous deployment is the
remaining step — see ROADMAP.md's Iteration 3.5.
