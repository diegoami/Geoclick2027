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

The first three were regenerated (not just built once and hand-edited)
when the lakes layer was added, confirmed via `git diff` to produce
byte-identical `map.json`/`tour.json` — the pipeline is genuinely
reproducible, not "ran once, then diverged from what the script would
produce today." `italy-provinces` was built after that change, so it
already includes lakes from its first build.

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

## Planned: next two maps

Registered here before building, per the project's working convention —
design first, implement after. `italy-provinces` (previously planned
here) has shipped — see "Maps currently shipping" above.

### `italy-towns-100k` and `germany-towns-100k`

**New data source confirmed available**: Natural Earth's
`ne_10m_populated_places` — same public-domain family already in use,
downloaded and queried directly to confirm before writing this plan
(not assumed). Relevant fields: `NAME` / `NAME_IT` / `NAME_DE` (English
vs. localized name — cleaner than another `NAME_FIXUPS` entry),
`ADM0NAME` (country), `POP_MAX` (population estimate).

Confirmed counts at a 100k threshold: **Italy ~15** (Rome down to
Venice), **Germany ~46** (Berlin down to Gera) — both a reasonable quiz
size, in the same range as the existing state/region maps.

**Population data quality caveat**, found while confirming the counts
above: Natural Earth's `POP_MAX` often reads as an urban-agglomeration
estimate, not strict city-limits population — e.g. the pulled figures
for Stuttgart (2.9M) and Mannheim (2.36M) are far above those cities'
actual populations. The resulting ">100k" list may not match what
someone intuitively expects as "German cities over 100k." Decide
explicitly before building: accept it, switch fields (Natural Earth has
more than one population column, not all checked yet), or set the
threshold empirically instead of by a round number.

**Same open question as ROADMAP.md's "self-serve map-authoring
pipeline" backlog item** (Iteration 8+) — this isn't a second, separate
problem, it's the same one. Designed (not yet built) below; both plans
benefit once it is.

## Point-target design

The real blocker on the two towns maps, worked through end to end
against the actual current code rather than reasoned about in the
abstract — every file/layer named below was checked directly, not
assumed. Design only, nothing here is built yet.

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
   fitting a zero-size box for a point target — needs
   `map.flyTo({ center: target.centroid, zoom: <N> })` instead when
   `target.type` is a point type. **Open, needs real tuning once
   built**: what zoom level reads as "looking at one city" — too far
   out and the city is an insignificant dot with no sense of arrival,
   too close and there's no surrounding context. Pick empirically
   against the actual rendered map, the same way `DROP_TOLERANCE_PX`
   was tuned against Bremen, not guessed once and left.

**Open questions, deliberately not decided here:**

- **Drop tolerance for points likely needs to be its own, larger
  constant**, not reuse `DROP_TOLERANCE_PX` (24px, tuned for *small
  polygons* like Bremen, which still have some inherent area). A point
  has zero inherent area — the tolerance radius *is* the entire target.
  Needs its own empirical pass once real point maps exist to test
  against, the same way Bremen's number came from measuring an actual
  miss, not a guess.
- **Should hover tolerance also become nonzero for point maps?** Today,
  hover is deliberately exact-pixel (0px) for every map, precision while
  exploring, with tolerance only assisting the final drop. Exact-pixel
  hovering over a small rendered circle marker may be meaningfully
  harder than over even a small polygon — worth deciding once it can
  actually be tried, not assumed either way.
- **Label/marker crowding risk, worse than the existing known
  limitation.** `ROADMAP.md`'s Iteration 2 follow-up already notes DOM
  popups don't collision-avoid each other, spotted on a cluster of small
  *polygons* (New England). A towns map has more targets *and* some are
  genuinely close together (e.g. the Ruhr area's Essen/Duisburg/Dortmund/
  Bochum) — likely a worse case of the same limitation, not a new one,
  but worth checking against the real data once built rather than
  assuming it's fine because the polygon case was tolerable.
- **`'city'` vs `'town'` as the `TargetType` value** — minor, but pick
  one deliberately; `MAPS.md`/`ROADMAP.md` currently say "towns" in
  prose while `city` reads as the more standard term for a labeled
  populated place regardless of exact size. Not worth much deliberation,
  just worth not leaving inconsistent.

**Sequencing:** `italy-provinces` needed none of the above and has
already shipped. The two towns maps depend on this design actually
being implemented (not just agreed on) first — `build-points-map.ts`,
the `targets-circle` style layer, and the hit-testing/camera-framing
changes above are real work, not a footnote to add while building the
first towns map.
