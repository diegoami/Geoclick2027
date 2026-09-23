# Geoclick — Roadmap

Self-contained iterations toward the desktop POC described in
[ARCHITECTURE.md](ARCHITECTURE.md). Each iteration should leave the repo in
a working, demo-able state so work can resume cleanly from any point.
Check items off as they land; update "Status" as iterations complete.

## Status

- **Done**: architecture proposal (`ARCHITECTURE.md`); Iteration 0 (repo &
  tooling scaffolding); Iteration 1 (demo map data pipeline); Iteration 2
  (core map viewer); Iteration 3 (tour mode); Iteration 3.5 (public
  deploy — live on Netlify); Iteration 4 (quiz engine — drag-to-match);
  Iteration 5 (local persistence — repository interface + `localStorage`
  backend, quiz results persisted and shown on the home page); Iteration
  6 (spaced repetition — SM-2 scheduler in `packages/srs`, due/not-due
  quiz sessions, "practice all regions", home page due-state display —
  the scheduler still runs, but v0.6.0/FT-26 took all three out of the
  interface: rounds cover the whole map and the home page speaks mastery,
  see docs/PLAN_V0.6.md);
  `italy-provinces` map (110 targets, see MAPS.md and this section's
  follow-up above); point-target support (`build-points-map.ts`, the
  `targets-circle` style layer) plus `italy-towns-100k`/
  `germany-towns-100k` (40/49 targets, see MAPS.md's "Point-target
  implementation" and this section's follow-up below); Iteration 7
  (desktop POC packaging — Tauri wrapping `app/build`, SQLite persistence
  via `tauri-plugin-sql`, `.deb`/`.rpm`/`.AppImage`/`.msi`/`.exe`
  installers all built successfully, verified end to end on both Linux
  and native Windows including a real click-tested quiz-answer SQLite
  write, two Windows-specific bugs found and fixed along the way — see
  that section's "Follow-up" entries for detail. Merged to `main`
  2026-09-12); Android packaging via Capacitor (POC — `mobile/` workspace,
  `@capacitor-community/sqlite` progress persistence, real device
  verification including a click-tested quiz-answer SQLite write on the
  user's own phone. One real bug found and fixed along the way: pmtiles
  rendering failed on Android due to a Capacitor WebView limitation
  around HTTP range requests, see the Iteration 8+ Android entry's
  "Emulator run" follow-up for detail. Merged to `main` 2026-09-12);
  GUI/UX evaluation, first round (big top-nav buttons via a shared
  `MapNav.svelte` tab bar on every map-scoped view, not just the landing
  page; an 8-color categorical map palette; unified/higher-contrast
  on-map labels; a resizable quiz tray, with a real flexbox min-height
  bug fixed along the way — see DECISIONS.md's "GUI/UX round 1" for the
  reasoning behind each. User-tested and approved. Merged to `main`
  2026-09-12); six new countries, twelve new maps — France, Spain, Great
  Britain, Poland, Ukraine, Sweden, each an admin-1-equivalent regions
  map plus a `>100k`-population towns map (see MAPS.md's dated section
  for exact commands, every localized-name/dissolve-field/fixup decision,
  and three script enhancements — `--name-field`/`--exclude-field`/
  `--extra-where` on `build-map.ts`, `--exclude` plus a `NAME_FIXUPS`
  table on `build-points-map.ts` — each added because one of these six
  countries actually needed it, not speculatively); quiz UX fixes — the
  bottom name tray now sizes itself from the real rendered content
  instead of a guessed viewport-percentage constant (fixes both an
  oversized default and a floor that used to clip a partial extra row),
  and the end-of-quiz score panel can be dismissed (or exited via "Back
  to maps") without being forced into another round (see DECISIONS.md);
  five more countries, ten more maps — Japan, Canada, Australia,
  Portugal, Netherlands, same regions-plus-towns pattern, this batch
  picked by Claude rather than user-specified (see MAPS.md's dated
  section and DECISIONS.md for the reasoning, including Australia's
  non-canonical-entity exclusions).
- **Two feature programmes have run since this list was written**, each
  with its own plan document and its own ledger:
  [docs/PLAN_V0.6.md](docs/PLAN_V0.6.md) — v0.6.0, "harder as you get
  better": a clean streak per name, a tray that offers fewer names as a
  map is learned, one mistake showing the answer, the Known map, names
  that never overlap, and a map that opens fully visible; and
  [docs/PLAN_V0.7.md](docs/PLAN_V0.7.md) — v0.7.0, "more maps, and slices
  of them": the United States' cities, six countries that had none,
  Italy's provinces in thirds, and a search box over the map list. Both
  are complete; **63 maps across 28 countries** ship today. A third is
  complete too: [docs/PLAN_V0.8.md](docs/PLAN_V0.8.md) — "something to hang
  a name on": a fact box on every place, and a map with sea, rivers and
  named terrain behind a toggle. FT-33 to FT-37 merged; **FT-38, the
  Wikidata landmark pass, is parked** — an unreliable SPARQL endpoint,
  unsettled product choices, and FT-45 has since removed the card slot it
  was written for. It is the one outstanding task of that programme;
  revisit after the v0.10.0 language decisions (HANDOVER.md, "Not
  verified, or still open").
- **v0.9.0 shipped 2026-09-19** (tag `v0.9.0`):
  [docs/PLAN_V0.9.md](docs/PLAN_V0.9.md) — "the map you build yourself".
  All four tasks merged. The Known map is what a map opens on, and a tap
  puts a name on it and leaves it there, so the player chooses which names
  to study (FT-39); the tutorial follows (FT-40); every place on every map
  has a name-fact, three deep — 28 countries, 1 814 authored places, 5 448
  sentences, all 2 235 targets (FT-41); and on a phone the fact card shows
  one line at a time and rotates (FT-42).
  **There is no stable v0.8.0**: that programme only ever shipped as
  `v0.8.0-beta.1`, and v0.9.0 carries all of it, so it supersedes that
  beta rather than following it.
- **v0.9.1 to v0.9.3 shipped 2026-09-19** — Terrain on by default and the
  language switcher rebuilt (v0.9.1); the fact card cut back to what the
  map cannot show and a bigger tap target for towns (v0.9.2, FT-45/FT-46);
  the name origin pinned as the card's first line (v0.9.3, FT-47). Each
  entry is in [CHANGELOG.md](CHANGELOG.md).
- **v0.9.4 planned 2026-09-20, reshaped 2026-09-22, released 2026-09-22**:
  [docs/PLAN_V0.9.4.md](docs/PLAN_V0.9.4.md). The other session's code
  review filed GitHub issues #1-#8; all eight were verified on 2026-09-20.
  FT-52 (`69cfa3d`, PR #10), FT-53 (`a0bc72b`, PR #12), FT-54
  (`5f5b767`, PR #13), FT-55 (`a1fdc24`, PR #14), FT-57 (`a0e379d`,
  PR #15) and FT-58 (`039c8e7`/`739bd20`, PR #16/#17) are merged and
  released as **`v0.9.4`** — installers published; the smoke test was
  skipped. **FT-56** (validate the shipped
  `tour.json`) and **FT-59** (a QuizView seam test), both test gates, are
  deferred to a hardening batch. No product decisions needed; **v0.10.0
  follows.**
- **v0.10.0 in progress, started and rescoped 2026-09-23**:
  [docs/PLAN_V0.10.md](docs/PLAN_V0.10.md) — translating the 5 448
  name-facts **and the six tablet-play UX fixes** the product owner moved
  into this release (FT-60 to FT-65). Translation decisions: **Italian
  first**, **per-sentence English fallback**, **no "EN" marker**, **German
  postponed**. Merged: **FT-48/FT-49** (Italy's 20 regions in Italian;
  per-language `hooks`), **FT-62**, **FT-65**, **FT-61**, **FT-60** and **FT-63** (five
  of the six UX fixes). **The FT-64 spike is decided** (stretched names
  read; SVG overlay with the pill as fallback; follow-up **FT-66**
  scheduled 2026-09-23). **FT-66 is merged** (PR #24, `4b8205a`):
  region names drawn along the region on the Explore map. **FT-50** is next.
- **Raised by the product owner 2026-09-22, backlogged**: GitHub issue #11 —
  on the Known map an explicitly tapped name kept its earned colour instead
  of **Chosen**. Decided: an explicit tap is Chosen regardless of the streak,
  and the choice is **session-only** (resets on reopen). Not scheduled.
- **Raised and decided 2026-09-20, unscoped**: six UX problems from one
  round of tablet play (`germany-towns-100k`) — the level-0 tray offering
  every name at once, slips losing their drag to the tablet's own
  text-selection gesture, the fact card interrupting the round (now: only
  on a name the player could *not* place), label placement taking the
  first free spot rather than the best one (now: best fit is a
  requirement — Duisburg's name covering Essen with open space to its
  west), region names sitting on a centroid instead of stretching along
  the region (now: a spike first), and the map card's `{known} / {total}
  known` line replaced by a progress bar over `knownCount / total`,
  hidden at zero — the score panel's copy of it stays, since the two
  record different things. Written up as
  the first item of the Iteration 8+ backlog below, each with the
  decision that settles it. **On 2026-09-23 the product owner moved all six
  into v0.10.0** (FT-60 to FT-65). A second item raised the same day, **the
  start screen becomes a zoomable world map**, stays in the backlog — the
  map list cannot be finalized as a list because the goal is a high number
  of maps; Favourites and Recent stay as they are.
- **Not started**: everything else below.
- **Next up**: motion/feedback design (reveal animations, streak
  indicators, sound, correct-drop juiciness) and a broader component/
  design-system pass remain open on the GUI/UX item — revisit whenever
  it feels worth another round, not on a fixed schedule. Three items
  requested 2026-09-12 (map-list reorganization, German/Italian UI
  languages, optional cross-device score sync via sign-in — see the
  Iteration 8+ backlog below): the first two are merged to `main`; sign-in
  is scaffolded and reconciled with `main` on `feature/supabase-sso-sync`
  (Supabase, user-confirmed) but explicitly **paused/deferred** as of
  2026-09-13 — see that backlog entry and DECISIONS.md. Four more items
  requested 2026-09-13, tracked in the Iteration 8+ backlog below: eight
  more countries and the adaptive per-country town-count threshold are
  both **done**, built together on
  `feature/add-eight-countries-adaptive-threshold`; the background-color
  visual refresh and the quiz solved-state contrast fix are also **done**,
  merged to `main`. Finalizing the SSO work above is on hold, not
  scheduled — the full desktop+mobile retest that was waiting on it is
  also on hold until SSO is picked back up.
- **Reordered**: local persistence and spaced repetition swapped places
  from the original numbering. Spaced repetition is pointless without
  somewhere to remember what's due across sessions — user accounts
  aren't the missing piece (this stays local-first, no login, see
  ARCHITECTURE.md's Storage section), local storage is. Iteration 5 is
  now local persistence; Iteration 6 is spaced repetition, built on top
  of it. Iteration 6's design also changed shape in the process — see
  its section below.

## Process notes (not tied to a specific iteration)

- **v0.1.0 tagged as the first tracked release (2026-09-13)**, covering
  everything shipped through the point above — before any remediation
  fixes begin. See [CHANGELOG.md](CHANGELOG.md). The version and a short
  build/commit identifier are now shown on every screen (bottom-right
  corner) via `app/src/lib/VersionBadge.svelte`, injected at build time
  from the root `package.json` (kept in sync across all three shells by
  `scripts/sync-version.mjs`).
- **Remediation programme (2026-09-13)** — an independent code/design review
  produced 30 findings, first planned as a 20-task, 3-release, GitHub-issue-
  driven multi-agent programme in
  [docs/REMEDIATION_PLAN.md](docs/REMEDIATION_PLAN.md)/
  [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md)/
  [docs/RELEASES.md](docs/RELEASES.md). **Immediately scaled down** by the
  product owner before any task started: no GitHub (local branches/tags
  only), release-branch buffering dropped (Netlify build cost isn't a
  real constraint — see CLAUDE.md), "nice-to-have" tier dropped from
  scope, and the agent roster cut from four engines (haiku/sonnet/opus/
  fable) to two (sonnet implements, opus reviews/merges/orchestrates).
  **Final shape (2026-09-13, third draft):** **one Opus agent working one
  task at a time in a loop** — no multi-agent split, no subagents, no
  worktrees, no leases, no ports to allocate. 19 tasks / 5 waves, because
  the nice-to-have tier `#20`–`#30` was restored on an effort test ("do
  those, if they are low effort"), so all 30 review findings are now
  assigned; only the already-proven worktree spike stays dropped. 3 local
  tags: `v0.1.1` and `v0.1.2` as fix batches, `v0.2.0` as the closing
  milestone the product owner ships ("known issues from the Sept 13 review
  resolved"; `1.0.0` stays reserved for the real public launch). Progress is
  trackable in the **committed ledger table** in `docs/REMEDIATION_PLAN.md`
  (the `.orchestrator/state/*.json` files are gitignored machine state).
  Zombie hygiene is an explicit requirement: `node scripts/task.mjs doctor`
  runs every iteration and before every release. `scripts/seed-forge.mjs` is
  deleted. **Done (2026-09-13):** all 19 tasks merged. From the first
  batch on, the loop merged each task itself once gates and definition of
  done were green (the product owner's automerge call), and stopped only to
  ask before each release tag. Shipped as `v0.1.1`, `v0.1.2` and the
  `v0.2.0` milestone. Per-task notes are in the ledger; release notes are
  in CHANGELOG.md.
- **Feature programme (2026-09-13; v0.4.0 done 2026-09-14; v0.5.0 next: recent and favourite maps, then the tutorial)** — four new
  requests, each already investigated in
  [docs/FEATURE_BACKLOG.md](docs/FEATURE_BACKLOG.md): public downloads,
  app logos, an interactive three-language tutorial, and a names text-size
  setting. They are planned as twelve tasks in
  [docs/FEATURE_PLAN.md](docs/FEATURE_PLAN.md) and ship as `v0.3.0`
  (readable and installable) and `v0.4.0` (tutorial). Unlike the
  remediation loop, every merge waits for the product owner's OK.
  **v0.3.0 (FT-01 to FT-08):** label size and magnify-on-hover/tap (the
  planned Normal/Large switch was replaced at review), the pin logo on
  every shell, Android release signing, and a packaging script. Installers
  are published to the public `diegoami/geoclick-releases` repo. v0.3.1
  fixed empty maps in the desktop app. **Next, v0.4.0 (added 2026-09-14):**
  maps open on their overview, with an Explore tab, and Android back goes up
  a level (FT-13, FT-14). Then the tutorial, as v0.5.0 (FT-09 to FT-12).
- **Git worktrees failed for parallel background feature work on this
  project as attempted 2026-09-12 — RESOLVED 2026-09-13.** Root cause was
  exactly as suspected: a `git worktree` checkout doesn't get its own
  `node_modules` (npm workspaces hoists it to the main checkout), so
  `npm run dev` inside one couldn't render a map. Verified directly (not
  assumed) by creating a real worktree, running `npm install` inside it
  (own `node_modules`, ~16s), starting its dev server, and comparing
  network requests against the main checkout side by side: both got
  identical `206 Partial Content` tile responses through the maplibre-gl
  worker — the worker/`fs.allow` failure is gone once `node_modules` is
  local to the worktree. (A blank first screenshot briefly looked like
  the old bug recurring; it was actually `document.hidden === true` on a
  backgrounded automation tab, confirmed by seeing the identical artifact
  on the main checkout's own dev server too — unrelated to worktrees,
  worth remembering as a testing gotcha on its own.) **Parallel
  worktree-based agent work on this repo is viable again, as long as each
  worktree runs its own `npm install` first** — this was GC-000 in the
  remediation programme's first draft; superseded by whatever task
  numbering the simplified local-harness revision uses, but the finding
  stands regardless of which programme references it.
- [ ] **Dependabot** — `.github/dependabot.yml` watching the npm
      ecosystem at the repo root (covers `app/` + `packages/*` through
      the one workspace lockfile). Weekly schedule, version + security
      updates. Review each PR (lint/check/test/build + the Playwright
      smoke pass for anything UI-facing) rather than auto-merging —
      precedent for this: a MapLibre version bump previously changed
      behavior in a way that needed investigation, not a rubber stamp.
- [ ] **Periodic `/code-review`** — run it as a checkpoint at the end of
      each iteration rather than only on request, so drift gets caught
      close to when it's introduced. No new subagent/role needed for
      this, it's an existing skill.
- [ ] **Keep `ARCHITECTURE.md` current as a real map of the code**, not
      just the original design doc it started as — the practical way the
      user (who isn't reading the code directly) keeps a grasp of how
      it's organized as it grows. Update it as part of finishing each
      iteration, alongside the existing ROADMAP.md deliverable notes.

---

## Iteration 0 — Repo & tooling scaffolding

**Deliverable:** A working, empty SvelteKit app that builds and runs
locally. Proves the toolchain (monorepo, TypeScript, lint) is sound before
any game logic exists. Nothing user-facing yet — internal milestone only.

- [x] Init SvelteKit app in `/app`
- [x] TypeScript + ESLint/Prettier baseline
- [x] Set up npm/pnpm workspaces across `/app`, `/packages/quiz-engine`,
      `/packages/srs`
- [x] Local build/test scripts wired up (`build`, `test`, `dev`)
- [x] `.gitignore` covering `node_modules`, `/data/source`, build output

## Iteration 1 — Demo map data pipeline

**Deliverable:** Three ready-to-use map packages — Italy regions, Germany
states, USA states — each a self-contained tileset plus a curated target
list, loadable by any future UI. Reviewable by inspecting the raw
`map.json`/`tiles.pmtiles` output; no app needed yet.

- [x] `data/scripts/fetch-natural-earth.sh` — download + cache
      `ne_10m_admin_1_states_provinces`
- [x] `data/scripts/build-map.ts` — filter by country (ogr2ogr/mapshaper),
      simplify geometry
- [x] `tippecanoe` integration producing `tiles.pmtiles` per map
- [x] Derive draft `Target[]` JSON from filtered GeoJSON (id/name/type/
      geometry) + default tour order sorted by centroid
- [x] Shared `data/styles/base.json` MapLibre style
- [x] Run the pipeline for `italy-regions`, `germany-states`, `usa-states`
- [x] Manually curate each `map.json`: fixed Italy's two English region
      names (Apulia → Puglia, Sicily → Sicilia, English kept as alias).
      Tour order left as the default north-to-south sweep — already a
      sensible narrative order. Deeper alias/tier curation deferred to
      Iteration 4, once the quiz engine exists to actually consume it.
- [x] Alaska/Hawaii framing decision for `usa-states`: keep real geographic
      position, no inset — revisit only if it looks bad once rendered in
      Iteration 2. Also fixed an antimeridian-wraparound bug in
      `build-map.ts` that gave Alaska a nonsense centroid (~0°E) before
      this — its bbox now correctly signals wraparound (west 172.64° >
      east -129.99°).

**Setup notes:** Node.js wasn't installed on this machine — installed via
nvm (LTS, v24). GDAL (`ogr2ogr`) and `tippecanoe` installed via apt. The
`pmtiles` CLI (mbtiles → PMTiles conversion) isn't packaged for apt —
installed the prebuilt Linux binary from
[protomaps/go-pmtiles](https://github.com/protomaps/go-pmtiles) releases
into `~/.local/bin`. None of this is repo-tracked; a fresh machine will
need the same one-time setup.

**Follow-up, found by actually looking at the USA map:** Michigan reads
as confusing/broken — its two peninsulas visually merge into Wisconsin
and Ohio with no indication there's open water (the Great Lakes) between
them, just an unexplained gap in the fill. Root cause confirmed before
assuming a fix: a state's polygon correctly excludes the lake surface
(the geometry itself is fine), but nothing was rendered *in* that gap, so
it read as missing data rather than water.

Fixed by adding a `lakes` source-layer to the pipeline, not by touching
Michigan's geometry:

- [x] `fetch-natural-earth.sh` also downloads `ne_10m_lakes` (public
      domain, same Natural Earth family already in use)
- [x] `build-map.ts` selects lakes by bounding-box intersection with the
      map's overall extent (`ogr2ogr -spat`, a feature filter, not a
      geometry clip) rather than by country — lakes aren't tagged by
      admin boundary the way states are, and a lake worth rendering can
      extend past the map's bounds (Lake Superior into Canada, for
      instance) without that being a problem
- [x] New `lakes-fill` layer in `data/styles/base.json` (light blue,
      purely contextual — no hit-testing, no feature-state), documented
      in the style's metadata note alongside `targets`/`labels`
- [x] Re-ran the pipeline for all three demo maps, not just USA, for
      consistency — confirmed via `git diff` that `map.json`/`tour.json`
      came out byte-identical to before (only the binary `.pmtiles`
      changed), so no hand-curated data was at risk of being clobbered

**Verified:** screenshotted Michigan before and after at both a close
zoom and the full-USA overview zoom — before, Wisconsin/Michigan/Ohio
read as one undifferentiated blob; after, Lake Superior/Michigan/Huron
clearly separate them, matching a real coastline. Re-ran the full
existing quiz-behavior regression suite (hit-testing explicitly queries
only the `targets-fill` layer, so the new `lakes-fill` layer was never
expected to interfere, but verified rather than assumed) — no
regressions.

**Follow-up, found immediately after shipping the above:** the lakes
were there but barely readable — the land fill (`targets-fill`, `#8fb8a8`
at 85% opacity) and the lake fill (`#bcdcea` at 90%) were both pale,
similarly-toned colors, easy to mistake for the same background at a
glance. First instinct was to make the lake color more saturated, but
the user's actual suggestion worked better: lower the *land* fill's
opacity instead (`0.85` → `0.6`), so the lake blue reads clearly against
lighter, less saturated land rather than trying to out-saturate it.
Checked this didn't wash out the quiz's own feature-state colors
(correct/wrong/revealed/hover, all more saturated than the base green to
begin with) by screenshotting a solved region mid-quiz — still reads
clearly distinct from unsolved territory. Re-ran the regression suite
again after the change; still clean.

**Follow-up, a fourth map (`italy-provinces`, 110 targets):** shipped per
the plan in `MAPS.md` — no new data source needed, Italy's admin-1 data
in Natural Earth is already province-level, `italy-regions` only shows
20 because of its `--dissolve=region` flag. Skipping that flag and
adding a `'province'` `TargetType` (confirmed nothing else in `app/`
branches on `TargetType` at all — it's carried as metadata only, a safe
additive change) was enough to build it.

- [x] Audited all 110 raw province names directly, not spot-checked —
      found 3 non-Italian names (Aoste→Aosta, Bozen→Bolzano,
      Turin→Torino) and 2 apparent Natural Earth data typos, not
      translation issues (Crotene→Crotone, Oristrano→Oristano). All five
      added to `NAME_FIXUPS['Italy']` alongside the existing region-level
      fixups.
- [x] Confirmed the shared `NAME_FIXUPS['Italy']` table doesn't
      cross-contaminate between the two Italy maps: regenerated
      `italy-regions` after the change and confirmed via `git diff` it
      produced byte-identical `map.json`/`tour.json`/`tiles.pmtiles`.
- [x] Added to the home page's map list.

**Verified:** Playwright against the live app, not just the generated
files — home page lists it, `/overview` shows all 110 with the corrected
names visible (Aosta/Bolzano/Torino, not Aoste/Bozen/Turin), quiz tray
has 110 slips in alphabetical order and a drag-drop solve works, tour
loads with no errors. Full existing unit test suite (41 tests across
app/quiz-engine/srs) and a production build both still clean — this
change touches no shared quiz-mechanics code, only adds a map and a
`TargetType` value.

**Follow-up, point-target support + the two towns maps
(`italy-towns-100k`, 40 targets; `germany-towns-100k`, 49 targets):**
implements the design already registered in MAPS.md's "Point-target
design" section — see that file's "Point-target implementation" section
for the full detail, since it's genuinely a pipeline/app change, not
just new map data. In short: a new `build-points-map.ts` script (shares
small helpers with `build-map.ts` via a new `mapBuildUtils.ts`, extracted
rather than duplicated), a new `targets-circle` style layer reusing
`targets-fill`'s exact feature-state color scheme, and hit-testing/
click-hover/camera-framing changes across `QuizView`/`MapView`/
`TourView` so a point map plays like the same game with round markers.

Two real bugs found only by testing the actual built maps, neither
anticipated in the original design:

- Tippecanoe drops point density at low zoom by default (a reasonable
  general-basemap assumption, wrong for a small curated gameplay-
  critical set) — only 4 of `italy-towns-100k`'s 40 markers actually
  rendered at the initial zoom, confirmed via `queryRenderedFeatures`
  against the live tileset. Fixed with `--drop-rate=1`.
- The polygon tolerance mechanism's core assumption ("is the dragged
  target's name present in the tolerance box") breaks down for dense
  point clusters, where two cities can sit closer together than the
  tolerance radius itself (Essen/Duisburg: ~22px apart on screen,
  inside a 30px tolerance). Confirmed directly: dropping a **Duisburg**
  slip squarely on **Essen**'s marker still registered as Duisburg
  solved. Fixed with a point-maps-only `closestNameAmong()` check —
  tolerance-based correctness now requires the dragged target to be the
  *closest* candidate to the drop point, not merely present nearby.
  Polygon maps don't exercise this path at all; re-verified unaffected.

Also resolved by building and measuring against the real maps rather
than guessed: point drop tolerance (30px), tour zoom for "looking at one
city" (7, after comparing 6/7/8/9/10 against Trento directly — zoom 10
left the marker floating with nothing else in frame, since this style
has no base map layer to provide context on its own), and hover
tolerance for points (none needed — a marker's own ~9px rendered radius
already gives hover a comfortable natural hit zone, confirmed by
measuring the actual falloff point).

**Follow-up, missing country/region contours:** raised by the user after
looking at a finished towns map — floating city markers with nothing
showing the country's outline or internal admin-1 borders, unlike a
polygon map where the target polygons themselves, filled edge to edge,
already show the whole country. Fixed the same way as the earlier lakes
fix: a new `context` source-layer (`selectCountryContext()` in
`mapBuildUtils.ts`, same `ne_10m_admin_1_states_provinces` dataset
`build-map.ts` already uses, filtered to the map's own country), rendered
by new `context-fill`/`context-outline` style layers under
`lakes-fill`/the targets layers — purely visual, no hit-testing, no
feature-state. A polygon map's tileset has no `context` source-layer, so
these two layers are a harmless no-op for it, same pattern as
`targets-circle` being a no-op for a polygon map. Both towns maps
rebuilt; verified via screenshot that the full country outline and
internal admin-1 borders now render behind the markers, and that
`germany-states` (a polygon map) still renders unchanged with no console
errors. Full 41-test suite and a production build both stay clean. See
MAPS.md's "Point-target implementation" section for the detail.

**Verified:** home page lists both towns maps; `/overview` shows all
40/49 markers with correctly localized names (Roma/Milano/Torino,
München/Köln, not the English forms); quiz hit-testing confirmed at
exact centroids (5/5 landed) and realistic ~15px-imprecise drops;
Ruhr-area and Milan-area dense-cluster cases specifically re-tested
after the closest-candidate fix, both the legitimate solve and the
should-fail wrong-city-but-nearby case; tour camera framing confirmed
visually at the chosen zoom. Full pre-existing polygon-map regression
suite (alphabetical order, Bremen's own tolerance, wrong-drop error
recording) re-run and confirmed unaffected. Full unit test suite and a
production build both clean.

## Iteration 2 — Core map viewer

**Deliverable:** Opening the app shows one of the three demo maps rendered
beautifully — pan, zoom, and click a region to see it highlight. The first
moment the project "looks like the product" rather than a tech spike.

- [x] SvelteKit route loading a Map Definition + PMTiles via MapLibre
      (`/map/[mapId]`, `MapView.svelte`)
- [x] Render base style + target layer, styled distinctly. Scoped to
      polygons only — all three demo maps are region/state polygons, no
      point/line target exists yet to justify styling for those geometry
      types; add when a map actually needs them (e.g. rivers, capitals).
- [x] Click hit-testing (`queryRenderedFeatures` + `setFeatureState`,
      orange highlight on click). Tap wasn't separately tested — no
      touch-device testing available in this environment; MapLibre treats
      tap as click by default, so likely fine, but genuinely unverified.
- [x] Zoom/pan controls (`NavigationControl`), fit-to-bounds on load (from
      target centroids — see `overallBounds` in `mapDefinition.ts`)
- [x] Manual smoke test against all three demo maps (Playwright,
      screenshots + console/network assertions, not just eyeballing)

**Two real bugs found via the smoke test, not just polish:**
- MapLibre's tile-parsing worker (`maplibre-gl-worker.mjs`) silently failed
  to load under Vite's dev pre-bundling — tiles fetched fine (206 partial
  responses) but nothing rendered, no error surfaced in the UI. Fixed with
  `optimizeDeps.exclude: ['maplibre-gl']` in `vite.config.ts`.
- `base.json`'s click-highlight layer used `feature-state` inside a layer
  `filter`, which MapLibre doesn't support (feature-state only works in
  paint/layout expressions) — threw at style load. Fixed by folding the
  highlight into `targets-fill`'s `fill-color` as a `case` expression
  instead of a separate filtered layer.

**One data-pipeline bug found while actually looking at the render:**
default polygon-label placement duplicated labels wherever a region's
polygon crossed a tile boundary (visible on Italy at low zoom — Toscana,
Sardegna, etc. each labeled 2-3 times). Fixed in `build-map.ts` by
generating a separate `labels` point layer (one point per target, at its
precomputed centroid) instead of relying on MapLibre's per-tile polygon
label placement. Also moved the Apulia/Sicily → Puglia/Sicilia name fix
(originally patched directly into `map.json` in Iteration 1) upstream into
`build-map.ts` itself, so `map.json` and the tiles agree by construction
instead of by a manual patch that only touched one of the two.

**Setup notes:** the smoke test used Playwright + Chromium headless (not
just HTTP status checks) to actually catch the two rendering bugs above —
`npx playwright install chromium` plus one more apt package
(`libasound2t64`) were needed on this machine, not repo-tracked.

**Follow-up round, from using the actual viewer:**

- [x] Removed the always-on region-name label layer from `base.json` — a
      place-recognition game shouldn't show the answer on the map by
      default. Names now appear on demand: a popup at the clicked location.
- [x] Excluded Alaska/Hawaii from `usa-states` entirely (new
      `build-map.ts --exclude` option), rather than including them and
      accepting the dead space — decided once actually looking at the
      rendered map. 49 targets now (48 contiguous states + DC).
- [x] Fixed the zoom controls (top-right) overlapping the back button —
      consolidated back-link + map-name into one MapView-owned corner
      cluster (top-left), leaving top-right to MapLibre's own
      `NavigationControl` exclusively.
- [x] Replaced the small corner "selected: X" text with a `maplibregl.Popup`
      anchored at the click location, larger text, closer to the region —
      directly requested, and also a more natural fit now that permanent
      labels are gone.
- [x] **New "Overview" view** (`/map/[mapId]/overview`, `OverviewView.svelte`)
      — the map with every region already shown "discovered" (same green
      fill + name popup as a solved quiz target), no interaction beyond
      pan/zoom. Requested directly, positioned as the first link on the
      map landing page — above "Start tour" and "Start quiz" — since
      seeing the whole answer key at a glance is the most basic thing to
      offer before asking someone to learn or be tested on a map. Reuses
      `createMap`/`fetchMapDefAndStyle` like every other view; no changes
      needed to `packages/quiz-engine` or the shared style beyond what
      already existed for the "solved" visual treatment. Known limitation
      carried over from the quiz's own end state, not introduced here:
      DOM popups don't collision-avoid each other, so a cluster of small,
      geographically-dense targets (the New England states, DC/Maryland/
      Virginia) can overlap at a default zoom — a pre-existing tradeoff
      from choosing DOM popups over a MapLibre symbol layer (see the
      Quiz mechanic section of `DECISIONS.md`), not a new regression.
      Verified: all 20/16/49 targets show a popup on the three demo maps,
      "✓ Show overview" appears first among the three links, no console
      errors on any of the three maps including the larger 49-target USA
      one.

## Iteration 3 — Tour mode

**Deliverable:** Press play on a demo map and watch a guided flythrough of
its regions in order, names revealing one by one. The core "gorgeous guided
tour" pitch is demonstrable end-to-end for the first time.

- [x] `TourStep` data structure (`app/src/lib/tour.ts`) + `tour.json` per
      demo map, generated by `build-map.ts` from the already-curated
      `tourOrder` (north-to-south sweep) with a default 3s dwell per step.
      Narration text is supported by the type but left empty — same
      "curate when something actually consumes it" call as aliases/tiers
      in Iteration 1; it's not worth hand-writing flavor text for ~85
      targets across 3 maps before the quiz loop (Iteration 4-5) proves
      the core mechanic is worth polishing.
- [x] Tour Player (`TourView.svelte`): sequential `fitBounds` to each
      target's bbox (1.2s flight), highlight via the same feature-state
      mechanism as click-to-explore, popup reveal at the target's centroid,
      dwell timer before auto-advancing.
- [x] Play / pause / prev / next controls, step progress ("i / N"),
      replay on completion. No narration text display yet since none is
      authored (see above) — the UI supports it trivially once it exists.
- [x] Speed control (0.5×/1×/1.5×/2×/3×, requested after first trying the
      tour) — scales both the dwell timer and the camera flight duration,
      so a faster tour also *feels* faster rather than just cutting the
      pause short. Changing speed mid-step restarts that step's countdown
      at the new speed rather than preserving exact elapsed progress —
      simple, and the only visible effect is timing (no re-flying or
      re-popup).
- [x] Manual test: full tour watched end-to-end for all three demo maps
      (Playwright: autoplay, dwell-based auto-advance, pause actually
      halting the timer, manual prev/next, speed control actually changing
      advance timing, zero console errors)

**Refactor along the way:** extracted the map-bootstrapping logic shared
between free-explore (`MapView.svelte`) and tour (`TourView.svelte`) into
`app/src/lib/geoclickMap.ts` — both need the same fetch-style-and-pmtiles,
create-map, add-nav-control sequence, only the interaction model differs.
Also added `promoteId: "name"` to `base.json`'s `targets` source, so both
views can highlight a feature by its target name directly
(`setFeatureState(..., id: target.name)`) instead of needing to query the
source for a feature first — simpler and works even for a target that
hasn't been clicked (which the tour needs, since it drives highlighting
from script data, not a click event).

## Iteration 3.5 — Public deploy (optional, deferred)

**Deliverable:** a shareable URL anyone can open in a browser — no clone,
no install — showing whatever the app can do at the time (tour mode at
minimum, quiz mode once Iteration 4 lands). **Done:**
[geoclick.netlify.app](https://geoclick.netlify.app/).

Not part of the linear build order — pick this up whenever there's
something worth showing off, no earlier than Iteration 3. See
ARCHITECTURE.md's "Hosting / deployment" section for the reasoning.

- [x] Swap `adapter-auto` for `@sveltejs/adapter-static` in `app/`, with a
      `200.html` SPA fallback (the filename several static hosts look for)
      for the two dynamic `/map/[mapId]` routes, since map ids aren't
      enumerated at build time. Home page prerenders normally
      (`+layout.ts`: `prerender = true` by default, opted out per-route).
- [x] ~~Connect the repo to Cloudflare Pages~~ — tried, abandoned after
      two live incidents and an unresolvable account-side bug. See
      "Cloudflare Pages (abandoned)" below for the full story, and
      "Testing alternatives" for what's next.
- [x] Get one of Netlify / Vercel / GitHub Pages actually serving the app,
      tested in its own branch (see "Testing alternatives" below) —
      **Netlify won**, live and verified (see "Netlify — chosen" below)
- [ ] (Optional, later) list a build on itch.io once it's polished enough
      to show

### Cloudflare Pages (abandoned)

**Cloudflare dashboard settings** (their newer unified Workers-and-Pages
Git integration asks for a *Deploy command*, not a build-output-directory
field — different from the classic Pages onboarding flow):

- Framework preset: **None** (don't let it auto-detect SvelteKit — that
  assumes Cloudflare's own adapter, not `adapter-static`)
- Root directory: `/` (repo root — not `app/`; `npm install` needs to run
  at the root for the npm workspace to link `app` + `packages/*` correctly)
- Build command: `npm run build --workspace=app`
- Deploy command: `npx wrangler pages deploy app/build --project-name=<name>`

Verified locally as far as possible without real credentials: `npx
wrangler deploy` (the generic Workers command, and what a
`pages_build_output_dir` key in `wrangler.jsonc` is meant to pair with)
flatly refuses to run from an npm-workspaces root at all — a real
constraint, not a guess. `npx wrangler pages deploy app/build
--project-name=...` (the Pages-specific command, used above) has no such
problem: run from repo root, it got all the way to Cloudflare's own auth
check, meaning the command and paths are correct.

Two account-side snags hit getting an actual deploy to succeed, both fixed
in the Cloudflare dashboard rather than in this repo:

- The token Cloudflare auto-injects as `CLOUDFLARE_API_TOKEN` for this
  build flow defaults to Workers-only scope, not Cloudflare Pages — so
  `wrangler pages deploy` (a Pages API call) got a permissions error even
  though the account itself is Super Administrator. Fixed by creating a
  custom API token with **Account → Cloudflare Pages → Edit** permission
  and setting it as a `CLOUDFLARE_API_TOKEN` build variable on the
  project, overriding the auto-injected one.
- Separately, the token that authenticates the *build step itself*
  (cloning/initializing, distinct from the deploy-step token above) had
  belonged to an org member who'd since left — Cloudflare's own error
  named the fix: Settings → Builds → API token → select or create a new
  one. This one didn't actually resolve on retry even after regenerating
  the token, and turned out to be a known, acknowledged bug in Cloudflare's
  Workers Builds product (matching community reports of the exact same
  error persisting across token regeneration) rather than anything
  specific to this repo.

**Pivoted to GitHub Actions instead of Cloudflare's Git integration**
(`.github/workflows/deploy.yml`) once the build-token bug above didn't
resolve — triggered by GitHub's CI instead of Cloudflare's own, sidestepping
their Workers-Builds token-management bug entirely. Needs two GitHub
Actions repository secrets (Settings → Secrets and variables → Actions):
`CLOUDFLARE_API_TOKEN` (the Pages:Edit-scoped token from above) and
`CLOUDFLARE_ACCOUNT_ID`.

**First real Actions run surfaced one more thing**: `wrangler pages deploy`
failed with `The Pages project "geoclick2027" does not exist` — the
dashboard had actually created "geoclick2027" as a **Worker** (Cloudflare's
newer unified Workers+Pages model), not a classic Pages project, despite
every setting screen along the way looking Pages-shaped. Switched to
`wrangler deploy` with static assets instead (`app/wrangler.jsonc`,
`assets.directory: "./build"`), which matches what the dashboard actually
created. Run from `app/`, not repo root — plain `wrangler deploy` (unlike
`wrangler pages deploy`) refuses to run at all from an npm-workspaces root.
SPA fallback for the two dynamic routes now goes through an `app/static/
_redirects` file (`/* /200.html 200`) rather than `not_found_handling:
"single-page-application"`, since that mode serves plain `index.html` —
built for the home route specifically, with the wrong embedded hydration
data — for every unmatched path instead of our `200.html` fallback.
Verified `_redirects`-file support for Workers static assets against
Cloudflare's own docs before relying on it, rather than assuming.

**Live incident right after the first successful deploy: infinite redirect
loop on every route** (`/` included). `assets.html_handling` defaults to
`"auto-trailing-slash"`, which redirects `/200.html` → `/200` (stripping
the extension). `/200` isn't a real file, so that fell through to the
`_redirects` catch-all again, which points straight back at `/200.html` —
looping forever. Not caught locally beforehand (my `serve`-based
simulation doesn't replicate Workers' own html-handling layer at all).
Fixed with `html_handling: "none"` in `wrangler.jsonc`, plus an explicit
`/ → /index.html` rule in `_redirects` (ahead of the catch-all) so the
home page doesn't depend on implicit index-file resolution either, which
"none" mode's docs left ambiguous. Re-verified with `wrangler dev` this
time instead of the `serve` simulation — it runs the actual Workers
assets/redirects engine locally, and would have caught this before the
first deploy had I used it from the start.

**Second live incident, same deploy fixing the first one: `_redirects`
swallowed every real static asset**, not just the dynamic routes. Tiles,
`map.json`, everything under `/maps/` and `/styles/` came back as the
`200.html` shell (`content-type: text/html`) instead of themselves.
Cloudflare's own docs, once actually checked: for Workers static assets,
"redirects are always followed, regardless of whether an asset matches
the incoming request" — the opposite of what I'd assumed from classic
Pages' documented behavior (existing files take priority, `_redirects`
only applies to unmatched paths). My catch-all `/* → /200.html` rule was
intercepting literally everything. Fixed by scoping it to `/map/*`
instead of `/*` — matches only the two dynamic SvelteKit routes, and
never collides with `/maps/...` (plural, our static data directory)
since they're different path prefixes. This time checked `Content-Type`
and actual body content with `wrangler dev` for every critical path
(`/`, `/map/[id]`, `/maps/[id]/map.json`, `/maps/[id]/tiles.pmtiles`,
`/styles/base.json`) before redeploying, not just HTTP status codes —
status 200 was what hid this bug the first time around.

**Two real bugs found by testing the actual built output, not just
`vite build` succeeding:**

- **Relative asset paths broke the SPA fallback.** The default SvelteKit
  build emits asset links like `./_app/...`, correct only when the HTML is
  served at the path it was built for. When `200.html` gets served for an
  arbitrary nested URL (e.g. `/map/italy-regions`), the browser resolves
  `./_app/...` against *that* URL, not the site root — producing a broken
  `/map/_app/...` and a hard "expected a JS module, got text/html" failure.
  Fixed with `paths: { relative: false }` in `vite.config.ts`, forcing
  absolute (`/_app/...`) paths everywhere.
- **maplibre-gl's worker never made it into the production build.**
  maplibre-gl computes its worker's URL at runtime as
  `` new URL(`./${t}`, import.meta.url) `` (a template literal, picking
  dev vs. prod filename) - Vite's static asset analysis can't follow a
  dynamic path like that, so `maplibre-gl-worker.mjs` (and the
  `maplibre-gl-shared.mjs` it itself imports) never got emitted anywhere in
  `vite build`'s output. Silent failure: the main page fetched tiles fine
  (206 Partial Content) and threw no errors anywhere a page-level listener
  could see, because the failure happened *inside the worker's own
  context* when it tried to import a file that didn't exist. Fixed with a
  `postbuild` npm script (`app/scripts/copy-maplibre-worker.mjs`) that
  copies both files from `node_modules/maplibre-gl/dist/` into
  `build/_app/immutable/chunks/` - the one directory every chunk in the
  build lives in, so the relative import resolves regardless of which
  specific chunk maplibre-gl's code ends up bundled into.

Neither bug showed up in `npm run dev` (confirmed unaffected by any of
this - still works exactly as before) or in `vite build`'s own output/exit
code. Both only surfaced by actually serving the built `build/` directory
and hard-loading a deep-linked route in a real browser - `curl` checks and
a successful build were not enough.

### Testing alternatives

**Plan:** one branch per candidate, each with just the config that
candidate needs on top of the working static build (`app/build`), pushed
so the platform's own dashboard can connect to it directly. Whichever
actually serves the app correctly with the least fighting wins; the
others get deleted.

- [x] `deploy/netlify` — `netlify.toml` at repo root: build command
  `npm run build --workspace=app`, publish directory `app/build`. No
  adapter change needed. Netlify's `_redirects` handling matches what was
  originally assumed for Cloudflare (existing files win, redirects only
  apply to unmatched paths) — so the existing `app/static/_redirects`
  works as-is, no `/map/*`-scoping workaround required there (left scoped
  anyway — costs nothing, works under either semantics).
- [x] `deploy/vercel` — `vercel.json` with explicit `buildCommand` +
  `outputDirectory`, `framework: null` (skips Vercel's SvelteKit
  auto-detection, which assumes `adapter-vercel`). Vercel doesn't read a
  `_redirects` file, so the `/map/*` SPA fallback is a `rewrites` entry in
  `vercel.json` instead.
- [x] `deploy/github-pages` — `.github/workflows/deploy-pages.yml` (the
  official `actions/deploy-pages` flow, not a `gh-pages` branch push).
  One wrinkle none of the other candidates have: project repos serve from
  a **subpath** (`user.github.io/repo-name/`), not the domain root — added
  a `BASE_PATH`-driven `paths.base` in `vite.config.ts` (empty everywhere
  else, so it's a no-op off this branch) and fixed two places
  (`geoclickMap.ts`, `tour.ts`) where the app built absolute fetch URLs by
  hand without going through `$app/paths`, which would've silently 404'd
  under a subpath deploy. Still needs, before this branch can actually be
  tested: the repo made **public** (pre-approved by the user, but only
  once this branch is confirmed as the one being kept — not before) and
  Pages enabled with source "GitHub Actions" in repo settings.
- Replit and itch.io stay out of the branch trial for now — no confirmed
  Replit account, and itch.io isn't a comparable git-integrated CD target
  anyway (see ARCHITECTURE.md).

All three branches build and pass a full local verification (type-check,
lint, and a real browser pass — click-to-highlight popup, tour controls,
zero console errors) before being pushed.

### Netlify — chosen

Live: **[geoclick.netlify.app](https://geoclick.netlify.app/)**.
`netlify.toml` merged from `deploy/netlify` into `main`; `deploy/vercel`
and `deploy/github-pages` left as-is (their prep work stays valid if
ever needed later, e.g. if Netlify's free tier stops fitting).

Two setup snags, both ordinary dashboard configuration, not platform bugs
like Cloudflare's:

- **Every request 401'd**, redirecting to a Netlify login page. Not a
  password on the site — a team-wide "private by default" **visitor
  access** setting (`requiresSSOTeamLogin`) applied to all projects on
  the team. Once the user connected Claude to Netlify directly (their own
  MCP integration), found and fixed in one call:
  `netlify-project-services-updater` → `update-visitor-access-controls`
  with `requireSSOTeamLogin: false`. Far faster than hunting through
  dashboard settings by screenshot, the way the Cloudflare fixes had to
  happen.
- **After that, everything 404'd** — the site's production branch was
  `main` (no `netlify.toml` there), not `deploy/netlify`. Build
  command/publish directory showed as "Not set" in Site configuration →
  Build & deploy, confirming `netlify.toml` was never being read. Fixed
  by setting Production branch to `deploy/netlify` directly (more
  reliable than depending on auto-discovery from the right branch).

After both fixes: build log showed `netlify.toml` correctly detected,
`npm run build --workspace=app` and the `postbuild` worker-copy script
both ran, "Site is live". Verified against the live URL, not just the
build log: all three demo maps render, click-to-highlight and tour mode
both work with zero console errors, and — the thing that actually broke
Cloudflare — `.pmtiles` requests return real `206 Partial Content` with a
correct `Content-Range` header.

## Iteration 4 — Quiz engine (`packages/quiz-engine`)

**Deliverable:** After watching a tour, you can quiz yourself on it — drag
each region's name from a tray onto the region itself; it highlights while
the slip is over it, sticks (turns green) on a correct drop, and bounces
back with a shake if wrong (an error gets recorded, try again). Once every
slip is placed, a score panel shows how many were placed correctly on the
first try and the total mistake count.

Redesigned from the original flashcard-style plan (recognition:
highlight → guess name; recall: show name → click location) into a single
drag-to-match game instead — reuses the same click/highlight
infrastructure from Iterations 2-3, just triggered by drag-hover instead
of click, and reads as more of an actual *game* than a quiz form. The
original two-direction flashcard idea isn't gone, just deferred — nothing
here blocks adding it later as a second quiz mode.

- [x] `packages/quiz-engine`: pure session/scoring logic, no UI or map
      dependency — `createQuizSession`, `attemptMatch` (records a drag
      attempt: correct match, wrong drop, or dropped outside any region —
      all three recorded as an error except the match), `isSessionComplete`,
      `scoreSession` (`{ total, perfect, totalErrors }`, where "perfect"
      means placed with zero prior errors). 10 unit tests.
- [x] `QuizView.svelte` + `/map/[mapId]/quiz` route: Pointer Events (not
      HTML5 drag-and-drop — better touch support later, and lets the drag
      continuously hit-test the map via `queryRenderedFeatures` for the
      hover highlight) drive the whole interaction. Pointer capture is set
      on the slip element at `pointerdown` and never released mid-drag —
      the slip stays the *same* DOM node throughout (repositioned via CSS
      `position: fixed`, not swapped for a separate floating element),
      since removing/replacing the captured element mid-drag silently
      drops pointer capture.
- [x] Two new map feature-states in `base.json`, alongside the existing
      `highlighted` (explore/tour): `quizHover` (neutral blue — the region
      currently under a dragged slip; deliberately not colored by
      correct/incorrect, so hovering doesn't leak the answer) and
      `quizCorrect` (green, permanent once solved — takes priority over
      the other two).
- [x] "Start quiz" link from `MapView.svelte`, alongside "Start tour".
- [x] Manual test: full drag-and-drop flow verified with Playwright
      (`page.mouse` down/move/up sequences, not just clicks) — a correct
      drag placing a target and updating the counter, a wrong drag leaving
      the count unchanged and returning the slip to the tray, and a full
      16-target run on the Germany map ending with the score panel
      showing the right numbers.

### UX refinements found by actually playing it

Four friction points reported after real play, not caught by automated
testing (drag-and-drop mechanics pass/fail correctness, they don't
surface "this feels annoying"). Registered here before implementing, per
the user's request — design decisions, not just a task list:

- [x] **Slips shuffle randomly; alphabetical is easier to scan.**
      `createQuizSession` sorts by name instead of shuffling. Verified:
      first three slips on the Italy map are Abruzzo, Basilicata, Calabria.
- [x] **Small regions are hard or impossible to drop onto.** The drop
      hit-test currently requires the exact pixel to land inside the
      polygon — fine for Texas, unreasonable for Bremen. Fix: keep
      *hover* exact (precision while exploring where you are), but give
      the final *drop* a small tolerance — if the exact point misses but
      the correct region is within `DROP_TOLERANCE_PX` of it, count it as
      a hit anyway. Only applied in favor of the *correct* target, not as
      general slop for wrong ones. The 14px first guess turned out too
      tight — Bremen's own precomputed centroid (the same point used as
      the label anchor) is ~15-20px from its own simplified polygon at
      this zoom, confirmed directly via `queryRenderedFeatures` at
      increasing radii. Retuned to 24px, which covers it with margin.
- [x] **Wrong-drop feedback is weak, and finding the slip again is
      annoying.** Two changes: (1) stronger, longer shake on the slip
      itself (bigger amplitude, 450ms → 700ms, filled red background not
      just a border), plus a brief red flash on whichever region was
      actually (wrongly) dropped on, so the mistake reads clearly in two
      places at once; (2) the slip is never disabled while this plays out
      — the pause is purely visual pacing, not a retry lockout. Explicitly
      not implementing "pin the slip somewhere easy to find" — alphabetical
      ordering (above) already gives it a fixed, predictable position, and
      that's simpler than adding a second UI concept for the same problem.
- [x] **No way out of a slip you keep failing.** New quiz-engine concept:
      a third item status, `'revealed'` (alongside `'pending'`/`'correct'`),
      reached after `MISSES_BEFORE_REVEAL` wrong drops on the
      same slip (3 then; one since v0.6.0, FT-20). It auto-solves — name shown, region colored a distinct
      muted gold rather than success-green, slip removed from the tray —
      and `scoreSession`'s `perfect` count correctly excludes it.
      `isSessionComplete` treats `'revealed'` the same as `'correct'` for
      completion purposes — a session can finish with some targets given
      up on, not just perfectly solved ones. The score panel names the
      count of revealed targets when there are any.

Threshold values (3 attempts, 24px tolerance, 700ms pause) came from one
round of hands-on testing, not rigorous tuning — still expect to revisit
if they feel off in practice.

**Follow-up fix (found after the above shipped):** dropping a slip outside
the map was being scored as a wrong attempt, since the hit-test simply
found no region under the pointer and treated "no region" the same as
"wrong region." First fix: skip `attemptMatch` entirely when the drop
point is outside the map container — no error, no wrong-flash, slip
returns to the tray untouched.

That first fix missed the actual common case, though: the tray is
`position: absolute; bottom: 0`, sitting *on top of* the bottom strip of
the map container, not below it — so dragging a slip back down onto the
tray (the natural "changed my mind" gesture) still counted as a drop
*inside* the map, and still scored as wrong. Second fix: also treat a
drop point over the tray's own bounding rect as a cancel, checked
separately from the map-container check. Verified via Playwright with a
drag that goes up into the map and back down onto the tray (not just off
the page): slip returns to the tray, no error, no wrong-flash.

Third fix, same underlying issue in a different spot: dropping anywhere
*inside* the map that isn't on or near a region — open sea, gaps between
regions, map padding — was still scored as wrong, because the drop
handler called `attemptMatch` whenever the exact/tolerance hit-test
didn't find the *correct* region, without checking whether it found *any*
region. Now a drop only counts as an attempt at all if the hit-test finds
some region (exact point or within `DROP_TOLERANCE_PX`) — otherwise it's
treated the same as the tray/outside-map cancel case: no error, slip back
to the tray. A drop that actually lands on a different (wrong) region
still counts, unchanged. Verified via Playwright: a drop confirmed via
`queryRenderedFeatures` to have no region within tolerance leaves the
placed count and tray untouched; the existing reveal-after-3-wrong-drops
test (which drops on an actual wrong region) still passes, confirming
genuine wrong guesses still count.

**Verified:** quiz-engine's 14 unit tests (including the new `'revealed'`
transition and its interaction with `scoreSession`/`isSessionComplete`),
plus Playwright against the actual drag interaction: alphabetical order
confirmed on the Italy map, Bremen's own centroid now lands successfully
(previously missed pre-fix — the exact regression this was meant to fix),
and 3 wrong drops on the same slip auto-reveal it with the muted styling
and correct tray/counter bookkeeping.

**Deliverable:** Quiz sessions now prioritize what you're about to forget
instead of a random shuffle — mistakes resurface sooner, correct answers
space out further. This is the Anki-style hook that differentiates Geoclick
from a one-off quiz.

- [ ] SM-2 scheduler implementation + unit tests
- [ ] `rate(cardId, grade) -> nextDueDate` interface
- [ ] Session composer upgrade: mix due cards + new cards (Anki-style)

## Iteration 5 — Local persistence

**Deliverable:** Close the browser tab and come back later — a map you've
played before shows its last result, and (once Iteration 6 lands) which
regions are already "discovered." No accounts, no login: everything is
keyed to the device/browser, not a user. Still the same conclusion as
ARCHITECTURE.md's Storage section reached originally, just built before
spaced repetition instead of after, since spaced repetition has nothing to
persist into otherwise.

**What gets saved**, per the design discussion before writing this section
— deliberately minimal, scoped to what Iteration 6 actually needs rather
than a general-purpose stats system:

- [x] **Per-`(mapId, targetId)` SRS card state** — the load-bearing piece:
      `easeFactor`, `interval` (days), `repetitions`, `dueDate`,
      `lastReviewedAt`. This is what Iteration 6 reads to decide which
      regions are due and writes to after each attempt. Storage and
      retrieval exist and are unit-tested now; nothing writes real values
      yet since there's no scheduler until Iteration 6.
- [x] **Per-map `lastSessionSummary`** — the `{ total, perfect,
      totalErrors }` shape `scoreSession` already produces, so a map's
      picker/detail view can show "last time: 14/20" cheaply, reusing an
      existing type rather than inventing a new one.
- [x] Explicitly **not** in scope: full session history/trend charts
      (no immediate consumer — SRS only needs current card state, not a
      log), and custom-map storage (no map editor exists yet to produce
      one — Iteration 8+).

**Implementation:**

- [x] Repository interface (`app/src/lib/progressRepository.ts`):
      `getCardStates`/`saveCardState`/`getLastSessionSummary`/
      `saveLastSessionSummary`, decoupled from the storage backend so
      swapping backends later doesn't touch call sites
- [x] `localStorage`-backed implementation
      (`createLocalStorageProgressRepository`) — this is what's actually
      deployed and testable today, unlike Tauri/SQLite which needs
      Iteration 7's desktop packaging to even run. Guards every read/write
      behind `typeof localStorage === 'undefined'` since the home page is
      prerendered (no `localStorage` at build time) — confirmed the
      production build still completes cleanly with this in place.
- [ ] SQLite implementation deferred to Iteration 7, behind the same
      repository interface — the interface is the thing that has to be
      right now, not which database backs it
- [x] Wired `QuizView`'s session completion to write back through the
      repository (`$effect` on `complete`/`score`, guarded by a
      `summarySaved` flag so it fires exactly once per completion, reset
      on restart so a replay's result overwrites rather than being
      ignored)
- [x] Home page (`app/src/routes/+page.svelte`) reads each map's
      `lastSessionSummary` on mount and shows "Last: 14/20 (2 mistakes)"
      under its link — the concrete, visible proof the data round-trips,
      not just an invisible write

**Verified:** 9 new unit tests on the repository (save/retrieve/update
card state and session summaries, per-map isolation, corrupt-data
handling) plus `svelte-check`/lint/production build all clean. End-to-end
via Playwright: completed a 16-target quiz, confirmed the exact JSON
landed in `localStorage` under the map's key, then navigated to the home
page and confirmed it rendered "Last: 16/16". A second run with one
deliberate wrong drop showed "Last: 15/16 (1 mistake)" (correct singular
wording); replaying a third time and finishing perfectly overwrote the
stored summary rather than accumulating history, confirming the
restart-resets-the-guard behavior.

**Follow-up, found by asking "what if I don't finish the map?":** the
above only persists a *completed* session. Abandon a quiz partway through
and nothing is saved — reopening it later the same day made you re-solve
everything from scratch, including regions you'd already gotten right
minutes earlier. Decided this should count as progress for the day: a
correctly-placed (or revealed) slip is now persisted immediately, not
batched until the whole map is done, and reopening the same map later the
same local calendar day shows those regions already "discovered" instead
of asking again. This deliberately stops at "today" - it's not spaced
repetition (no multi-day interval, no SM-2 grading), just a same-day
stopgap so partial progress isn't thrown away; real due-date persistence
across days is still Iteration 6's job.

- [x] New repository methods: `getTargetsSolvedToday`/
      `markTargetSolvedToday`, storing target ids under a
      `{ date, targetIds }` record per map, compared against the local
      calendar day (`getFullYear`/`getMonth`/`getDate`, not
      `toISOString()`'s UTC date - a UTC-day check would flip near
      midnight at the wrong moment for the user's actual day). A stale
      (different-day) record reads back as empty, so the tray fully
      resets the next day rather than silently carrying state forward
      with no real due-date logic behind it.
- [x] `packages/quiz-engine`'s `createQuizSession` takes an optional
      `alreadySolvedIds` set and seeds matching targets as `'correct'`
      instead of `'pending'` — the same shape Iteration 6 will reuse, just
      fed by "solved today" for now instead of real due-date logic.
      Backward compatible: omitting the argument behaves exactly as
      before.
- [x] `QuizView` reads `getTargetsSolvedToday` on load and passes it into
      `createQuizSession`; pre-solved targets get the same popup/
      feature-state treatment as a live correct drop, deferred to the
      map's `load` event (`setFeatureState` throws `"Style is not done
      loading"` if called immediately after `createMap` - caught directly
      via a failing Playwright run, not guessed at).
- [x] **Only a clean, error-free match persists as "settled for today"** —
      corrected after asking "what about regions where I made a mistake?"
      A region you fumbled on (wrong drop before eventually getting it
      right, or revealed after 3 misses) is exactly the one you need more
      practice on; letting it coast as "discovered" for the rest of the
      day would undermine the whole point. `markTargetSolvedToday` is now
      only called when `item.errors === 0`, and revealed never calls it at
      all (it always has `errors > 0` by construction). Reopening the map
      later the same day gives a fumbled or revealed target a completely
      fresh slip - 3 full attempts again, same as a target you never
      touched - while a clean first-try match stays discovered. As a
      side effect this also removes what was previously a disclosed
      simplification (a pre-solved target's `errors` inflating that day's
      `scoreSession`) — a persisted target genuinely always had 0 errors
      now, so there's nothing left to approximate.

**Verified:** 6 more unit tests (mark/retrieve, no duplicate entries,
per-map isolation, resets on a new day, local-not-UTC day boundary) plus
1 more in quiz-engine for the `alreadySolvedIds` seeding. Playwright:
solved 3 of 16 targets on a map, left without finishing, navigated away
and back to the same quiz - the 3 stayed shown as discovered (correct
feature-state, popup rendered, subtitle read "3 / 16 placed", none of the
3 reappeared in the tray), and a record from a different date is ignored
(region returns to the tray, not stuck "solved" forever). A dedicated
test then solved one target cleanly, one with a wrong attempt before
getting it right, and one revealed after 3 misses, reopened the map, and
confirmed only the clean one stayed discovered - the fumbled and
revealed ones were both back in the tray with a fresh slip. Re-ran the
full existing quiz-behavior regression suite (alphabetical order,
Bremen's drop tolerance, drop-outside-map/tray/sea not counting as
errors) to confirm none of this regressed the normal case.

## Iteration 6 — Spaced repetition (`packages/srs`)

**Deliverable:** Replaying a map you already know well is a short session
covering only what you're actually forgetting, not the whole map again —
the Anki-style hook that was the original differentiator from Seterra
(see ARCHITECTURE.md's intro). Depends on Iteration 5 for somewhere to
persist card state across sessions.

**Design, decided before implementation:**

- A quiz session is no longer "every target on the map, every time."
  Targets split into two groups using the SRS state Iteration 5 persists:
  - **Due or never reviewed** → real slips in the tray, played like today.
  - **Not due yet** → pre-marked as solved on the map (same visual/popup
    treatment as a slip you just correctly matched — "discovered"), no
    slip in the tray. On a brand-new map with no SRS history, everything
    is "never reviewed," so this is a full quiz, same as the current
    behavior — the new behavior only kicks in once you've played a map
    before.
  - `isSessionComplete`/`scoreSession` only ever look at the due subset —
    a session's score reflects what was actually tested, not the whole
    map.
- **Home page surfaces due state per map**: a map whose entire target set
  is not-due shows something like "no reviews needed" instead of a plain
  link — reachable without opening the map, since it's just reading each
  map's persisted card state and checking the max `dueDate`. A map with
  no SRS history at all (never played) is a distinct state from "fully
  reviewed, none due" — don't conflate "never touched" with "mastered."
- **Empty-queue handling**: once every target on a map is not-due, the
  due-quiz has nothing to show. Rather than leaving that as a dead end,
  add an explicit **"practice all regions"** control that ignores due
  dates and runs a full quiz regardless. This replaces "Play again" as
  the fallback once the due queue is empty, rather than being a separate
  third mode.
  - Practice mode starts from a **blank map**, same as a first-ever play
    — it does *not* inherit the due-session's "pre-mark not-due targets
    as discovered" behavior, since the whole point is re-testing
    everything, not showing what you already don't need to review.
  - Practice mode's results **do not write back to SRS state** — no
    `rate()` calls, no `dueDate` changes — at least for this first cut.
    It's there so replaying a mastered map is still possible and still
    gives you a score for that session, without that score silently
    perturbing your review schedule. (Worth reconsidering later whether
    practice performance should ever feed back in some lesser way, but
    starting with "it doesn't" is the simpler, safer default.)
- After each (non-practice) attempt, feed the result into the scheduler:
  `rate(targetId, grade) -> { easeFactor, interval, repetitions, dueDate }`
  using SM-2 (grade derived from correct-on-first-try vs. number of wrong
  attempts vs. revealed), and persist the result via Iteration 5's
  repository.

**Implementation:**

- [x] SM-2 scheduler in `packages/srs` (`rate`/`isDue`), replacing the
      `placeholder = true` stub — pure TS, unit-tested, no DOM/Svelte
      dependency. Dates are local-calendar-day strings (`YYYY-MM-DD`),
      not timestamps — matches the granularity actually needed and lets
      due-comparison stay a plain string compare.
- [x] Session-building logic turned out to need **no changes at all** to
      `packages/quiz-engine` — `createQuizSession`'s `alreadySolvedIds`
      parameter (added in Iteration 5 for the now-retired same-day
      mechanism) already does exactly what a due/not-due split needs;
      it's just fed by real due-state now instead of "solved today".
      "Due" vs. "practice" mode distinction lives as plain component
      state in `QuizView` (`mode: 'due' | 'practice'`), not a shared
      package API — nothing outside the component needs to know which
      mode a session is in.
- [x] `QuizView` changes: a `phase: 'loading' | 'upToDate' | 'quiz'`
      state machine — pre-marks not-due targets as discovered on session
      start for a due session (never for practice); "Practice all
      regions" control shown only in the `upToDate` phase, per the design
      (not a general always-available button)
- [x] Home page reads each map's due state (fetching each map's
      `map.json` for its target ids, alongside `getCardStates`) and shows
      "No reviews needed" / "N to review" / nothing (not-started maps get
      no due-status label at all, distinct from a genuinely up-to-date
      one) — alongside the existing `lastSessionSummary` display, per the
      "complementary, not a replacement" resolution
- [x] Wired attempt results to `rate()` and `saveCardState` — skipped
      entirely for practice-mode sessions (checked via `mode === 'due'`
      at the one call site)
- [ ] FSRS noted as a possible later upgrade (ARCHITECTURE.md already
      designs the scheduler interface to allow this) — not scoped now

**Consistency review against Iteration 5's actual shipped behavior**,
done before starting implementation (per the user's request to check for
contradictions/ambiguity, not just design in isolation):

- **Iteration 5's `solvedToday` mechanism is retired by this iteration,
  not kept running alongside it.** Once real `CardState`/`dueDate`
  exists, it's the single source of truth for "is this target already
  handled" — `getTargetsSolvedToday`/`markTargetSolvedToday` and their
  `QuizView` wiring get deleted as part of this iteration's work, not
  left as a second parallel mechanism. A clean win produces a
  `CardState` whose `dueDate` is tomorrow-or-later, which is a strict
  generalization of "stays discovered until the calendar day rolls
  over" — same user-visible effect, now backed by the real scheduler
  instead of a same-day-only stand-in.
- **A failed/revealed grade's resulting `dueDate` must still land
  same-day (`<= now`), not get pushed to tomorrow by a naive
  "minimum interval = 1 day" implementation.** This is the one place a
  literal SM-2 port could silently regress behavior the user explicitly
  asked for and that's already shipped and tested: a fumbled or revealed
  target has to keep resurfacing as a due slip if you reopen the map
  later the same day, exactly like it does today. Whatever the SM-2
  implementation does for an "again" grade, verify the resulting
  due-comparison (`dueDate <= now`) actually holds true within the same
  day for a fresh failure, not just "the next calendar day" — test this
  explicitly, don't assume the algorithm gets it right by default.
- **Every attempt writes real `CardState` now, including fumbled and
  revealed ones** — a change from Iteration 5, where a mistake wrote
  nothing at all. That wasn't a permanent principle, just a stopgap for
  the gap between "have a session-seeding mechanism" and "have a real
  scheduler to feed" — there was nothing meaningful to persist for a
  failure without SM-2 math to produce a real interval. Iteration 6 is
  exactly that scheduler, so failures should persist real state, same as
  successes.
- **Concrete grade mapping**, since "grade derived from correct-on-
  first-try vs. wrong attempts vs. revealed" was left vague: `errors ===
  0` on a correct match → a "good" grade; correct but `errors > 0` →
  "hard"; `revealed` → "again" (SM-2's fail grade — resets `repetitions`,
  short interval). Pick the actual SM-2 grade constants during
  implementation, but the three-way mapping itself shouldn't be
  reinvented then.
- **Resolved: "hard" graduates normally (due tomorrow-or-later), it does
  not stay a same-day repeat like "again."** Asked explicitly rather than
  assumed, since it's a real fork: strict "any mistake means more
  practice today" (matching Iteration 5's same-day rule to the letter)
  vs. standard spaced-repetition semantics, where eventually getting it
  right still counts as a pass. Decided on the latter — "hard" still
  advances past the "learning" phase, it just builds a weaker interval
  and lower ease factor than "good" would, so it comes back sooner than
  a region you nailed first try, but not literally later the same day.
  Only "again"/revealed is the same-day-forced exception.
- **The home page's due-state indicator and Iteration 5's
  `lastSessionSummary` display are complementary, not a replacement.**
  One answers "what's outstanding right now," the other "how did the
  last sitting go" — both stay visible.
- **Invariant carried forward from Iteration 5, still holds**: anything
  pre-marked `'correct'` when a session is created only ever comes from
  a target that was genuinely graded well (not-due only happens after a
  "good"/"hard" grade, never after "again") — so the pre-solved bucket
  never silently inflates a session's perfect count with something that
  wasn't actually solved cleanly, same guarantee Iteration 5 already
  established for same-day persistence.

**Verified:** 12 unit tests on `packages/srs` (due-comparison at each
boundary; first-review scheduling for all three grades; a run of "good"
reviews growing the interval; "hard" producing a shorter interval and
lower ease factor than "good" at the same point; "again" resetting
repetitions and clamping the ease factor floor even after repeated
failures). `svelte-check`/lint/production build all clean — the build
matters specifically because the home page now fetches each map's
`map.json` to compute due counts, on top of the existing prerender/
`localStorage` guard concern from Iteration 5.

Playwright, end to end: a brand-new map behaves exactly like before this
iteration (full quiz, nothing pre-marked) — the "never reviewed = due"
default makes this fall out naturally, not a special case. Solved one
region cleanly and one only after a wrong drop ("hard"), then confirmed
both graduated to a real `CardState` with a future `dueDate` and both
showed pre-marked discovered on reopening the same day — a genuine
behavior change from Iteration 5, where "hard" used to persist nothing
and would've reappeared as a slip; now a recovered mistake counts as a
pass, matching the "hard graduates normally" decision. Separately
confirmed a revealed target's `dueDate` lands on `today` and it's still
offered as a slip on reopening, per the same-day-repeat requirement.
Solved every target on a map (mixing clean and fumbled attempts) and
confirmed reopening it the same day showed the "Up to date!" panel with
zero slips — the whole map having graduated in one pass, not a bug.
Clicked "Practice all regions" from that state and confirmed: every
target starts as a blank slip (no pre-marked regions, unlike a due
session), the header reads "(practice)", and solving a target inside
practice mode left every stored `CardState` byte-for-byte unchanged —
confirms the "practice never touches SRS state" rule holds in practice,
not just on paper. Home page: seeded one map never-played, one fully
graduated, and one half-due, and confirmed the three read as no
due-status label, "No reviews needed", and "N to review" respectively.
Re-ran the full pre-existing quiz-behavior regression suite (alphabetical
order, Bremen's drop tolerance, drop-outside-map/tray/sea not counting as
errors) to confirm none of this regressed the base drag-and-drop
mechanics.

**Follow-up, found by actually finishing a map:** the "Done!" score panel
always showed "Play again", even when finishing the session had just
graduated the whole map — clicking it immediately bounced to the
"Up to date!" screen, which reads as broken rather than as the intended
behavior. The panel now checks, right when the session completes,
whether anything is still due:

- **Something's still due** (typically a revealed target, which stays
  due the same day by design) — panel reads "Done!", "Play again" stays
  accurate, and clicking it rebuilds a due session with just what's
  still outstanding. Verified: revealed one target on purpose, confirmed
  the panel did *not* claim "All caught up", and that clicking
  "Play again" offered exactly that one target, not the whole map again.
- **Nothing's left due** — panel reads "All caught up!" with a real
  "Next review in N days" (computed from the soonest `dueDate` across
  the map's targets — `packages/srs`'s new `daysUntil` helper), and
  "Play again" is replaced with "Back to maps" (primary) and
  "Practice all regions" (secondary) — no button that implies replaying
  the same thing, since there's nothing left to replay. Verified:
  finished a map with only clean solves, confirmed "All caught up!" plus
  "Next review in 1 day." (correct for a first-ever review), and that no
  "Play again" button was rendered at all.
- Same underlying issue existed for practice mode's "Play again", one
  level removed: since practice never changes due-state, clicking it
  used to re-run the due check and land back on the "Up to date!"
  screen instead of another practice round — technically correct, but
  an unnecessary extra click for something that obviously wasn't going
  to have changed. "Play again" after a practice session now starts
  another practice round directly. Verified: finished a practice
  session, clicked "Play again", confirmed it went straight into a
  fresh full practice session rather than back to "Up to date!".

Caught one dev-environment red herring worth recording so it doesn't get
mistaken for a real bug again: a very long-lived Vite dev server (many
edits across this session) served a stale HMR-patched version of
`createQuizSession`'s pre-marking logic for a while, making a correct
`notDueIds` set produce a session with everything still pending. A
clean dev server restart (and clearing `node_modules/.vite`) fixed it
immediately — the underlying code was correct throughout, confirmed via
temporary debug logging before concluding this, not just assumed.

## Iteration 7 — Desktop POC packaging (milestone)

**Deliverable:** A double-click-to-install desktop app containing all six
demo maps, with working tour, quiz, and persistent progress. This is the
thing you hand someone to try. **The POC milestone.**

- [x] Tauri project wrapping `/app` — `desktop/src-tauri`, `app/build`
      bundled unmodified via `beforeBuildCommand`, no separate desktop-only
      frontend code
- [x] Bundle PMTiles + `map.json` assets into the app — confirmed by
      launching the actual release binary and browsing to a map; all six
      demo maps load and render (see screenshot evidence below)
- [x] Wire local SQLite storage plugin — `tauri-plugin-sql`, schema in
      `desktop/src-tauri/src/lib.rs`'s `migrations()`, a new
      `sqliteProgressRepository.ts` picked automatically by
      `createProgressRepository()`'s `isTauri()` check
- [x] Build a local installer — `.deb`, `.rpm`, and `.AppImage` all built
      successfully via `tauri build`
- [x] End-to-end run: tour → quiz → close app → reopen → progress
      persisted — **now fully verified**, closing the one gap left open
      from the Linux dev sandbox (see "Follow-up, native Windows
      verification" below). Confirmed directly in that sandbox: the
      release binary boots, renders all six maps with working WebGL
      (MapLibre), and a guided tour autoplays correctly through real data
      (110 provinces); `geoclick.db` is created and migrated on first
      launch, and the exact upsert SQL `sqliteProgressRepository.ts` sends
      round-trips correctly against that schema. The one thing that
      sandbox couldn't reach — an actual quiz answer's click/drag
      triggering a live write, through the real UI, confirmed by closing
      and reopening the app — was click-tested on the user's own Windows
      machine and confirmed working.
- [x] **This is the POC deliverable** — demo-able artifact, approved by
      the user for merge after native Windows testing. See "Follow-up"
      below for the Linux build/verification narrative and the WSLg
      gotchas, and "Follow-up, native Windows verification" for the two
      Windows-specific bugs found and fixed.

**Follow-up, build/verification narrative:** installed the Rust toolchain
and Tauri's Linux system dependencies (webkit2gtk, GTK, appindicator) from
scratch in this dev environment — none of it was present before. Scaffolded
`desktop/` as a new npm workspace holding `src-tauri` (Tauri init, not a
hand-rolled Cargo project). Two non-obvious fixes along the way, both now
in ONBOARDING.md so they don't cost time again: `tauri.conf.json`'s
`beforeBuildCommand` runs relative to wherever `tauri build` is invoked
from (`desktop/`), not `src-tauri/` as might be assumed; and the identifier
shouldn't end in `.app` (conflicts with the macOS bundle extension).
Getting the app to actually render on this WSL2/WSLg dev box needed two
more fixes, both found by testing the real built binary rather than
guessed: `WEBKIT_DISABLE_DMABUF_RENDERER=1` (without it the binary exits
immediately, no error) and explicitly *not* forcing
`LIBGL_ALWAYS_SOFTWARE=1` (that disables WSLg's real GPU passthrough
driver and produces a window that opens but never paints anything — found
by comparing a blank render against one with real content after removing
that flag). Neither should be needed on real hardware or a native Linux
desktop. Full test/check/build/lint suite (41 tests) stayed clean
throughout — this was pure addition (a new workspace, a new repository
implementation behind an already-generic interface), no changes to
existing app code paths for the browser build.

**Follow-up, native Windows verification:** built and installed the
`.msi`/`.exe` on real Windows hardware for the first time — two
Windows-specific bugs found and fixed, both now in ONBOARDING.md's
"Gotchas" section:

- **`app/static/maps`/`app/static/styles` symlinks don't survive a
  default Git-for-Windows checkout** — they became tiny text files
  containing the literal target path instead of real directories,
  breaking every map. Fixed at the time via Windows Developer Mode +
  `git config --global core.symlinks true` + a fresh clone (an existing
  checkout doesn't self-heal). **Superseded by FT-58 (v0.9.4):** the paths
  are no longer committed; the build prepares them itself and fails if they
  are missing.
- **`.pmtiles`/icon binaries had no `.gitattributes`, so a Windows
  checkout with `core.autocrlf=true` silently corrupted them** — region
  name labels (from `map.json`, via DOM popups) rendered fine, but no
  polygon fills, outlines, or lake water showed at all, since those come
  from the tiles. Fixed with a `.gitattributes` (`*.pmtiles binary`, plus
  icon formats); confirmed after adding it that the already-checked-out
  files matched their git-stored bytes exactly (`git add --renormalize
  .` + a forced `git checkout HEAD --` on the affected paths changed
  nothing further), and that map rendering was restored end-to-end in
  both the Tauri dev window and the plain browser build.

With both fixed, the user completed the one verification step the Linux
sandbox couldn't reach: played part of a quiz in the installed desktop
app, closed it, and reopened it, confirming progress actually persisted
via a real SQLite write. Approved for merge to `main`.

---

## Iteration 8+ — Post-POC (not yet scoped in detail)

**Deliverable:** to be scoped once the POC validates that the tour → quiz
loop actually feels good. Candidates below, in rough priority order.

- [ ] **Six UX problems found playing on a tablet, raised 2026-09-20,
      decided the same day — now in v0.10.0 as FT-60 to FT-65 (2026-09-23).** One round of
      real play on a tablet, `germany-towns-100k` first: the same kind of
      feedback that produced Iteration 4's "UX refinements found by
      actually playing it", and recorded the same way — before
      implementing, because half of them were design questions rather
      than bugs. Those questions have since been answered by the product
      owner and the answers are in each entry below, marked with their
      date. Nothing here is scoped or estimated yet; what each one should
      do is now settled.

      - **A first round lays every name in the tray at once, and that is
        overwhelming.** *(Done as FT-60, PR #22: the level-0 hand holds
        10, the product owner's number, 2026-09-23. The entry below is
        the problem as raised.)* By design, not by accident: `HAND_SIZES[0]` is
        `Infinity` (`app/src/lib/difficulty.ts:21`), so a map at level 0 —
        one never played — offers all of it, 49 slips on
        `germany-towns-100k` and 110 on `italy-provinces`. The hand only
        starts shrinking (6 → 3 → 1) once a quarter of the map is known,
        which is precisely the point at which the player no longer needs
        the help. FT-21 introduced the hand to stop the *endgame* being
        solved by elimination; nobody asked what the *opening* should
        feel like, and the curve's own comment says it was a first guess.
        The fix is a finite level-0 hand; the one open question is what
        the number is — the level-1 hand of 6 is the obvious candidate,
        though that would leave level 0 and level 1 differing only in
        which names get picked. A capped tray needs no new "you are 12 of
        49 in" indicator: `quiz.subtitle` already puts placed-of-total in
        the nav on every round. Note this is about the tray, not the map:
        the quiz map starts bare and only names what has been resolved,
        so the tray is the one thing that shows everything at once.
      - **Drag and drop fights the tablet, because a slip is text.** A
        slip is a `<button>` with a text node in it
        (`app/src/lib/QuizView.svelte:813`), dragged with pointer events
        and `setPointerCapture`. It sets `touch-action: none`, but
        nothing in the app sets `user-select`/`-webkit-user-select`/
        `-webkit-touch-callout` on it, and nothing anywhere handles
        `pointercancel` — so a press that the tablet decides is a
        text-selection gesture raises the native selection and copy UI,
        takes the pointer stream away mid-drag, and the drop never
        arrives. That is the most likely cause of what was reported ("the
        tablet wants to copy") and it should be confirmed on the actual
        device before anything is built, because it makes the difference
        between a three-line CSS fix plus a `pointercancel` handler that
        returns the slip to the tray, and the product owner's own
        suggestion — make the slip a drawn image rather than text. The
        CSS route is tried first: an image slip loses selectable,
        translatable, screen-reader-readable place names, which the
        language work (PLAN_V0.10.md) will care about.
      - **The fact card during the quiz distracts — decided 2026-09-20:
        a fact only on a name the player could not place.** The card
        appears after every resolved name
        (`app/src/lib/QuizView.svelte:72-76`, FT-35), which is the moment
        the player is reaching for the next slip; a sentence about the
        name's origin arriving there competes with the round instead of
        adding to it. v0.9.2 had already cut the card back to what the
        map cannot show (FT-45), so the content was never the problem —
        the timing was. The rule: show it only when the name was *not*
        answered correctly. One miss reveals a name (FT-20), so that is
        exactly `status === 'revealed'` — a correct drop now says
        nothing, a given-up one still teaches, and the fact lands at the
        one moment the player has a reason to read it. No product
        question left; the only judgement call in implementing it is
        whether the card keeps its current dwell time once it appears
        this much more rarely.
      - **Label placement takes the first free spot, not the best one —
        decided 2026-09-20: best fit is a requirement, not the cheap half
        of one.** `candidatesFor` (`app/src/lib/labelCollision.ts:169`)
        offers a town's name four fixed spots in a fixed order — right,
        left, above, below — and `choosePlacements` takes the first that
        does not overlap a label already placed. Nothing else counts. So
        Duisburg's name goes east, over Essen, while the empty water and
        countryside to its west go unused: Essen's *dot* is not a
        rectangle the pass knows about, and neither is any region
        underneath. Shipping only the small fix (count every target's dot
        as an obstacle, which alone would have moved Duisburg) is ruled
        out — a name has to go where there is the most room, so first-fit
        becomes a search. Three things together: every dot becomes an
        obstacle, not just the label's own; the candidate set widens past
        four compass points; and each candidate is *scored* — room around
        it, distance to the nearest other anchor and dot, how much of it
        sits over empty background rather than over a neighbour — with
        the best score taken instead of the first fit. The cost function
        is the actual work, and the part to get right before any tuning:
        it has to be explainable ("this name went west because the east
        was full"), cheap enough to run on every map move for 110 labels,
        and stable, so that a one-pixel pan does not send the whole map's
        names jumping. The greedy pass in priority order stays the shape;
        what changes is what each step optimizes. Stays inside the
        DOM-popup approach — see DECISIONS.md, "Names never overlap".
        **Built as FT-63** (v0.10.0): eight spots, a pixel score, every
        dot an obstacle, a stay bonus only while the map moves.
      - **A region's name sits in its middle; it should stretch along the
        region, as in Europa Universalis — a spike first, agreed
        2026-09-20.** Today a region label has exactly one anchor — the
        precomputed centroid — and three candidates, all on the same
        vertical line
        (`app/src/lib/labelCollision.ts:194`). A name centred in a blob
        reads as a pin, not as a territory; EU4 spaces and curves the
        letters along the shape's long axis, which is what makes a map
        look like a map. This is the most expensive of the six and the
        least certain: DOM popups cannot letterspace along a curve, so it
        means either an SVG overlay with `textPath` (keeps the offline
        story, keeps the magnify and the rem sizing, needs a spine
        computed per region and kept in sync with every map move) or a
        MapLibre symbol layer with `symbol-placement: line`, which
        collides natively but would mean vendoring a glyph stack to stay
        offline and giving up FT-02/FT-03's magnify. It starts as a
        spike, not a planned task: draw one region's name along a
        computed spine, on a real map, at real zoom levels, and see
        whether it reads — before anything is estimated or scheduled. It
        is decided *against* the placement work above rather than
        alongside it, since that pass scores rectangles and a stretched
        name is not one. **Spiked as FT-64 (2026-09-23): it reads** — an
        SVG `textPath` over a build-time spine, the pill where a name does
        not fit; follow-up FT-66, scheduled before FT-50. See DECISIONS.md, "Region names
        along the region".
      - **Replace the map card's "{known} / {total} known" with a
        progress bar — decided 2026-09-20, the map list only.** The line
        shows in two places, and only the map list's copy goes:
        `home.known` on every card of the home page
        (`app/src/routes/+page.svelte:145`). The score panel's
        `quiz.known` **stays** — the two record different things, the
        card a map's standing and the popup what the round just played
        left behind, and they should stop being written as one statement.
        Note for whoever implements it: `QuizView.svelte:751` currently
        comments the opposite ("the same line the map list shows, so
        finishing here and going back tell the same story", FT-26), and
        that comment is now wrong — amend it rather than leave it to be
        found first. In the card's place, a progress bar, **and only when
        there is progress to show**: a bar sitting at zero is worse than
        the number it replaced. Today `mastery` is already `undefined`
        for a map with no card states at all (`+page.svelte:92`), so a
        never-played map shows nothing — the case the bar has to handle
        is a map that *has* been played but has no name at a clean streak
        of 3 yet, which reads `0 / 49 known` today. The bar is
        `knownCount / total` — the same number the line showed, drawn
        instead of written — and it is hidden at zero, so that map shows
        nothing until its first name is actually known. Nothing
        finer-grained: a bar that creeps on partial streaks would be
        measuring something the word "known" does not mean. Untouched:
        the round's own `{placed} / {total}` subtitle
        (`quiz.subtitle`), and `retention.known`, which is the Known
        map's own label, a different thing that happens to share the
        word.

- [ ] **The start screen becomes a zoomable world map, raised
      2026-09-20.** The map list as it stands cannot be finalized — it is
      a holding shape, not the design. `app/src/lib/mapCatalog.ts` is a
      hand-written catalog of 31 countries and 66 maps, rendered by
      `app/src/routes/+page.svelte` as alphabetical country groups, and it
      already scrolls off a tablet screen. The goal is a *high* number of
      maps, at which an alphabetical list stops being a way to find
      anything. So the app opens instead on a zoomable world map: travel
      to the country you want, pick it, then choose the kind of quiz it
      offers. **Favourites and Recent stay exactly as they are** — they
      are the shortcut past the picker, and were asked for unchanged.
      Not scoped; what wants thinking about first:
      - **What the world map is made of.** Geoclick already has a pmtiles
        pipeline and a MapLibre viewer, and a world-countries polygon map
        is another `build-map.ts` output — so the picker could be an
        ordinary Geoclick map whose targets are countries that navigate
        instead of being quiz answers. That reuse is the attraction and
        it should be confirmed early, because the alternative (a bespoke
        globe, or an SVG world) is a second rendering stack to keep
        working offline on three platforms.
      - **Countries with no map yet.** At 31 of ~200, most of the world is
        empty. The picker has to show that without looking broken, and it
        should be the one place that grows cheaply: a country gaining a
        map becomes a catalog entry, not a layout change.
      - **Where the map-type choice lives** for a country with more than
        one map — a second screen, a panel on the picker, or the
        country's existing map-scoped landing page, which already does
        most of that job today.
      - **Every other way into a map keeps working.** Deep links
        (`/map/<id>`), the tutorial, Favourites and Recent all address
        maps by id; the picker is a new front door, not a replacement for
        the addressing underneath it.
      - **Offline size.** A world basemap is more tile data in the
        desktop and Android bundles — worth measuring against the current
        bundle before it is designed in, not after.
- [ ] **Four new feature requests, raised 2026-09-13, not yet scoped into
      tasks** — see [docs/FEATURE_BACKLOG.md](docs/FEATURE_BACKLOG.md) for
      the full writeup of each: (1) public distribution of the desktop
      installer and Android APK, including the private-repo/GitHub-Releases
      access problem and the options for it; (2) real app logos for the
      desktop and mobile shells (currently default scaffold icons); (3) an
      interactive, multi-language, click-through in-app tutorial; (4) an
      accessibility fix/feature for region and town names being too small to
      read on the map, with no size control today. Deliberately kept separate
      from the remediation programme above (that one fixes the Sept 13
      review's findings; this is new product work) — a future planning pass
      turns this backlog into its own task list the same way the review
      became `docs/tasks.yaml`.
- [ ] **Self-serve map-authoring pipeline** — right now, adding a new map
      means running `data/scripts/build-map.ts` by hand and knowing its
      quirks: per-country name fixes are a hardcoded table in the script
      (`NAME_FIXUPS`) that needs a code edit for each new country's
      quirks, the `pmtiles` binary is invoked from a hardcoded local
      path, and the output always needs manual curation afterward (tour
      order, aliases). None of that is reasonable to ask of someone who
      isn't already deep in this codebase — the goal is a PM (or the
      hypothetical junior dev from ONBOARDING.md) generating a usable new
      map solo, without going through Claude each time.
      - **Point-geometry targets (towns/cities)**, not just finer
        polygons, was the real open design question here — **built**,
        not just designed: `italy-towns-100k`/`germany-towns-100k`
        ship with a new `targets-circle` style layer, a separate
        `build-points-map.ts` script, and `Target.type` alone (no new
        map-level field) distinguishing point maps from polygon ones.
        See [MAPS.md](MAPS.md)'s "Point-target implementation" section
        for the full detail, including two real bugs found only by
        testing the actual built maps (tippecanoe silently drops most
        points at low zoom by default; the polygon tolerance
        mechanism's "is the name present nearby" check breaks down for
        city clusters closer together than the tolerance radius
        itself) that weren't anticipated at design time. This item's
        blocker is resolved, not just this specific pair of maps.
      - **Remove the manual-curation dependency on Claude**, or at least
        shrink it: replace the hardcoded `NAME_FIXUPS` table with
        something data-driven (a per-country config file, not a code
        edit — MAPS.md's provinces plan already found a second case that
        needs this, Italian province names), make the `pmtiles` binary
        path configurable/discoverable instead of hardcoded, and get the
        default tour order/aliases output to a state that's usable as-is
        rather than expected to be hand-tuned afterward.
      Sequencing note: this is a natural prerequisite to "Map editor UI"
      below, not a replacement for it — this produces the raw map
      package, the editor is for curating/tweaking one afterward.
- [ ] Map editor UI (author maps/tours without hand-editing JSON)
- [x] **Android packaging via Capacitor (POC), built on
      `feature/capacitor-android`, merged to `main` 2026-09-12.** Same "wrap the shared web core"
      strategy as Iteration 7. Scaffolded so far: new `mobile/` npm
      workspace (`mobile/capacitor.config.ts`, `webDir: '../app/build'`,
      mirroring `desktop/src-tauri/tauri.conf.json`'s `frontendDist`),
      native project generated via `npx cap add android`
      (`mobile/android/`, committed like `desktop/src-tauri/` is — not
      regenerated like `node_modules`), and a third `ProgressRepository`
      implementation (`app/src/lib/capacitorProgressRepository.ts`) via
      `@capacitor-community/sqlite`, same `card_states`/
      `last_session_summaries` schema as the Tauri one, picked by
      `createProgressRepository()` via `Capacitor.isNativePlatform()`.
      Verified so far: full type-check/test/build suite stays clean, and
      `npm run sync` (from `mobile/`) correctly copies all six maps'
      real `.pmtiles`/`map.json` data (not broken symlinks) into
      `android/app/src/main/assets/public` — confirmed directly on this
      Windows machine, so the same symlink/`.gitattributes` fixes from
      Iteration 7 already cover this path too. Also added `*.jar binary`
      to `.gitattributes` pre-emptively, since `gradle-wrapper.jar` is
      the same class of binary-corruption risk `.pmtiles` already hit
      once.

      **Emulator run, first real bug found and fixed:** installed Android
      Studio (bundled JDK was 25, too new for this project's Gradle
      8.14.3 — Gradle 9.1+ is needed for Java 25, which would also force
      an Android Gradle Plugin bump not worth chasing right now; fixed by
      picking the other, already-available JDK 21 in Android Studio's own
      Gradle JDK setting, no separate install needed), created an AVD,
      and ran the app — maps opened showing region name labels but no
      polygon fills/outlines/lake water, the *exact same symptom* as
      Iteration 7's Windows `.gitattributes` bug but a genuinely different
      cause this time (confirmed via `adb logcat`, not assumed): Android's
      Capacitor WebView local asset server doesn't support HTTP
      `206 Partial Content` responses for arbitrary file extensions — a
      known, still-open upstream limitation
      ([ionic-team/capacitor#7664](https://github.com/ionic-team/capacitor/issues/7664))
      — so pmtiles' normal range-request-based `FetchSource` never gets
      real tile bytes back, even though the identical bundled file
      renders fine in the browser/Tauri builds. Fixed in
      `app/src/lib/geoclickMap.ts`: since these demo maps are all under
      1MB, fetch each `.pmtiles` archive once as a plain full `GET`
      (which Capacitor serves correctly) and register a custom in-memory
      `pmtiles.Source` (`ArrayBufferSource`, pre-registered on the shared
      `Protocol` via its documented `.add()`/`.get()` API) that serves
      pmtiles' byte-range reads out of that buffer instead of over HTTP —
      only on native Capacitor (`Capacitor.isNativePlatform()`), so the
      already-verified browser/Tauri range-request path is untouched.
      Verified: full type-check/test/build suite stays clean; screenshot
      of `italy-regions` on the emulator after the fix shows correct
      polygon fills/outlines/coastline (matching desktop/browser); `adb
      logcat` confirms the earlier repeating error tied to every
      `tiles.pmtiles` request is gone, with only benign info-level
      SQLite-plugin debug logging remaining.

      **Real-device verification:** sent a debug APK build directly to
      the user (rather than requiring USB debugging/adb) for a true
      hands-on test on their own Android phone, matching the desktop
      approval flow. Confirmed working: map rendering, and — the one
      thing this dev sandbox could never reach — an actual quiz answer's
      SQLite write surviving a real app close/reopen. Feedback from that
      pass: the UI's widget sizing needs work, correctly deferred to the
      already-planned GUI/UX evaluation iteration rather than fixed here.
      Approved for merge to `main`.

      Distribution, roughly in order: a sideloaded
      signed APK first (free, immediate, good enough for portfolio
      demoing); a Google Play Console account ($25 one-time) with the
      **Internal Testing** track if a shareable "real install" link is
      wanted without public review; full public Play Store listing only
      if actual discoverability matters, which brings an ongoing
      maintenance cost (Google periodically bumps the minimum
      `targetSdkVersion` apps must meet to stay installable). iOS is a
      separate, later item — it hard-requires a Mac with Xcode (an Apple
      platform restriction, not a tooling choice) plus a $99/year
      developer account for anything beyond your own device, so it's
      blocked on hardware/account setup this project doesn't have yet.
- [x] ~~Plain-browser deployment (static hosting)~~ — done in Iteration 3.5,
      live on Netlify
- [ ] **Optional sign-in (SSO) so scores sync across devices — provider
      decided (Supabase), scaffolded and reconciled with `main` on
      `feature/supabase-sso-sync`, but explicitly PAUSED, not being
      pursued right now.** Requested directly by the user (2026-09-12),
      as the third of three roadmap items alongside the map-list
      reorganization and i18n below; the user confirmed Supabase as the
      auth/backend choice the same day, and asked to resume it again on
      2026-09-13. Built so far: a Supabase client (graceful no-op when
      unconfigured), a multi-user Postgres schema with row-level
      security, a `supabaseProgressRepository.ts`, a Google sign-in
      control, and a sync layer (push local progress up on first
      sign-in, prefer remote thereafter) — see DECISIONS.md's
      "Cross-device sync (Supabase)" entry. The branch was brought fully
      up to date with `main` (four intervening merges) and verified
      clean (`svelte-check`, i18n gap in `AccountStatus.svelte` fixed) as
      of commit `f8fa986`. **Deferred 2026-09-13** — the user decided it
      doesn't make sense to finish this before there's a concrete plan
      to buy a domain, go public, and publish to an app store; see
      DECISIONS.md's "SSO/cross-device sync deferred" entry for the full
      reasoning. The branch is being kept (not deleted, not merged) so
      this work isn't lost — pick it up once those business milestones
      are actually being planned. Until then this item is off the
      active roadmap.
- [ ] **Score recording/sync**, built on top of sign-in above: per (user,
      map) results from quiz sessions (`scoreSession`'s `{ total, perfect,
      totalErrors }` already has the shape this needs), persisted
      somewhere durable and synced across a signed-in user's devices,
      rather than local-only. Scaffolded together with sign-in above on
      the same branch — see that entry. **Paused for the same reason.**
- [x] **Visual refresh: background color** — requested directly by the
      user (2026-09-13): "the background color is kind of meh, maybe
      something more captivating." Built on `feature/better-background`:
      the map's ocean/empty-space fill moved from flat gray (`#eef3f6`)
      to a warm parchment tone (`#f0ead9`), and the home page moved from
      plain white to a soft three-stop sage/blue/cream gradient. A richer
      blue was tried for the map background first and rejected after
      actually looking at it — it nearly erased the lakes layer's own
      blue accent, undoing GUI/UX round 1's lake-contrast fix. See
      DECISIONS.md's "Visual refresh: background" entry for the full
      before/after reasoning, including verification against the full
      8-color categorical palette and a towns map's `context` layer.
      **Follow-up found immediately after** ("looking at the quiz the
      color scheme is confusing, I do not know which regions have been
      recognized or not"): the background's own lower opacity made an
      existing latent issue visible - one of the 8 categorical colors is
      a muted teal-green close to the solved-state green. Fixed on
      `feature/quiz-solved-contrast` by making `fill-opacity`/
      `circle-opacity` state-dependent (low for unsolved, high for any
      solved/interacted state) so saturation itself signals progress,
      not just hue - see DECISIONS.md's "Quiz solved-state contrast"
      entry.
- [x] **More countries: China, Brazil, Mexico, Finland, Russia, India,
      Indonesia, Argentina** — requested directly by the user
      (2026-09-13), built on `feature/add-eight-countries-adaptive-threshold`
      following the same regions+towns pattern and rigor as every prior
      batch (full attribute audits — all 86 raw Russian regions, the
      top-50-by-population towns per large country, not spot-checked).
      The most name-fixup-heavy batch yet, and it surfaced a real
      Natural Earth data bug (exact-duplicate populated-place rows,
      fixed with a general dedup step) — see MAPS.md's dated section and
      DECISIONS.md for every specific fixup/exclusion and the reasoning
      behind each, including how Russia's Crimea/Sevastopol exclusion
      and India's Kashmir/Ladakh inclusion were each decided for
      consistency with (respectively, contrast with) the earlier Ukraine
      decision.
      - **Design question raised alongside this request — resolved**:
        the towns maps' fixed `>100k population` threshold didn't scale
        to this batch's range (Finland: 4 towns clear it; China: 317).
        `build-points-map.ts` gained `--min-count`/`--max-count` flags
        (both no-ops at their defaults, so every existing towns map is
        unaffected unless explicitly rebuilt) — see MAPS.md's "Adaptive
        town selection" section for the exact mechanism and which
        countries needed which flag.
- [ ] **Retest on desktop and mobile after the above iterations land** —
      requested directly by the user (2026-09-13), originally scoped to
      run once the new-countries batch, the population-threshold rework,
      and SSO were all finished; picked up right after SSO was deferred
      (above) rather than waiting on it, since SSO isn't part of either
      native build's dependency surface. Re-verify the desktop (Tauri)
      and Android (Capacitor) builds still work end to end (not just the
      web app), per the existing "test locally vs. test the deployment,
      as two separate steps" habit (see CLAUDE.md) — a bigger map catalog
      (44 map folders now, up from 6 at Iteration 7/8's original build)
      is exactly the kind of change that could regress a platform-specific
      build without showing up in the web dev server.
      **Rebuild done and smoke-tested 2026-09-13**: `npm run build
      --workspace=app` picked up the full current `main` (background/
      quiz-contrast visual refresh, i18n, map-list reorg, all 14
      countries); `desktop`'s `tauri build` compiled clean and produced
      both `Geoclick_0.1.0_x64_en-US.msi` and `Geoclick_0.1.0_x64-setup.exe`,
      and the built `app.exe` launches and stays running (checked via
      `tasklist`, not just a clean exit code). `mobile`'s `cap sync`
      copied all 44 map folders into `android/app/src/main/assets/public`
      with real-sized `.pmtiles` (not the corrupted-symlink/CRLF failure
      modes from ONBOARDING.md's Gotchas section), and a debug APK built
      successfully via a direct `gradlew assembleDebug` — see
      ONBOARDING.md's new "Headless debug-APK build" note for the JDK
      workaround this needed (Android Studio's bundled JBR is JDK 25,
      too new for this project's Gradle wrapper; its own JDK 21 cache
      under `~/.jdks` works). **Still needed, and only doable by the
      user**: actually clicking through both installed apps — no
      real-device/emulator was connected this session to `adb install`
      the APK, and a native window's UI can't be driven the way the
      Chrome/Playwright checks used elsewhere in this project can.
- [x] **Reorganize the home page's map list** — requested directly by the
      user (2026-09-12), alongside i18n and optional SSO above. 28 maps
      across 14 countries in one flat, unsorted `<ul>`
      (`app/src/routes/+page.svelte`'s `demoMaps` array, in the order each
      country was added) was already hard to scan and would only get worse
      as more countries are added. Built as a `mapGroups` array — one
      entry per country, alphabetical by country name, each country's own
      maps (regions/provinces/towns, a trio for Italy) alphabetical by
      label — rendered as a heading per country followed by that
      country's map links, 2 columns on wider screens via CSS grid (single
      column below the existing 640px breakpoint used elsewhere, e.g.
      `MapNav.svelte`), collapsing to one column at phone width. Per-map
      due-status/last-result badges untouched — same `dueStatuses`/
      `lastSessions` state and `onMount` data-loading loop as before, just
      fed by a flattened view of `mapGroups`
      (`mapGroups.flatMap((g) => g.maps)`) instead of a hand-written id
      list. See DECISIONS.md for why grouping was chosen over a flat
      alphabetical list. Merged to `main`.
- [x] **Add German and Italian as UI languages** (at least) — requested
      directly by the user (2026-09-12), alongside map-list reorganization
      and optional SSO above. Scoped to the app's own UI chrome (nav
      labels, buttons, status text) via a language switcher — explicitly
      **not** translating map/target names themselves (those are real
      geographic proper nouns already localized per-country through
      `NAME_FIXUPS`/`--name-field`, a different and already-solved
      problem, see MAPS.md). Picked up as parallel background work in its
      own worktree/branch (`feature/i18n-de-it`) — see DECISIONS.md's
      "Internationalization (i18n)" entry for which approach was chosen
      and why. Built as a small hand-rolled dictionary + `t()`/`tPlural()`
      helper (`app/src/lib/i18n.svelte.ts`, a module-scope Svelte 5 rune),
      not a library — around 35 UI strings across `MapNav.svelte`,
      `+page.svelte`, `QuizView.svelte`, and `TourView.svelte`, translated
      into natural English/German/Italian. A `LanguageSwitcher.svelte`
      (three small EN/DE/IT pills, matching GUI/UX round 1's visual
      language) is shown on every map-scoped view via `MapNav` and on the
      home page header. Chosen language persists via `localStorage`
      (guarded the same way `progressRepository.ts` is, for prerendering).
      Verified in a real browser: switching language updates nav labels,
      home page text, and quiz/tour status text live; the choice survives
      a reload; a full quiz playthrough on `sweden-towns-100k` in Italian
      and German showed correctly translated tray subtitle, score panel,
      and "up to date"/practice-mode text throughout.
- [x] **Evaluate GUI/UX approaches to make the interface more captivating —
      first round, merged to `main` 2026-09-12** (from
      `feature/gui-ux-nav-labels-colors`).
      Sequenced after the Android POC as planned, and directly triggered by
      the user's own feedback testing Android on a real device (widget
      sizing) plus a follow-up ("everything is green"). Explored with the
      `design` skill first (mockups + live style edits on the real app,
      not guessed) before writing any implementation code — see the
      published canvas linked from this session, and DECISIONS.md's "GUI/UX
      round 1" entries for the reasoning behind each choice below.
      - [x] **Top nav, on every map-scoped view**: replaced the small
        "← Maps / [name] / links" text overlay with 4 big equal buttons
        (Maps / Overview / Quiz / Tour), icon + label, stacked on phone
        width and side-by-side past 640px via one CSS media query. Map name
        demoted to a small muted tag below the buttons — you already know
        which map you're on. Originally landing-page-only; extended to
        Overview/Quiz/Tour too (same shared `MapNav.svelte` component, not
        copy-pasted) after the user asked for consistent tabs everywhere —
        each view now highlights its own tab as the active one, so you can
        jump directly between modes without going back to the landing page
        first.
      - [x] **Map fill colors**: `data/styles/base.json`'s flat single-green
        fill replaced with an 8-color muted categorical palette, picked per
        feature via `["%", ["length", ["get","name"]], 8]` — a hash on the
        name string already present on every feature, so it works for any
        map's target set with no per-map data or pipeline change. Not true
        adjacency-aware graph coloring (see the style's own metadata note).
      - [x] **On-map name labels** (click-to-explore, tour reveal, quiz
        solved/overview): unified all three into one small translucent dark
        pill (matches the map's own outline color family) with white text,
        replacing the old plain-white boxes that nearly blotted out dense
        maps like `italy-provinces`'s 110-region overview. Contrast checked
        with real WCAG math against all 8 palette colors, not eyeballed —
        65% pill opacity was needed to clear 4.5:1 on every color instead of
        the mockup's original 55%.
      - [x] **Quiz name-tray resize**: added a drag handle (pointer +
        keyboard, `role="slider"`) so the tray's height (9-70vh, default
        22vh) is now under the user's control instead of a fixed 30vh that
        scrolled on anything past ~20 targets. Follow-up after the user
        found it couldn't actually shrink much: a classic flexbox
        `min-height: auto` gotcha on the wrapping slip container was
        silently overriding the handle's own height changes — fixed with
        an explicit `min-height: 0`, see DECISIONS.md.
      - [ ] Motion/feedback design (reveal animations, streak indicators,
        sound, correct-drop juiciness) and a broader component/design-system
        pass are still open — this round was scoped to what the user's
        actual device-testing feedback called out, not a full redesign.
