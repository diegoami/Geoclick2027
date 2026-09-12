# Geoclick — Maps

How maps get built, exactly what produced each one currently shipping,
and what's planned next. This is the transparency the process was
missing: every map's build command is recorded here, so reproducing or
auditing one never depends on asking Claude what was run.

**Principle, stated explicitly:** the scripts that build maps live in
this repository (`data/scripts/`), committed to git like any other code.
Nothing about adding a map should depend on a one-off command run once
outside the repo and not recorded anywhere — if a map exists, this file
says how it was made.

## Pipeline

```
data/scripts/fetch-natural-earth.sh   downloads + caches source datasets
data/scripts/build-map.ts             filter → simplify → tile → derive map.json
```

1. `fetch-natural-earth.sh` — downloads (once, cached in `data/source/`,
   gitignored) the Natural Earth datasets the pipeline uses: the admin-1
   states/provinces layer (`ne_10m_admin_1_states_provinces`) and a
   lakes layer (`ne_10m_lakes`, contextual water fill only).
2. `build-map.ts --country=<name> --out=<dir> [options]` — filters the
   source to one country (`ogr2ogr`), optionally dissolves finer
   features into a coarser level (`--dissolve=<field>`, mapshaper),
   simplifies geometry, selects nearby lakes by bounding-box
   intersection, builds a PMTiles tileset (`tippecanoe` + `pmtiles`),
   and derives a draft `map.json` (target list + a north-to-south
   default tour order).
3. **Manual curation** — not automated on purpose, reviewed by hand
   after each build: non-English/non-local names corrected
   (`NAME_FIXUPS` in `build-map.ts`, or a real data-driven per-country
   name field where the source provides one — see below), aliases for
   quiz matching, tour order, difficulty tier.
4. Preview in the app (`/map/<id>`, `/map/<id>/overview` is the fastest
   sanity check — every target labeled at once) before committing.

See `DECISIONS.md`'s Data & maps section for the *why* behind choices
like public-domain-only sourcing; this file is the *what was actually
run*.

## Maps currently shipping

Exact commands, so any of these can be regenerated identically:

- **`italy-regions`** (20 targets, regions):
  ```
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-regions --type=region --name="Italy — Regions" --dissolve=region
  ```
- **`germany-states`** (16 targets, Bundesländer):
  ```
  npx tsx data/scripts/build-map.ts --country="Germany" --out=data/maps/germany-states --type=state --name="Germany — States"
  ```
