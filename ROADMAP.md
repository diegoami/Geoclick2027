# Geoclick — Roadmap

Self-contained iterations toward the desktop POC described in
[ARCHITECTURE.md](ARCHITECTURE.md). Each iteration should leave the repo in
a working, demo-able state so work can resume cleanly from any point.
Check items off as they land; update "Status" as iterations complete.

## Status

- **Done**: architecture proposal (`ARCHITECTURE.md`).
- **Not started**: everything below.
- **Next up**: Iteration 0.

---

## Iteration 0 — Repo & tooling scaffolding

**Deliverable:** A working, empty SvelteKit app that builds and runs
locally. Proves the toolchain (monorepo, TypeScript, lint) is sound before
any game logic exists. Nothing user-facing yet — internal milestone only.

- [ ] Init SvelteKit app in `/app`
- [ ] TypeScript + ESLint/Prettier baseline
- [ ] Set up npm/pnpm workspaces across `/app`, `/packages/quiz-engine`,
      `/packages/srs`
- [ ] Local build/test scripts wired up (`build`, `test`, `dev`)
- [ ] `.gitignore` covering `node_modules`, `/data/source`, build output

## Iteration 1 — Demo map data pipeline

**Deliverable:** Three ready-to-use map packages — Italy regions, Germany
states, USA states — each a self-contained tileset plus a curated target
list, loadable by any future UI. Reviewable by inspecting the raw
`map.json`/`tiles.pmtiles` output; no app needed yet.

- [ ] `data/scripts/fetch-natural-earth.sh` — download + cache
      `ne_10m_admin_1_states_provinces`
- [ ] `data/scripts/build-map.ts` — filter by country (ogr2ogr/mapshaper),
      simplify geometry
- [ ] `tippecanoe` integration producing `tiles.pmtiles` per map
- [ ] Derive draft `Target[]` JSON from filtered GeoJSON (id/name/type/
      geometry) + default tour order sorted by centroid
- [ ] Shared `data/styles/base.json` MapLibre style
- [ ] Run the pipeline for `italy-regions`, `germany-states`, `usa-states`
- [ ] Manually curate each `map.json`: aliases, tiers, tour order; resolve
      the Alaska/Hawaii framing decision for `usa-states`

## Iteration 2 — Core map viewer

**Deliverable:** Opening the app shows one of the three demo maps rendered
beautifully — pan, zoom, and click a region to see it highlight. The first
moment the project "looks like the product" rather than a tech spike.

- [ ] SvelteKit route loading a Map Definition + PMTiles via MapLibre
- [ ] Render base style + target layer (points/lines/polygons), styled
      distinctly per type
- [ ] Click/tap hit-testing per geometry type
- [ ] Zoom/pan controls, fit-to-bounds on load
- [ ] Manual smoke test against all three demo maps

## Iteration 3 — Tour mode

**Deliverable:** Press play on a demo map and watch a guided flythrough of
its regions in order, names revealing one by one. The core "gorgeous guided
tour" pitch is demonstrable end-to-end for the first time.

- [ ] `TourStep` data structure + one hand-authored tour per demo map
- [ ] Tour Player component: sequential `flyTo`/`easeTo`, marker/label
      reveal, dwell timing
- [ ] Play / pause / skip controls, narration text display
- [ ] Manual test: watch a full tour end-to-end for each demo map

## Iteration 4 — Quiz engine (`packages/quiz-engine`)

**Deliverable:** After watching a tour, you can quiz yourself on it —
click-the-location and name-the-location questions both work, with
reasonable tolerance for typos/accents. The "learning" loop exists, even
without any memory of past performance yet.

- [ ] Card model: `(target, direction: recognition|recall)`
- [ ] Recognition flow: highlight target → multiple-choice / typed name
- [ ] Recall flow: show name → click location, with hit-testing + decoys
- [ ] Fuzzy string matching for typed answers (diacritics, Levenshtein
      tolerance)
- [ ] Session composer + unit tests (pure TS, no UI dependency)

## Iteration 5 — Spaced repetition (`packages/srs`)

**Deliverable:** Quiz sessions now prioritize what you're about to forget
instead of a random shuffle — mistakes resurface sooner, correct answers
space out further. This is the Anki-style hook that differentiates Geoclick
from a one-off quiz.

- [ ] SM-2 scheduler implementation + unit tests
- [ ] `rate(cardId, grade) -> nextDueDate` interface
- [ ] Session composer upgrade: mix due cards + new cards (Anki-style)

## Iteration 6 — Local persistence

**Deliverable:** Close the app and reopen it — progress, due cards, and
stats are still there. Turns the demo into something you'd plausibly use
across multiple sessions, not a one-shot toy.

- [ ] Repository interface (maps, progress, card state), decoupled from
      platform
- [ ] SQLite implementation for Tauri; `sql.js`/IndexedDB fallback for
      plain-browser dev
- [ ] Wire quiz/SRS state through the repository; persists across restarts

## Iteration 7 — Desktop POC packaging (milestone)

**Deliverable:** A double-click-to-install desktop app containing all three
demo maps, with working tour, quiz, and persistent progress. This is the
thing you hand someone to try. **The POC milestone.**

- [ ] Tauri project wrapping `/app`
- [ ] Bundle PMTiles + `map.json` assets into the app
- [ ] Wire local SQLite storage plugin
- [ ] Build a local installer
- [ ] End-to-end run: tour → quiz → close app → reopen → progress persisted
- [ ] **This is the POC deliverable** — demo-able artifact

---

## Iteration 8+ — Post-POC (not yet scoped in detail)

**Deliverable:** to be scoped once the POC validates that the tour → quiz
loop actually feels good. Candidates below, in rough priority order.

- [ ] Map editor UI (author maps/tours without hand-editing JSON)
- [ ] Mobile packaging via Capacitor
- [ ] Plain-browser deployment (static hosting)
- [ ] Optional backend for sync/sharing
