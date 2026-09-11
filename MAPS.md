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

All three were regenerated (not just built once and hand-edited) when
the lakes layer was added, confirmed via `git diff` to produce
byte-identical `map.json`/`tour.json` — the pipeline is genuinely
reproducible, not "ran once, then diverged from what the script would
produce today."

## Beyond Natural Earth's admin-1 data

Everything above (and the two `italy-provinces`/towns plans below) stays
within data Natural Earth already provides. That won't always be true:
Natural Earth's own finer-than-admin-1 coverage (admin-2 — counties,
finer than a province) is thin and heavily US-centric, so a genuinely
finer administrative level for most other countries would likely need a
different source (e.g. GADM). Don't adopt one without a licensing check
first — this project has stuck to public-domain data on purpose (see
`DECISIONS.md`), and GADM's terms are not the same as Natural Earth's.
Not needed for anything currently planned; flagged here so it isn't
assumed to be a drop-in swap when it eventually comes up.

## Planned: next three maps

Registered here before building, per the project's working convention —
design first, implement after. None of this is built yet.

### `italy-provinces`

**No new data source needed.** Checked directly against the already-
downloaded `ne_10m_admin_1_states_provinces` shapefile: Italy's raw
admin-1 records *are* province-level (110 features, `type=Province`) —
`italy-regions` only shows 20 because `--dissolve=region` merges them.
Skip that flag and the provinces are already there:

```
npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces --type=province --name="Italy — Provinces"
```

(`--type=province` doesn't exist as a `TargetType` yet — `mapDefinition.ts`
currently has `'region' | 'state'`; needs a third value added, a small,
low-risk change.)

**Known snag to handle before shipping, not just spot-check:** some
province names come through in non-Italian form the same way Apulia/
Sicily did for regions — confirmed at least "Aoste" (should be "Aosta")
and "Bozen" (should be "Bolzano") by querying the raw data directly. All
110 need a real audit, not a guess based on the two found so far — the
existing `NAME_FIXUPS` table pattern works but doesn't scale well to a
much longer list; worth reconsidering as a data-driven per-country file
instead (already flagged as a "remove the manual-curation dependency"
candidate below, applies here too).

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

**This is the genuinely hard part of the plan — a real open design
question, not an implementation detail to fill in later:**

- **Point geometry, not polygon.** Every part of the pipeline and the
  app currently assumes polygon targets: `build-map.ts`'s simplify/tile
  steps, `mapDefinition.ts`'s `Target` shape, MapLibre's `fill`/`line`
  layers, `queryRenderedFeatures`-based hit-testing in `QuizView`,
  polygon-bounds camera framing in `TourView`. A town is a point with no
  natural "area" to fill, hover, or fit a camera to — this needs actual
  design work across the map viewer, tour player, and quiz, not just a
  new `--type` flag.
- **Hit-testing changes shape.** The quiz's existing `DROP_TOLERANCE_PX`
  tolerance-radius trick (added for small polygons like Bremen) is a
  reasonable starting point for "how close counts as a hit" on a point
  target, but it was built as an *assist* on top of polygon hit-testing,
  not as the primary mechanism — needs to actually become the primary
  mechanism for towns, not just reused as-is.
- **Population data quality caveat**, found while confirming the counts
  above: Natural Earth's `POP_MAX` often reads as an urban-agglomeration
  estimate, not strict city-limits population — e.g. the pulled figures
  for Stuttgart (2.9M) and Mannheim (2.36M) are far above those cities'
  actual populations. The resulting ">100k" list may not match what
  someone intuitively expects as "German cities over 100k." Worth an
  explicit decision once this is actually being built: accept it,
  switch fields (Natural Earth has more than one population column, not
  all checked yet), or set the threshold empirically instead of by a
  round number.
- **Same open question as ROADMAP.md's "self-serve map-authoring
  pipeline" backlog item** (Iteration 8+) — this isn't a second, separate
  problem, it's the same one. Solve it once, both plans benefit.

**Sequencing:** `italy-provinces` needs no new capability and could ship
independently, soon. The two towns maps are blocked on the point-target
design question above — don't start either until that's actually
resolved, not just deferred again.