- **`usa-states`** (49 targets, 48 contiguous states + DC; Alaska/Hawaii
  excluded — see ARCHITECTURE.md's Known snags):
  ```
  npx tsx data/scripts/build-map.ts --country="United States of America" --out=data/maps/usa-states --type=state --name="USA — States" --exclude=Alaska,Hawaii
  ```
- **`italy-provinces`** (110 targets, provinces — no `--dissolve` flag,
  unlike `italy-regions`):
  ```
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces --type=province --name="Italy — Provinces"
  ```
  Needed a `'province'` `TargetType` added to `mapDefinition.ts` (a
  three-way union already, low-risk — confirmed nothing else in `app/`
  branches on `TargetType` at all, it's carried as metadata only) and a
  full audit of all 110 raw province names, not just the two spot-checked
  while planning this: found 3 non-Italian names (Aoste→Aosta,
  Bozen→Bolzano, Turin→Torino) and 2 apparent source-data typos, not
  translation issues (Crotene→Crotone, Oristrano→Oristano) — all five
  added to `NAME_FIXUPS['Italy']` alongside the existing region-level
  fixups (Apulia/Sicily). Confirmed the shared fixups table doesn't
  cross-contaminate: regenerating `italy-regions` after this change
  produced a byte-identical `map.json`/`tour.json`/`tiles.pmtiles`.
- **`italy-towns-100k`** (40 targets, point geometry — see "Point-target
  implementation" below):
  ```
  npx tsx data/scripts/build-points-map.ts --country="Italy" --out=data/maps/italy-towns-100k --name-field=NAME_IT --min-population=100000 --name="Italy — Towns"
  ```
- **`germany-towns-100k`** (49 targets, point geometry):
  ```
  npx tsx data/scripts/build-points-map.ts --country="Germany" --out=data/maps/germany-towns-100k --name-field=NAME_DE --min-population=100000 --name="Germany — Towns"
  ```
  Both use `build-points-map.ts`, a separate script from `build-map.ts`
  (see "Point-target implementation"). `--name-field` picks the
  dataset's own localized-name column (`NAME_IT`/`NAME_DE`) instead of
  another manual `NAME_FIXUPS` entry — cleaner, since the source already
  provides it.

The first three (polygon maps) were regenerated (not just built once and
hand-edited) when the lakes layer was added, confirmed via `git diff` to
produce byte-identical `map.json`/`tour.json` — the pipeline is
genuinely reproducible, not "ran once, then diverged from what the
script would produce today." `italy-provinces` and the two towns maps
were built after that change, so they already include lakes from their
first build.

## Beyond Natural Earth's admin-1 data

Everything above (and the two towns plans below) stays within data
Natural Earth already provides. That won't always be true:
Natural Earth's own finer-than-admin-1 coverage (admin-2 — counties,
finer than a province) is thin and heavily US-centric, so a genuinely
finer administrative level for most other countries would likely need a
different source (e.g. GADM). Don't adopt one without a licensing check
first — this project has stuck to public-domain data on purpose (see
`DECISIONS.md`), and GADM's terms are not the same as Natural Earth's.
Not needed for anything currently planned; flagged here so it isn't
assumed to be a drop-in swap when it eventually comes up.

## Population field: `POP_MAX`, not `POP_MIN` or the yearly `POPxxxx` fields

Resolved while building the two towns maps, by testing all three
candidates against known-tricky rows rather than picking one on paper:

- **`POP_MIN`** looked more accurate at first for the cities `POP_MAX`
  over-counts (Stuttgart: 606,588 vs. `POP_MAX`'s inflated 2,944,700,
  close to Stuttgart's real ~630k) — but it reads as flatly broken for
  Rome: **35,452**. That's not a rounding quirk, it's wrong by two
  orders of magnitude, and would have silently excluded Italy's own
  capital from a ">100k towns" map entirely. Disqualifying on its own.
- **The yearly `POP2020`/`POP2015`/etc. fields** are only populated for
  a handful of the world's largest cities — checked directly: 45 of 46
  qualifying German cities had `POP2020 = 0` (missing), not a real
  value. Unusable as a general threshold field.
- **`POP_MAX`** sometimes reads as an urban-agglomeration estimate
  rather than city-proper (the Stuttgart/Mannheim/Frankfurt inflation
  above) — but critically, it never wrongly *excluded* a real major
  city in anything checked. For a threshold filter, "occasionally
  includes a city using a bigger boundary than expected" is a far
  safer failure mode than "silently excludes the capital." Used as
  planned, with this reasoning recorded here instead of the original
  vaguer caveat.

Actual counts at the 100k threshold, corrected from an earlier estimate
that was accidentally truncated by a `LIMIT` clause used only for
display while researching this: **Italy 40** (not ~15), **Germany 49**
(not ~46) — both confirmed by an explicit `COUNT(*)` query, not
recounted by eye.

## Point-target implementation

The real blocker on the two towns maps — designed, then built, against
the actual current code rather than reasoned about in the abstract.
Every file/layer named below was checked directly, not assumed, and
every open question from the original design pass got resolved by
actually building it and testing against the real maps, not guessed at
and left. `italy-towns-100k`/`germany-towns-100k` are the result — see
"Maps currently shipping" above.

**Why it's not just a new `--type` flag:** a town is a point with no
natural area to fill, hover, or fit a camera to, and every part of the
pipeline and app today assumes polygon targets:

| Concern | Current polygon behavior | Confirmed by |
|---|---|---|
| Domain model | `Target.bbox` — used for tour camera framing | `TourView.svelte:57`, `map.fitBounds(target.bbox, ...)` — the *only* place `bbox` is read anywhere in `app/` |
| Hit-testing | `queryRenderedFeatures` against the `targets-fill` layer only | `QuizView.svelte`'s `regionsNear` |
| Click/hover | Bound to the `targets-fill` layer only | `MapView.svelte`'s `map.on('click'/'mouseenter'/'mouseleave', 'targets-fill', ...)` |
| Style | `targets-fill` (fill) + `targets-outline` (line) | `data/styles/base.json` |
| Labels | A separate `labels` point source-layer, one point per target | `build-map.ts` — but confirmed **unused**: nothing in `app/` actually queries it; every popup (`QuizView`, `OverviewView`, `TourView`) anchors at `target.centroid` from `map.json` directly, not a tile query |

That last row matters: for a point target, the target's own geometry
*is* already what the unused `labels` layer exists to provide. No need
to carry that redundancy forward into point maps.

**Proposed design:**

1. **No new `MapDefinition`-level field for geometry kind.** A map is
   homogeneous — every target is a polygon or every target is a point,
   never mixed — so branching on `Target.type` (`'city'` alongside the
   existing `'region' | 'state' | 'province'`) is enough; nothing needs
   a separate "is this a point map" flag duplicating that information.
2. **`Target.bbox` becomes degenerate for a point target** (the centroid
   repeated as both corners) rather than a nullable field — keeps the
   type simple, and `overallBounds()` (initial camera fit) already only
   reads `centroid`, never `bbox`, so it needs no change at all.
3. **New pipeline script, not new branches in `build-map.ts`.** The
   existing script's dissolve/mapshaper-simplify/labels-layer steps are
   all polygon-specific and don't apply to points — bolting point
   support on with `if (isPointMap)` branches throughout would make an
   already-nontrivial script harder to read for exactly the audience
   (a PM, or ONBOARDING.md's hypothetical junior dev) the self-serve
   goal is for. A second, smaller script (e.g.
   `build-points-map.ts`, sharing the small reusable bits — slugify,
   the lakes bounding-box selection, the pmtiles convert step — with
   `build-map.ts`) reads as more self-serve, not less: two scripts each
   doing one clear thing beats one script branching on geometry kind
   throughout. Its job: filter `ne_10m_populated_places` by
   `ADM0NAME`/`POP_MAX`, no dissolve, no polygon simplification, no
   `labels` layer (redundant per above), still select nearby lakes the
   same way (still useful context for a coastal or lake-adjacent city).
4. **Style: add a `targets-circle` layer, don't replace anything.**
   Same source-layer (`targets`), same feature-state-driven color
   `case` expression already used by `targets-fill` (`quizWrong` →
   `quizCorrect` → `quizRevealed` → `quizHover` → `highlighted` →
   default) so a point map *looks* like the same game, just with round
   markers instead of filled shapes — not a second visual language to
   learn. `targets-fill`/`targets-outline` and the new `targets-circle`
   coexist harmlessly in the one shared `base.json`: a polygon map's
   tileset has no point features for `targets-circle` to draw, and vice
   versa. Worth adding an explicit `['==', ['geometry-type'], 'Polygon']`
   / `'Point'` filter to each pair while doing this — cheap correctness
   insurance against a future map ever accidentally mixing geometry
   kinds, not needed today but a small thing to get right while already
   in this code.
5. **Every hit-test/click/hover binding needs the second layer added
   alongside the first, not swapped in.** `QuizView`'s `regionsNear`
   queries `layers: ['targets-fill']` today; becomes `['targets-fill',
   'targets-circle']`. Same pattern for `MapView`'s click/hover
   bindings. Harmless for the same reason as point 4 — one of the two
   layers is always empty for a given map.
6. **`TourView`'s camera framing needs an actual branch, not just a
   wider query.** `map.fitBounds(target.bbox, ...)` degenerates to
   fitting a zero-size box for a point target — uses
   `map.flyTo({ center: target.centroid, zoom: POINT_TOUR_ZOOM })`
   instead when `target.type === 'city'`.

**Resolved by building it and testing against the real maps, not left as
open questions:**

- **Point drop tolerance: 30px** (`POINT_DROP_TOLERANCE_PX` in
  `QuizView.svelte`), larger than the polygon `DROP_TOLERANCE_PX` (24px)
  as expected, since a point has zero inherent area. Confirmed a
  realistic ~15px-imprecise drop lands correctly.
- **Hover tolerance for points: not needed, resolved by measurement.**
  Tested exact-pixel hover at increasing offsets from a marker's true
  centroid and found it already stays "hovering" out to ~9-10px before
  falling off — matching the circle's own configured `circle-radius: 9`
  almost exactly. The marker's own rendered size already provides a
  comfortable hover zone; no extra tolerance code needed for hover
  specifically.
- **Tour zoom level: 7.** Tested 6/7/8/9/10 against `italy-towns-100k`'s
  Trento directly. Zoom 10 (the initial guess) left the highlighted
  marker floating alone with nothing else visible — there's no base map
  layer in this style, so "sense of place" only ever comes from other
  targets/lakes being in frame, and at zoom 10 nothing else was close
  enough to render. Zoom 7 keeps several neighboring cities and a
  nearby lake shape in view.
- **`TargetType` value: `'city'`.** Settled without much deliberation,
  as expected.
- **Tippecanoe drops points at low zoom by default — found by testing,
  not anticipated in the original design pass at all.** The first build
  of `italy-towns-100k` produced a map where only 4 of 40 city markers
  actually rendered at the initial (whole-country) zoom — confirmed
  directly via `queryRenderedFeatures` against the live tileset, not
  assumed from a screenshot. Tippecanoe thins point density at lower
  zooms by default, a reasonable general-basemap assumption that's
  wrong for a small, curated, gameplay-critical point set where every
  target has to be hittable at whatever zoom the quiz displays it at.
  Fixed with `--drop-rate=1` in `build-points-map.ts`'s tippecanoe
  invocation, which disables that thinning entirely. Re-verified all 40
  (and all 49 for Germany) render after the fix.
- **Dense point clusters broke the tolerance mechanism's core assumption
  — also found by testing, not anticipated.** The tolerance logic
  inherited from polygon maps says "does the tolerance box contain the
  dragged target's name" — for polygons this is safe because two
  candidates rarely sit that close together. For points it isn't: Essen
  and Duisburg render only ~22px apart on screen at the default zoom,
  well inside the 30px tolerance, and Milano/Como/Bergamo form an
  even tighter cluster (34-42px apart). Confirmed directly: dropping a
  **Duisburg** slip squarely on **Essen**'s own marker still registered
  as Duisburg solved correctly, since Duisburg's name was "present
  nearby" regardless of not being the closest thing to the actual drop
  point. Fixed by adding `closestNameAmong()`, used only for point maps:
  tolerance-based correctness now requires the dragged target to be the
  *nearest* candidate to the drop point, not merely present within the
  tolerance radius. Re-verified the same Essen/Duisburg case resolves
  correctly, that legitimate near-centroid drops in the same cluster
  still land, and that polygon maps (which never exercise this path)
  are unaffected.
- **Label/marker crowding**, flagged as a risk beforehand: present, but
  no worse in practice than the already-known small-polygon case (dense
  areas like Lombardy/the Ruhr do show overlapping popups at the default
  zoom) — not a new failure mode, the same accepted limitation from
  `ROADMAP.md`'s Iteration 2 follow-up.

**Sequencing:** `italy-provinces` needed none of the above and shipped
first. `italy-towns-100k`/`germany-towns-100k` needed all of it —
`build-points-map.ts`, the `targets-circle` style layer, the
hit-testing/camera-framing changes, and the two fixes found only by
actually testing the built maps (tippecanoe's zoom-dependent dropping,
the dense-cluster tolerance bug) — real work, not a footnote.
