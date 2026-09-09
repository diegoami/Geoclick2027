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

### Known snags to expect

- **USA**: Natural Earth's admin-1 set includes all 50 states + DC; Alaska
  and Hawaii's real positions leave a lot of dead map space — a cartographic
  choice (accept it, or add an inset) needed before that demo looks good.
- **Germany**: 16 Bundesländer, straightforward, no odd cases.
- **Italy**: 20 regioni, straightforward; Natural Earth's `name`/`name_en`
  fields should be checked for Italian-language completeness during
  curation.

## Hosting / deployment (deferred)

The browser leg needs a public host. Because the app is **local-first with
no backend** (see Storage, above), the browser build can ship as a fully
static site — `@sveltejs/adapter-static` instead of `adapter-auto`, all
routes prerendered, no server process required. That constrains the
decision usefully: any static host works, chosen on cost/convenience, not
runtime capability.

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

**Deferred**: no hosting is set up yet. Revisit once a demo map has a tour
and quiz worth sharing (around Iteration 3–4) — see ROADMAP.md.
