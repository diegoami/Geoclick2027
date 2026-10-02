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

`data/styles/base.json` is an authored shared MapLibre style. **Do not
re-serialise it with `JSON.stringify` or run a formatter over the whole
file**: either can turn a small textual change into a very large diff. Make
focused text edits instead.

## Pipeline

```
data/scripts/fetch-natural-earth.sh   downloads + caches source datasets
data/scripts/build-map.ts             filter → simplify → tile → derive map.json
data/scripts/build-terrain.ts         terrain.pmtiles for a map that exists
```

1. `fetch-natural-earth.sh` — downloads (once, cached in `data/source/`,
   gitignored) the Natural Earth datasets the pipeline uses: the admin-1
   states/provinces layer (`ne_10m_admin_1_states_provinces`) and a
   lakes layer (`ne_10m_lakes`, contextual water fill only), plus the five
   physical datasets the Terrain layer needs (FT-33): `ne_10m_ocean`,
   `ne_10m_rivers_lake_centerlines`, `ne_10m_geography_regions_polys`
   (named ranges, deserts, plateaus, basins), `ne_10m_geography_marine_polys`
   (named seas, gulfs, bays), `ne_10m_geography_regions_elevation_points`
   (named peaks with their height) and `ne_10m_geographic_lines` (Equator,
   Tropics, Polar Circles, Date Line).
2. `build-map.ts --country=<name> --out=<dir> [options]` — filters the
   source to one country (`ogr2ogr`), optionally dissolves finer
   features into a coarser level (`--dissolve=<field>`, mapshaper),
   simplifies geometry, selects nearby lakes by bounding-box
   intersection, builds a PMTiles tileset (`tippecanoe` + `pmtiles`),
   and derives a draft `map.json` (target list + a north-to-south
   default tour order). As its last step it writes each target's
   `colorIndex` (GC-032): a colour slot 0-5 chosen so that no two
   adjacent targets share one, computed from the tiles it just built
   (see DECISIONS.md's "Map colors"). `build-points-map.ts` does the same
   for towns, using each town's nearest neighbours.
3. **Manual curation** — not automated on purpose, reviewed by hand
   after each build: non-English/non-local names corrected
   (`NAME_FIXUPS` in `build-map.ts`, or a real data-driven per-country
   name field where the source provides one — see below), aliases for
   quiz matching, tour order, difficulty tier.
4. Preview in the app (`/map/<id>`, `/map/<id>/overview` is the fastest
   sanity check — every target labeled at once) before committing. Since
   v0.6.0 the overview only writes the names that fit without overlapping
   (FT-23/FT-24), so on a crowded map, zoom in to read them all, or check
   the names in `map.json` directly.
5. **Register it** (GC-030) — add the map to `app/src/lib/mapCatalog.ts`
   (country + map-type label), then `npm run build-map-index` to
   regenerate `data/maps/index.json` (id, country, target count, target
   type per map; served as `/maps/index.json`). This step needs only
   node, not the WSL2 toolchain — it reads the committed `map.json`
   files. Skip either and `npm test` fails:
   `app/src/lib/mapData.test.ts` checks that the map directories and the
   catalog list exactly the same ids, that the index is in sync, and, for
   every map, that target names and ids are unique (names are the
   feature-state key — `promoteId: "name"` in `base.json`), every
   centroid/bbox is finite, and `tourOrder` is a permutation of the
   target ids. Before this, a map missing from the catalog was silently
   invisible on the home page.
6. **Colours** — if you rename targets by hand in `map.json` after
   the build, or edit the tiles, run `npm run build-map-colors --
   --map=<id>` (omit `--map` to redo every map). It only rewrites
   `colorIndex`, needs only node, and never rebuilds tiles.
   `app/src/lib/mapColors.test.ts` recomputes adjacency from every
   map's tiles and fails if two neighbours share a colour.
7. **Spines** (FT-66) — the curve each region's name is drawn along on
   the Explore map. `build-map.ts` writes them at the end, from the
   tiles it just built; for a committed map, `npm run build-map-spines
   -- --map=<id>` (omit `--map` to redo every map). Node only, like the
   colours: it reads `tiles.pmtiles`, stitches each region's clipped
   pieces on a raster mask, and only adds/updates/drops `spine` in
   `map.json`. Point maps are skipped. A region too small or twisted
   for a curve (Maryland, Rieti, 17 of ~1 000 in all) gets none and
   keeps its centred name. `app/src/lib/mapData.test.ts` checks every
   spine is well formed and ends inside its target's bbox.

### Build-script settings and known quirks (GC-031)

- **`PMTILES_BIN`** — `build-map.ts` and `build-points-map.ts` run the
  `pmtiles` CLI from `PATH` by default. If it lives elsewhere, e.g. the
  `~/.local/bin` install ONBOARDING.md describes and that directory isn't
  on `PATH`, set `PMTILES_BIN=$HOME/.local/bin/pmtiles`. A missing CLI now
  fails with a message naming the variable instead of a bare `ENOENT`.
  (Both scripts used to hardcode `$HOME/.local/bin/pmtiles`.)
- **`crossesAntimeridian: true`** — a polygon spanning ±180° (today:
  `russia-regions`' Chukotka) gets a bbox with west > east,
  `[157.692, 61.8148, -169.7009, 71.6]`. That is deliberate and MapLibre
  frames it correctly; naive min/max code doesn't (`overallBboxOf` mis-clips
  the lake `-spat` filter for Russia). `build-map.ts` now logs a WARNING
  for such a target and writes `crossesAntimeridian: true` on it — only on
  it, so other maps' output is byte-identical. Backfilled in FT-52: the
  committed `russia-regions/map.json` carries the flag, and the runtime no
  longer depends on it — `areaShares` and `overallExtent` derive wrapping
  from `west > east` itself, so a map that omits the flag is handled too.
  `mapData.test.ts` asserts the flag and the bbox agree.
- **Target ids from `slugify`** — accents are stripped (`München` →
  `munchen`), but Latin letters with no Unicode decomposition (Ł, Ø, ß,
  Đ…) are dropped, and non-Latin scripts slug to an empty string.
  Shipped ids already show it: `ma-opolskie`, `wroc-aw`, `bia-ystok`,
  `odz`, `odzkie`. They're internal only (players see the correct
  names), but **ids key every player's saved progress, so don't change
  `slugify` in place** — that would orphan it. A `--name-field` in a
  non-Latin script needs a transliteration decision first.

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
- **`italy-provinces-north`** (52), **`italy-provinces-center`** (24),
  **`italy-provinces-south`** (34) — the same 110 provinces in three, split
  at 43.8° N and 41.3° N (FT-29):
  ```
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-north --type=province --lat-min=43.8 --name="Italy — Provinces — North"
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-center --type=province --lat-min=41.3 --lat-max=43.8 --name="Italy — Provinces — Center"
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-south --type=province --lat-max=41.3 --name="Italy — Provinces — South"
  ```
  The slice flags are the ones `build-points-map.ts` already had (see
  "Slicing a country"), now on the polygon builder too, and applied to each
  region's own middle. The point of the split is readability: the full map
  writes 55 of its 110 names at the zoom it opens at, the three slices 49 of
  52, 24 of 24 and 34 of 34. Rebuilding `italy-provinces` with the updated
  script produced a byte-identical `map.json`, so the flags are a no-op at
  their defaults.
- **`italy-provinces-north`** (52), **`italy-provinces-center`** (24),
  **`italy-provinces-south`** (34) — the same 110 provinces in three, split
  at 43.8° N and 41.3° N (FT-29):
  ```
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-north --type=province --lat-min=43.8 --name="Italy — Provinces — North"
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-center --type=province --lat-min=41.3 --lat-max=43.8 --name="Italy — Provinces — Center"
  npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-provinces-south --type=province --lat-max=41.3 --name="Italy — Provinces — South"
  ```
  The slice flags are the ones `build-points-map.ts` already had (see
  "Slicing a country"), now on the polygon builder too, and applied to each
  region's own middle. The point of the split is readability: the full map
  writes 55 of its 110 names at the zoom it opens at, the three slices 49 of
  52, 24 of 24 and 34 of 34. Rebuilding `italy-provinces` with the updated
  script produced a byte-identical `map.json`, so the flags are a no-op at
  their defaults.
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

- **`usa-cities`** (50 targets — every US city over a million, which is
  exactly 50; no Alaska or Hawaii reaches it):
  ```
  npx tsx data/scripts/build-points-map.ts --country="United States of America" --out=data/maps/usa-cities --min-population=1000000 --name="USA — Cities"
  ```
- **`usa-cities-east`** (82), **`usa-cities-center`** (48),
  **`usa-cities-west`** (44) — the country in three slices at 200 000, split
  at longitude −87 (roughly the Mississippi) and −104 (roughly the Rockies):
  ```
  npx tsx data/scripts/build-points-map.ts --country="United States of America" --out=data/maps/usa-cities-east --min-population=200000 --lon-min=-87 --name="USA — Cities — East"
  npx tsx data/scripts/build-points-map.ts --country="United States of America" --out=data/maps/usa-cities-center --min-population=200000 --lon-min=-104 --lon-max=-87 --name="USA — Cities — Center"
  npx tsx data/scripts/build-points-map.ts --country="United States of America" --out=data/maps/usa-cities-west --min-population=200000 --lon-min=-125 --lon-max=-104 --name="USA — Cities — West"
  ```
  The West slice's `--lon-min=-125` is what keeps Honolulu (−157.9) and
  Anchorage (−149.9) out: a slice stretching to Hawaii would be mostly ocean,
  and `usa-states` already excludes both for the same reason. Nothing in the
  contiguous United States lies west of −124.8.

  Curation found, and `NAME_FIXUPS` now fixes, four things in the US names:
  `Washington,  D.C.`, `St.  Paul` and `Ft.  Worth` each had a double space,
  and `Barlett` is a plain typo for Bartlett, Tennessee. Only the double
  space was taken out of `St. Paul` — that is how the city writes itself, and
  the same source has St. Louis, St. Petersburg and St. Charles — while
  `Ft.` was expanded, since the same source writes Fort Wayne, Fort Collins,
  Fort Lauderdale and Fort Pierce in full. The two Kansas Cities are told
  apart automatically (see "Two cities of the same name").

The first three (polygon maps) were regenerated (not just built once and
hand-edited) when the lakes layer was added, confirmed via `git diff` to
produce byte-identical `map.json`/`tour.json` — the pipeline is
genuinely reproducible, not "ran once, then diverged from what the
script would produce today." `italy-provinces` and the two towns maps
were built after that change, so they already include lakes from their
first build.

### France, Spain, Great Britain, Poland, Ukraine, Sweden (built 2026-09-12)

Six more countries, each an admin-1-equivalent regions map plus a
`>100k`-population towns map — twelve maps in one batch. Every attribute
value below was checked directly against the actual source data before
picking a build command, the same discipline as `italy-provinces`'s full
name audit, not assumed from a couple of spot-checked rows.

- **`france-regions`** (13 targets, metropolitan régions only). France's
  raw admin-1 rows are départements (101 of them, one level finer), same
  situation as Italy's provinces/regions — dissolved to the `region`
  field, audited for blanks/duplicates first (none found). Initially
  shipped at 18 targets (13 metropolitan + Guadeloupe, Martinique,
  Guyane française, Mayotte, Réunion) but corrected same-day: the 5
  overseas départements sit thousands of km from mainland France and
  each other, so including them blew out the map's bounding box far past
  the useful metropolitan extent — same failure mode `usa-states`'s
  Alaska/Hawaii `--exclude` already exists to solve. Excluded by their
  pre-dissolve département name (each overseas région is exactly one
  département, so this drops the whole région):
  ```
  npx tsx data/scripts/build-map.ts --country="France" --out=data/maps/france-regions --type=region --name="France — Regions" --dissolve=region --exclude="Guyane française,Martinique,Guadeloupe,La Réunion,Mayotte"
  ```
- **`spain-regions`** (16 targets, mainland/Balearics comunidades
  autónomas only). Same situation as France — raw rows are the 52
  provincias, dissolved to `region`. Initially shipped at 19 targets (17
  comunidades autónomas + Ceuta + Melilla) but corrected same-day
  alongside France: the Canary Islands (~1,000km from mainland Spain,
  off the African coast) plus the Ceuta/Melilla exclaves on the Moroccan
  coast all skew the map the same way France's overseas départements
  did, so excluded on the same reasoning (by pre-dissolve provincia
  name):
  ```
  npx tsx data/scripts/build-map.ts --country="Spain" --out=data/maps/spain-regions --type=region --name="Spain — Regions" --dissolve=region --exclude="Ceuta,Melilla,Santa Cruz de Tenerife,Las Palmas"
  ```
  Two `NAME_FIXUPS['Spain']` entries needed, checked against the full
  value list, not just the ones that looked obviously wrong:
  `Foral de Navarra` → `Navarra`, and `Valenciana` → `Comunidad
  Valenciana` (kept the full form, unlike Navarra — the Valencian
  Community contains a same-named *province*, so the bare name would
  collide with a possible future finer-level map the way it wouldn't for
  single-province Navarra). A third entry, `Canary Is.` → `Canarias`,
  was removed once the Canary Islands were excluded outright — the
  region name it fixed up no longer reaches this table.
- **`great-britain-regions`** (15 targets — England's 9 official regions,
  Scotland's 4 historic registration-county groupings, Wales's 2 NUTS1
  halves; Northern Ireland excluded, see below). The UK's raw admin-1
  rows (232 of them — districts/unitary authorities/boroughs) have a
  `region` field that looked inconsistent at first glance ("East" next to
  "Eastern", "North East" next to "North Eastern") — audited in full
  before assuming a data bug, and it wasn't one: England and Scotland
  just use different naming for their own groupings, no blanks, no
  actual duplicates, dissolves cleanly to 16 real regions (15 after
  excluding Northern Ireland, next). "Great Britain" was asked for
  specifically, not "United Kingdom" — Great Britain excludes Northern
  Ireland by definition, so its districts are dropped via a new
  `--exclude-field` option (see below) matching the `geonunit` field
  rather than needing every one of NI's 26 districts named individually:
  ```
  npx tsx data/scripts/build-map.ts --country="United Kingdom" --out=data/maps/great-britain-regions --type=region --name="Great Britain — Regions" --dissolve=region --exclude-field=geonunit --exclude="Northern Ireland"
  ```
- **`poland-regions`** (16 targets, voivodeships — already the correct
  level, no dissolve needed). Poland's plain `name` field is
  English-translated ("Silesian", "Lesser Poland") — a new `--name-field`
  option (see below) picks `name_pl` instead, which gives the full
  official form (`województwo śląskie`); `NAME_FIXUPS['Poland']` (16
  entries, one per voivodeship) trims the `województwo ` prefix and
  capitalizes, matching how they're actually referred to outside
  formal/legal Polish text — the same "Toscana", not "Regione Toscana"
  convention Italy's regions already use:
  ```
  npx tsx data/scripts/build-map.ts --country="Poland" --out=data/maps/poland-regions --type=province --name="Poland — Regions" --name-field=name_pl
  ```
- **`ukraine-regions`** (27 targets: 24 oblasts + Kyiv city + Crimea +
  Sevastopol). Natural Earth tags Crimea and Sevastopol under
  `admin='Russia'`, not Ukraine — reflecting de facto control, not
  international recognition (most of the world, including the UN,
  considers them Ukrainian territory under occupation). Decided with the
  user rather than assumed: merge them in explicitly rather than silently
  ship a map missing two of Ukraine's own first-level regions. A new
  `--extra-where` option (see below) runs an independent, country-
  unconstrained query and merges its results in before dissolve:
  ```
  npx tsx data/scripts/build-map.ts --country="Ukraine" --out=data/maps/ukraine-regions --type=province --name="Ukraine — Regions" --extra-where="name IN ('Crimea','Sevastopol')"
  ```
  `NAME_FIXUPS['Ukraine']` (11 entries) moves every name to the modern
  standard transliteration — the same "KyivNotKiev" convention
  international style guides adopted after 2018/19 (`Kiev` → `Kyiv
  Oblast`, `Kiev City` → `Kyiv`, disambiguating the oblast from the
  separately-administered capital city it surrounds) and drops the
  soft-sign apostrophes Natural Earth's plain `name` field uses
  (`Donets'k` → `Donetsk`, `L'viv` → `Lviv`, ...). Crimea/Sevastopol need
  no fixup — their plain names are already correct.
- **`sweden-regions`** (21 targets, län/counties — already the correct
  level, no dissolve, no `--name-field` needed; Sweden's plain `name`
  field is already correct Swedish):
  ```
  npx tsx data/scripts/build-map.ts --country="Sweden" --out=data/maps/sweden-regions --type=county --name="Sweden — Regions"
  ```
  One `NAME_FIXUPS['Sweden']` entry: `Orebro` → `Örebro` — a missing
  diacritic in the plain field, confirmed against `name_sv` ("Örebro
  län"), not guessed.
- **`france-towns-100k`** (37 targets), **`spain-towns-100k`** (38),
  **`great-britain-towns-100k`** (38 — 39 minus Belfast, excluded via a
  new `--exclude` option on `build-points-map.ts` for the same
  Great-Britain-not-UK reason as the regions map above),
  **`poland-towns-100k`** (22), **`ukraine-towns-100k`** (39),
  **`sweden-towns-100k`** (5 — genuinely correct, not a bug: Sweden is
  small and lightly urbanized, only Stockholm/Göteborg/Malmö/Uppsala/
  Västerås clear 100k):
  ```
  npx tsx data/scripts/build-points-map.ts --country="France" --out=data/maps/france-towns-100k --name-field=NAME_FR --min-population=100000 --name="France — Towns" --exclude="Fort-de-France,Pointe-à-Pitre,St.-Denis"
  npx tsx data/scripts/build-points-map.ts --country="Spain" --out=data/maps/spain-towns-100k --name-field=NAME_ES --min-population=100000 --name="Spain — Towns" --exclude="Melilla,Santa Cruz de Tenerife,Las Palmas"
  npx tsx data/scripts/build-points-map.ts --country="United Kingdom" --out=data/maps/great-britain-towns-100k --name-field=NAME_EN --min-population=100000 --name="Great Britain — Towns" --exclude=Belfast
  npx tsx data/scripts/build-points-map.ts --country="Poland" --out=data/maps/poland-towns-100k --name-field=NAME_PL --min-population=100000 --name="Poland — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Ukraine" --out=data/maps/ukraine-towns-100k --name-field=NAME_EN --min-population=100000 --name="Ukraine — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Sweden" --out=data/maps/sweden-towns-100k --min-population=100000 --name="Sweden — Towns"
  ```
  Every `--name-field` choice here was checked by diffing it against the
  plain `NAME` field across every qualifying row first (`NAME_FR` fixed
  `St.-Denis` → `Saint-Denis`, moot now that Réunion's Saint-Denis is
  excluded as an overseas town; `NAME_ES` fixes several including
  `Seville` → `Sevilla` and a stray invisible character in `Granada`;
  `NAME_PL` fixes `Warsaw` → `Warszawa`; Sweden's `NAME`/`NAME_SV` were
  already identical, so no field override needed there at all). Two
  small `NAME_FIXUPS` entries (a mechanism now added to
  `build-points-map.ts` too, mirroring `build-map.ts`'s) catch the rows
  where even the checked field was wrong: Ukraine's `NAME_EN` still says
  `Odessa` (inconsistent with every other Ukrainian city already using
  the modern form) → `Odesa`; Spain's `NAME_ES` gives `Orense`, the
  historic Castilian exonym, when `Ourense` has been this city's sole
  official name since 1998 → `Ourense`.

**Script changes made to support this batch** (all in `data/scripts/`,
each justified by an actual data need hit while building these maps, not
spec'd in advance):

- `build-map.ts --name-field=<field>` (default `name`): which field
  holds the display name pre-dissolve. Added for Poland.
- `build-map.ts --exclude-field=<field>` (default `name`): which field
  `--exclude`'s values match against. Added for Great Britain
  (`geonunit`, to drop every Northern Ireland district by country-
  within-the-UK rather than naming all 26 individually).
- `build-map.ts --extra-where=<clause>`: an independent, country-
  unconstrained ogr2ogr query whose matching features are merged in
  before dissolve. Added for Ukraine (Crimea/Sevastopol).
- `build-points-map.ts --exclude=<names>`: drops named features by
  `NAME`, mirroring `build-map.ts`'s existing option. Added for Great
  Britain (Belfast); reused same-day for France/Spain's overseas towns.
- `build-points-map.ts` gained its own small `NAME_FIXUPS` table,
  mirroring `build-map.ts`'s — for the rare row where even the chosen
  `--name-field` is wrong (Ukraine's Odessa, Spain's Orense).

**Environment note, found while starting this batch:** this session runs
on a Windows machine (see ONBOARDING.md for the desktop/Android work),
and none of `ogr2ogr`/`tippecanoe`/the `pmtiles` CLI have Windows-native
builds usable here — `tippecanoe` in particular has no Windows build at
all. Building maps from Windows needs WSL2 (already set up on this
machine from earlier work) with these tools installed exactly as
ONBOARDING.md's original Linux setup notes describe. Do **not** run
`npm install` from WSL directly against the same `node_modules` the
Windows-side app/dev-server uses — native binaries (esbuild, rolldown,
...) are platform-specific, and npm's optional-dependency resolution
will silently swap out the Windows ones for Linux ones, breaking the
Windows toolchain (`Cannot find module '@rolldown/binding-win32-x64-msvc'`)
until `npm install` is re-run from Windows. Use a separate checkout for
the Linux-side `node_modules` (this session used a pre-existing WSL-
native clone at `~/projects/Geoclick2027`, kept up to date with `git
pull`), and run the build scripts from there with `--out` (or just copy
the resulting `data/maps/<id>/` directory afterward) pointing at the
Windows checkout. See ONBOARDING.md's Gotchas section for the shell-
script CRLF issue this also surfaced.

### Japan, Canada, Australia, Portugal, Netherlands (built 2026-09-12)

Five more countries, same regions+towns pattern, picked by Claude (not
user-specified) when asked to add "10 more maps that make sense for
people" — chosen for genuine geographic/cultural spread rather than
more Europe: Japan (first non-Western country in the set), Canada and
Australia (pair naturally with the existing USA map), Portugal and
Netherlands (small, well-known, round out Western Europe). Notably
clean batch: every country's raw admin-1 `name` field was already
correct as-is (no `NAME_FIXUPS` entries needed anywhere), and every CLI
option needed (`--exclude`, `--name-field`) already existed from the
previous batch — no script changes this time.

- **`japan-regions`** (47 targets, prefectures — already the correct
  level, no dissolve). `name` is already properly Hepburn-romanized
  with macrons (Ōita, Kyōto, Hokkaidō, ...), audited against all 47
  rows, not spot-checked — no fixups needed. Okinawa kept in (unlike
  France/Spain's overseas exclusions): it's a populous, well-known,
  inhabited prefecture ~640km from mainland Kyushu, not a remote
  territory thousands of km away — a fundamentally different case from
  Guadeloupe or the Canary Islands, not just "an island":
  ```
  npx tsx data/scripts/build-map.ts --country="Japan" --out=data/maps/japan-regions --type=province --name="Japan — Prefectures"
  ```
- **`canada-regions`** (13 targets, provinces/territories — already the
  correct level, no dissolve). `name` already gives correct French
  forms for Québec cities/regions (Québec, not Quebec) — no fixups:
  ```
  npx tsx data/scripts/build-map.ts --country="Canada" --out=data/maps/canada-regions --type=province --name="Canada — Provinces"
  ```
- **`australia-regions`** (8 targets: the 6 states + Northern Territory
  + Australian Capital Territory — the canonical set taught in
  Australian schools). Raw admin-1 rows for Australia include 3 more
  entries that aren't part of that canonical 8: Jervis Bay Territory (a
  6.7km² federal enclave inside NSW, effectively unpopulated), Macquarie
  Island (a remote sub-Antarctic island ~1,500km from Tasmania) and Lord
  Howe Island (~600km off the NSW coast) — excluded via `--exclude`,
  same mechanism as USA's Alaska/Hawaii and France/Spain's overseas
  territories, though the reasoning here is "not a real state/territory"
  as much as "far away":
  ```
  npx tsx data/scripts/build-map.ts --country="Australia" --out=data/maps/australia-regions --type=state --name="Australia — States" --exclude="Jervis Bay Territory,Macquarie Island,Lord Howe Island"
  ```
- **`portugal-regions`** (18 targets, districts — already the correct
  level, no dissolve). Raw admin-1 rows include Madeira and Azores
  (overseas autonomous regions) alongside the 18 mainland districts —
  excluded via `--exclude`, same reasoning as France/Spain's overseas
  territories (see DECISIONS.md):
  ```
  npx tsx data/scripts/build-map.ts --country="Portugal" --out=data/maps/portugal-regions --type=province --name="Portugal — Districts" --exclude="Madeira,Azores"
  ```
- **`netherlands-regions`** (12 targets, provinces — already the
  correct level, no dissolve). Raw admin-1 rows include Saba and St.
  Eustatius (Caribbean special municipalities, part of the Netherlands
  proper rather than a separate constituent country like Aruba/Curaçao/
  Sint Maarten) alongside the 12 European provinces — excluded via
  `--exclude`, same overseas-territory reasoning:
  ```
  npx tsx data/scripts/build-map.ts --country="Netherlands" --out=data/maps/netherlands-regions --type=province --name="Netherlands — Provinces" --exclude="St. Eustatius,Saba"
  ```
- **`japan-towns-100k`** (66 targets), **`canada-towns-100k`** (26),
  **`australia-towns-100k`** (14), **`portugal-towns-100k`** (5),
  **`netherlands-towns-100k`** (12):
  ```
  npx tsx data/scripts/build-points-map.ts --country="Japan" --out=data/maps/japan-towns-100k --min-population=100000 --name="Japan — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Canada" --out=data/maps/canada-towns-100k --min-population=100000 --name="Canada — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Australia" --out=data/maps/australia-towns-100k --min-population=100000 --name="Australia — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Portugal" --out=data/maps/portugal-towns-100k --name-field=NAME_PT --min-population=100000 --name="Portugal — Towns" --exclude="Funchal"
  npx tsx data/scripts/build-points-map.ts --country="Netherlands" --out=data/maps/netherlands-towns-100k --name-field=NAME_NL --min-population=100000 --name="Netherlands — Towns"
  ```
  Japan and Canada needed no `--name-field` override — the plain `NAME`
  field already gives correctly romanized/accented forms (Kōriyama,
  Hachiōji, Trois-Rivières, Montréal, St. John's). Portugal's plain
  `NAME` uses the English exonym for the capital ("Lisbon"); `NAME_PT`
  gives "Lisboa", matching the district name and every other country's
  convention of local-language display names. Same for the
  Netherlands' `NAME_NL`, which fixes "The Hague" → "Den Haag". Funchal
  (Madeira's capital, population >100k) excluded from Portugal's towns
  for the same overseas-territory reason as the regions map — no
  Azorean town clears the 100k threshold, so no equivalent exclusion
  was needed there.

### Argentina, Brazil, China, Finland, India, Indonesia, Mexico, Russia (built 2026-09-13)

Eight more countries, user-specified this time, requested alongside two
script changes this batch actually needed: an adaptive population
selection for the towns maps (see "Adaptive town selection" below,
`build-points-map.ts --min-count`/`--max-count`) and a general dedup
fix (Natural Earth has a handful of exact-duplicate populated-place
rows, found here for the first time only because this batch's scale
made them likely to surface). The most name-fixup-heavy batch yet —
audited every raw candidate name directly (all 86 Russian regions, the
top 50-by-population towns per large country), not spot-checked,
consistent with `italy-provinces`' original precedent.

- **`china-regions`** (31 targets: 22 provinces + 5 autonomous regions +
  4 municipalities — the standard province-level count, Hong Kong/
  Macau/Taiwan already excluded by Natural Earth's own model, tagged
  under their own separate `admin` values rather than `admin='China'`,
  so no special-casing needed here). One junk row excluded: "Paracel
  Islands" (`type_en` null) — a disputed, unpopulated South China Sea
  feature, not a real administrative division, same "not a real
  entity" reasoning as Australia's Jervis Bay/Macquarie/Lord Howe
  exclusions, and incidentally avoids taking a side in an active
  territorial dispute:
  ```
  npx tsx data/scripts/build-map.ts --country="China" --out=data/maps/china-regions --type=province --name="China — Provinces" --exclude="Paracel Islands"
  ```
- **`brazil-regions`** (27 targets: 26 states + Distrito Federal —
  already the correct level, no dissolve, no exclusions, `name` field
  already correctly accented throughout):
  ```
  npx tsx data/scripts/build-map.ts --country="Brazil" --out=data/maps/brazil-regions --type=state --name="Brazil — States"
  ```
- **`mexico-regions`** (32 targets: 31 states + Distrito Federal).
  Raw admin-1 rows include one nameless junk row (`note`: "MEX-99
  (Mexico minor island)", `iso_3166_2`: `MX-X01~`) — a Natural Earth
  data artifact, not a real state, excluded by `iso_3166_2` since it
  has no name to match against:
  ```
  npx tsx data/scripts/build-map.ts --country="Mexico" --out=data/maps/mexico-regions --type=state --name="Mexico — States" --exclude-field=iso_3166_2 --exclude="MX-X01~"
  ```
- **`finland-regions`** (18 targets, regions — already the correct
  level, no dissolve; Åland not present under `admin='Finland'` at all
  in this dataset, same "not this project's call, matches Natural
  Earth's own model" reasoning as Taiwan/Hong Kong/Macau above).
  `name` is inconsistent, not uniformly English or uniformly Finnish —
  12 of 18 rows needed fixing up to native Finnish (matching every
  other country's local-name convention), using the Finnish half of
  `name_alt` (Finland is officially bilingual Finnish/Swedish, so
  `name_alt` is a pipe-separated Finnish|Swedish list) rather than
  guessing:
  ```
  npx tsx data/scripts/build-map.ts --country="Finland" --out=data/maps/finland-regions --type=region --name="Finland — Regions"
  ```
- **`russia-regions`** (83 targets: 83 pre-2014 federal subjects).
  Raw admin-1 rows are 86 — excluded 3 via `--exclude-field=iso_3166_2`:
  Crimea (`UA-43`) and Sevastopol (`UA-40`), for the same reason
  they're included in `ukraine-regions` instead (see this file's
  Ukraine section and DECISIONS.md — Natural Earth tags both under
  `admin='Russia'`, reflecting de facto control, but keeps their
  `iso_3166_2` codes under the `UA-` Ukrainian prefix even there,
  matching the international-consensus view; showing them as Russian
  here would directly contradict the already-made Ukraine decision),
  plus one nameless junk row (`RU-X01~`, `note`: "RUS-99 (Russia minor
  island)", the same class of artifact as Mexico's). Chukotka
  (Russia's Far East) genuinely crosses the antimeridian — confirmed
  via its raw coordinate range (exactly -180 to 180) before assuming
  the existing antimeridian-unwrapping logic in `boundsOf()` (added
  originally for Alaska) would just handle it; verified after building
  that it renders correctly at the map's eastern edge, no wraparound.
  Also fixed up: one real data-corruption row (`name` literally
  "Maga Buryatdan", confirmed via `iso_3166_2` `RU-MAG` and
  `name_local` "Магаданская область" that this is actually Magadan),
  one long official title replaced with the same short common name
  every similarly-sized region already uses ("Chukchi Autonomous
  Okrug" → "Chukotka"), and the same soft-sign-apostrophe
  transliteration cleanup already applied to Ukraine's fixups, applied
  here for the same reason (Astrakhan/Ryazan/Yaroslavl/Tver/Perm/
  Primorye/Tyumen/Ulyanovsk/Stavropol/Arkhangelsk, not the apostrophed
  forms). Deliberately did **not** rename every republic to its
  "-ia"-suffixed common form (Chuvashia, Udmurtia, Kalmykia, Buryatia,
  ...) — those adjectival forms already in the source aren't wrong,
  just less common, a different class of issue from an actual data
  error or a stray apostrophe:
  ```
  npx tsx data/scripts/build-map.ts --country="Russia" --out=data/maps/russia-regions --type=province --name="Russia — Regions" --exclude-field=iso_3166_2 --exclude="UA-43,UA-40,RU-X01~"
  ```
- **`india-regions`** (36 targets: 28 states + 8 union territories —
  already the correct level, no dissolve, no exclusions, `name` field
  already uses current official names throughout, e.g. Odisha not
  Orissa, Puducherry not Pondicherry). Includes Jammu and Kashmir and
  Ladakh as India-administers them — deliberately treated differently
  from Crimea: Crimea has near-universal international consensus
  (UN included) against the de facto controller's claim, Kashmir is a
  genuine multi-party dispute (India/Pakistan/China) with no equivalent
  clean resolution, so this map just reflects Natural Earth's own
  India-administered depiction like every other non-Ukraine case,
  rather than picking a side where the world hasn't:
  ```
  npx tsx data/scripts/build-map.ts --country="India" --out=data/maps/india-regions --type=state --name="India — States"
  ```
- **`indonesia-regions`** (33 targets, provinces — already the correct
  level, no dissolve, no exclusions; this Natural Earth vintage
  predates Indonesia's 2022-2023 Papua province splits, so 33 rather
  than the current real-world 38 — a dataset-vintage gap, not a build
  mistake, disclosed rather than silently shipped):
  ```
  npx tsx data/scripts/build-map.ts --country="Indonesia" --out=data/maps/indonesia-regions --type=province --name="Indonesia — Provinces"
  ```
- **`argentina-regions`** (24 targets: 23 provinces + the autonomous
  city of Buenos Aires — already the correct level, no dissolve, no
  exclusions). Specifically checked Tierra del Fuego province's actual
  polygon extent before shipping it as-is: its full official name
  claims Antarctica and the Falkland Islands, but the raw geometry's
  bbox (lon -68.65 to -63.81, lat -55.05 to -52.64) confirms Natural
  Earth's polygon covers only the real, actually-administered Isla
  Grande archipelago — not a political question this map needed to
  make a call on, since the data itself doesn't raise it:
  ```
  npx tsx data/scripts/build-map.ts --country="Argentina" --out=data/maps/argentina-regions --type=province --name="Argentina — Regions"
  ```
- **`china-towns-100k`** (50, capped), **`brazil-towns-100k`** (48),
  **`mexico-towns-100k`** (49), **`finland-towns-100k`** (8, floored),
  **`russia-towns-100k`** (50, capped), **`india-towns-100k`** (50,
  capped), **`indonesia-towns-100k`** (49), **`argentina-towns-100k`**
  (30, neither floored nor capped):
  ```
  npx tsx data/scripts/build-points-map.ts --country="China" --out=data/maps/china-towns-100k --min-population=100000 --max-count=50 --name="China — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Brazil" --out=data/maps/brazil-towns-100k --min-population=100000 --max-count=50 --name="Brazil — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Mexico" --out=data/maps/mexico-towns-100k --min-population=100000 --max-count=50 --name="Mexico — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Finland" --out=data/maps/finland-towns-100k --min-population=100000 --min-count=8 --name="Finland — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Russia" --out=data/maps/russia-towns-100k --min-population=100000 --max-count=50 --exclude="Simferopol,Sevastopol" --name="Russia — Towns"
  npx tsx data/scripts/build-points-map.ts --country="India" --out=data/maps/india-towns-100k --min-population=100000 --max-count=50 --exclude="Amaravati" --name="India — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Indonesia" --out=data/maps/indonesia-towns-100k --min-population=100000 --max-count=50 --name="Indonesia — Towns"
  npx tsx data/scripts/build-points-map.ts --country="Argentina" --out=data/maps/argentina-towns-100k --min-population=100000 --name="Argentina — Towns"
  ```
  Russia's towns exclude Simferopol and Sevastopol (both clear 100k,
  both tagged `ADM0NAME='Russia'` in the populated-places dataset too,
  `ADM1NAME='Crimea'`) — same consistency reasoning as the regions map.
  Neither city is added to `ukraine-towns-100k` to compensate: that map
  was never built with a Crimea-merging step the way `ukraine-regions`
  was (it just filters `ADM0NAME='Ukraine'`, and Crimean places aren't
  tagged that way), so this is a known, disclosed gap rather than a
  new one — revisit only if `ukraine-towns-100k` itself gets a
  `--extra-where`-style merge in a future pass.
  India's towns exclude "Amaravati" specifically: its `POP_MAX`
  (5,800,000) would rank it #7, ahead of Ahmedabad/Pune/Surat, but
  Amaravati is Andhra Pradesh's still-under-construction planned new
  capital with an actual population of a few thousand — the source
  figure appears to conflate it with a surrounding urban region's
  population, well past the usual "occasionally an urban-agglomeration
  estimate" tolerance already disclosed for `POP_MAX` above, into
  actively misleading. `NAME_FIXUPS` for the towns maps got noticeably
  bigger this batch: two real typos (China's "Shenyeng" → "Shenyang",
  "Xian" → "Xi'an" — the missing apostrophe reads as a different,
  ambiguous romanization), several NAME_EN-vs-modernized-spelling gaps
  in India matching the Odessa/Ukraine pattern (Haora → Howrah,
  Sholapur → Solapur, Nasik → Nashik, Vishakhapatnam → Visakhapatnam),
  one genuine 2018 official rename India's dataset hasn't caught up to
  either (Allahabad → Prayagraj, same "use the current official name"
  principle as Kyiv/Odesa), a colonial-era Dutch spelling and a plain
  typo in Indonesia (Bandjarmasin → Banjarmasin, Pakalongan →
  Pekalongan), an English exonym for Mexico's capital plus two missing
  diacritics (Mexico City → Ciudad de México, Nezahualcoyotl →
  Nezahualcóyotl, Ciudad Obregon → Ciudad Obregón), a missing diacritic
  in Argentina (San Nicolas → San Nicolás), one missing diacritic in
  Brazil (Jaboatao → Jaboatão), and one literal double-space typo in
  Russia's only multi-word city name (St.  Petersburg → Saint
  Petersburg, matching `NAME_EN`).

**Real Natural Earth data bug found and fixed generally, not per-country:**
building this batch's larger town lists surfaced exact-duplicate rows
for the same city - "Vila Velha" and "Natal" each appearing twice in
Brazil, "Mazatlán" twice in Mexico, "Bandar Lampung" twice in
Indonesia (confirmed as real duplicate source rows, not a fixup
collision). Left unhandled, two GeoJSON features sharing a `name`
produce two targets with the identical `slugify()`-derived `id` -
duplicate map pins and duplicate/colliding quiz slips. `build-
points-map.ts` now deduplicates by `id` after name fixups, keeping
whichever duplicate has the higher `POP_MAX` (the candidate list is
still population-sorted at that point) - a general fix, not scoped to
this batch, so it silently protects every future country too.

### Slicing a country: `--lon-min` / `--lon-max` / `--lat-min` / `--lat-max` (FT-27)

Added for the United States, which has 281 cities over 100 000 and 177
over 200 000 — far more than one map can ask a player to place, and, worse,
unplayable as one map at all: at a country-wide zoom Newark and New York are
16.8 km apart, about two pixels against a 24 px drop tolerance. A slice is
both shorter and zoomed in enough to be fair.

```
--lon-min=-104 --lon-max=-87      # the middle of the United States
--lat-min=43.8                   # northern Italy
```

- Any side left out is unbounded, so the flags are a no-op at their
  defaults: rebuilding `italy-towns-100k` with the updated script produced a
  byte-identical `map.json` and `tour.json` (2026-09-18).
- The slice is applied **before** the population threshold and before
  `--min-count`/`--max-count`, so "the 50 most populous" means the 50 most
  populous *of the slice*.
- A place exactly on a boundary is kept by both neighbours' filters, so
  adjacent slices overlap by a hair rather than dropping a city between
  them. Pick boundaries in open water or empty country where you can.
- The selection logic itself lives in `data/scripts/placeSelection.ts`
  (pure, unit-tested from `app/src/lib/placeSelection.test.ts` the way
  `mapColors.ts` is) rather than inside the build script.

### Two cities of the same name (FT-27)

A map's target names must be unique — `data/styles/base.json` keys every
feature by its name (`promoteId: "name"`), and `mapData.test.ts` enforces
it. The United States has fifteen repeated city names above 100 000
(Springfield, Columbus, Portland, Charleston, Kansas City…).

When two selected places share a name, the builder now adds each one's
admin-1 region — "Kansas City, Missouri" and "Kansas City, Kansas" — and
keeps the plain name as an `alias`, so the quiz's own matching still accepts
what a player would call it. A name that is already unique is untouched,
which is why every map built before this rebuilds identically. If the source
has no region for a repeated name, both are left alone and `mapData.test.ts`
fails loudly rather than the builder inventing a name.

### Turkey, Nigeria, Vietnam, Colombia, Egypt, South Korea (built 2026-09-18)

Six countries that had no map at all (FT-30, docs/PLAN_V0.7.md), twelve
maps, 1.1 MB of tiles in total.

```
npx tsx data/scripts/build-map.ts --country="Turkey" --out=data/maps/turkey-regions --type=province --name-field=name_tr --name="Turkey — Provinces"
npx tsx data/scripts/build-points-map.ts --country="Turkey" --out=data/maps/turkey-towns-100k --name-field=NAME_TR --min-population=100000 --max-count=50 --name="Turkey — Towns"
npx tsx data/scripts/build-map.ts --country="Nigeria" --out=data/maps/nigeria-regions --type=state --name="Nigeria — States"
npx tsx data/scripts/build-points-map.ts --country="Nigeria" --out=data/maps/nigeria-towns-100k --min-population=100000 --max-count=50 --name="Nigeria — Towns"
npx tsx data/scripts/build-map.ts --country="Vietnam" --out=data/maps/vietnam-regions --type=province --name-field=name_vi --name="Vietnam — Provinces"
npx tsx data/scripts/build-points-map.ts --country="Vietnam" --out=data/maps/vietnam-towns-100k --name-field=NAME_VI --min-population=100000 --name="Vietnam — Towns"
npx tsx data/scripts/build-map.ts --country="Colombia" --out=data/maps/colombia-regions --type=region --exclude-field=adm1_code --exclude="COL+99?" --name="Colombia — Regions"
npx tsx data/scripts/build-points-map.ts --country="Colombia" --out=data/maps/colombia-towns-100k --name-field=NAME_ES --min-population=100000 --name="Colombia — Towns"
npx tsx data/scripts/build-map.ts --country="Egypt" --out=data/maps/egypt-regions --type=region --name-field=name_en --name="Egypt — Governorates"
npx tsx data/scripts/build-points-map.ts --country="Egypt" --out=data/maps/egypt-towns-100k --min-population=100000 --name="Egypt — Towns"
npx tsx data/scripts/build-map.ts --country="South Korea" --out=data/maps/south-korea-regions --type=region --name="South Korea — Regions"
npx tsx data/scripts/build-points-map.ts --country="South Korea" --out=data/maps/south-korea-towns-100k --min-population=100000 --name="South Korea — Towns"
```

Targets: Turkey 81 / 49, Nigeria 37 / 50, Vietnam 63 / 44, Colombia 33 / 34,
Egypt 27 / 30, South Korea 17 / 26.

**Which name field each country uses**, and why — the choice matters more
here than in any earlier batch, because the plain `name` column is weakest
outside Europe and the Americas:

- **Turkey** `name_tr` / `NAME_TR`: the plain column drops Turkish
  diacritics wholesale (Sirnak, Iğdir, Agri, Kirklareli for Şırnak, Iğdır,
  Ağrı, Kırklareli).
- **Vietnam** `name_vi` / `NAME_VI`: same story with tone marks (Ðong Tháp
  for Đồng Tháp, Ha Noi for Hà Nội).
- **Colombia** `NAME_ES` for the towns (Bogota → Bogotá); the regions use
  the plain column, which is already accented, plus one fixup for Bogotá.
- **Egypt** `name_en` for the governorates: the plain column is
  transliterated Arabic (Shamal Sina', Al Bahr al Ahmar, Al Wadi at Jadid)
  where `name_en` gives North Sinai, Red Sea and New Valley. The towns keep
  the plain column — `NAME_EN` is unreliable there, and gives "sharkia" as
  the English name of El Mansura.
- **Nigeria, South Korea**: the plain column, which is already the English
  or romanized form both countries use themselves.

**Curation, all verified against the source rather than assumed:**

- **Three Vietnamese provinces carry their macro-region's name** in Natural
  Earth: "Vùng Đông Bắc", "Đồng Bằng Sông Hồng" and "Đông Nam Bộ". Each
  polygon is province-sized (0.13-0.82 square degrees against a median of
  0.72), and each was identified from its own geometry: the first contains
  the town of Bắc Kạn — which the populated-places file *also* files under
  ADM1NAME "Đông Bắc" — the third contains Biên Hòa, capital of Đồng Nai,
  and the second is the small polygon between them at 106.0 E, 20.8 N, which
  is Hưng Yên, the one of the three with no city over 100 000. Renamed in
  `NAME_FIXUPS`; the map now shows all 63 provinces with no holes.
- **Colombia has an unnamed placeholder polygon** (`adm1_code` "COL+99?",
  at 4.0 N 81.6 W — Malpelo) whose empty name crashed the builder on
  `slugify`. Excluded by code, leaving 32 departments plus Bogotá.
- **Turkey has the same city twice**: "Sakarya" (287k) and "Adapazarı"
  (260k), 3 km apart, both Adapazarı in Turkish. FT-27's same-name rule
  would have renamed them "Adapazarı, Sakarya" twice over and hidden the
  duplicate, so that rule now only splits names apart when the places are in
  *different* regions; two rows in one region fall through to the existing
  duplicate-id dedup, which keeps the more populous. Turkey's towns map is
  49, not 50, for this reason.
- **Spellings fixed**: Nasarawa (the source doubles the s), Elazığ (the
  circumflex Turkish dropped), Seongnam (South Korea's official
  romanization since 2000), Osogbo and Ogbomoso (both cities' own modern
  spellings), Cartagena and Pasto (NAME_ES gives the formal "Cartagena de
  Indias" and "San Juan de Pasto"), and Hồ Chí Minh and Tây Ninh (NAME_VI
  gives "Thành phố X", which is "X city").
- **Left as the source has them**: Egypt's towns mix exonyms with
  transliterations (Cairo and Alexandria next to Bur Said and Dumyat).
  Correcting that would mean choosing English names for some and not
  others; the source's inconsistency is at least reproducible.

### Adaptive town selection: `--min-count` / `--max-count`

Requested directly by the user (2026-09-13), prompted by this batch's
range: the fixed `>100k` threshold alone doesn't scale from Finland (4
towns clear it) to China (317). Two new `build-points-map.ts` flags,
both no-ops at their defaults so every map built before they existed
regenerates identically (verified: rebuilt `sweden-towns-100k` with
the updated script and confirmed byte-identical `map.json`/`tour.json`
against the already-shipped version):

- `--min-count=N`: if fewer than N places clear `--min-population`,
  reach below the threshold and take the N most populous places in the
  country instead - used for Finland (`--min-count=8`, bringing Oulu/
  Lahti/Jyväskylä/Kuopio/Pori into a map that would otherwise be just
  Helsinki/Tampere/Turku/Oulu).
- `--max-count=N`: truncate to the N most populous places that cleared
  `--min-population` - used for China/Brazil/Mexico/Russia/India/
  Indonesia (`--max-count=50`), capping every one of this batch's
  large countries at the same ceiling rather than letting six of them
  run into the hundreds. 50 was picked to stay under the largest
  already-shipped towns map (`japan-towns-100k`, 66 targets) rather
  than matching it exactly - a deliberate, if not perfectly precise,
  choice to keep every towns map in a comparable "curated quiz" size
  range. Argentina (30) and Indonesia/Mexico's post-dedup counts (49
  each) didn't need it or landed under the cap naturally.

Implementation: `ogr2ogr`'s `-where` clause now only filters
`POP_MAX > 0` (dropping missing-data rows) plus any `--exclude` names,
not the population threshold itself - every real candidate is fetched,
sorted by `POP_MAX` descending in JS, and the threshold/min-count/
max-count logic runs there instead, since min-count/max-count both
need visibility into the full candidate pool to decide whether to
reach below the threshold or truncate above it.

### Continents and the parts of Europe (built 2026-09-24, #39)

Seventeen maps that span several countries: each continent's Countries and
Capitals, and the cities of five parts of Europe. The rules behind them are in
DECISIONS.md, "Maps of several countries". They need one more download:
`fetch-natural-earth.sh` now fetches `ne_10m_admin_0_countries`.

**`build-map.ts --level=country`** makes whole countries the targets, from
the admin-0 layer. `--country` names the group ("Europe"), and the countries
come from `--continent`, `--subregion` or `--countries` (ADMIN names):

- `--clip=lonMin,latMin,lonMax,latMax` or a WKT polygon cuts the shapes (the
  `--lon`/`--lat` slice keeps or drops whole targets by their middle);
- `--min-area=<km²>` drops what is too small to drop a slip on, after the clip;
- `--assign-admin1="Crimea,Sevastopol:Ukraine"` moves admin-1 areas into
  another country;
- the countries around the map are drawn as `context`, as on a towns map.

**`build-points-map.ts`** takes `--countries` (ADM0NAME list) or
`--continent` in place of one country, plus `--capitals` (`Admin-0 capital`
only), `--also=<names>` (capitals the source does not flag), and
`--max-per-country=N`. The name field defaults to `local`: each town reads its
own country's field (`LOCAL_NAME_FIELD` in `multiCountry.ts`). Towns record
their `country` in map.json, and `build-facts.ts` takes their authored
sentences from that country's file.

```
npx tsx data/scripts/build-map.ts --level=country --country=Europe --continent=Europe --clip=-25,34,60,72 --min-area=2500 --assign-admin1=Crimea,Sevastopol:Ukraine --out=data/maps/europe-countries --name="Europe — Countries"
npx tsx data/scripts/build-map.ts --level=country --country=Africa --continent=Africa --clip=-26,-36,64,38 --min-area=2500 --out=data/maps/africa-countries --name="Africa — Countries"
npx tsx data/scripts/build-map.ts --level=country --country=Asia --continent=Asia --clip=25,-12,150,56 --min-area=2500 --out=data/maps/asia-countries --name="Asia — Countries"
npx tsx data/scripts/build-map.ts --level=country --country="North America" --continent="North America" --clip="POLYGON((-150 5,-50 5,-50 84,-170 84,-170 30,-150 30,-150 5))" --min-area=2500 --out=data/maps/north-america-countries --name="North America — Countries"
npx tsx data/scripts/build-map.ts --level=country --country="South America" --continent="South America" --clip=-92,-56,-30,13 --min-area=2500 --out=data/maps/south-america-countries --name="South America — Countries"
npx tsx data/scripts/build-map.ts --level=country --country=Oceania --continent=Oceania --clip=110,-50,180,0 --min-area=2500 --out=data/maps/oceania-countries --name="Oceania — Countries"

npx tsx data/scripts/build-points-map.ts --country=Europe --continent=Europe --capitals --min-population=0 --exclude="Vatican City" --out=data/maps/europe-capitals --name="Europe — Capitals"
npx tsx data/scripts/build-points-map.ts --country=Africa --continent=Africa --capitals --min-population=0 --also="Dodoma,Porto-Novo,Gitega" --exclude="Johannesburg,Abidjan,Dar es Salaam,Cotonou,Bujumbura" --out=data/maps/africa-capitals --name="Africa — Capitals"
npx tsx data/scripts/build-points-map.ts --country=Asia --continent=Asia --capitals --min-population=0 --exclude=Yangon --out=data/maps/asia-capitals --name="Asia — Capitals"
npx tsx data/scripts/build-points-map.ts --country="North America" --continent="North America" --capitals --min-population=0 --out=data/maps/north-america-capitals --name="North America — Capitals"
npx tsx data/scripts/build-points-map.ts --country="South America" --continent="South America" --capitals --min-population=0 --out=data/maps/south-america-capitals --name="South America — Capitals"
npx tsx data/scripts/build-points-map.ts --country=Oceania --continent=Oceania --capitals --min-population=0 --lon-min=110 --out=data/maps/oceania-capitals --name="Oceania — Capitals"

npx tsx data/scripts/build-points-map.ts --country=Europe --countries="France,Belgium,Netherlands,Luxembourg,United Kingdom,Ireland" --lat-min=35 --lon-min=-25 --min-population=100000 --max-per-country=20 --out=data/maps/europe-cities-west --name="Europe — Cities — West"
npx tsx data/scripts/build-points-map.ts --country=Europe --countries="Germany,Poland,Czechia,Austria,Switzerland,Hungary,Slovakia,Slovenia" --min-population=100000 --max-per-country=16 --out=data/maps/europe-cities-central --name="Europe — Cities — Central"
npx tsx data/scripts/build-points-map.ts --country=Europe --countries="Ukraine,Belarus,Moldova,Romania,Bulgaria,Lithuania,Latvia,Estonia,Russia" --lon-max=60 --min-population=100000 --max-per-country=12 --out=data/maps/europe-cities-east --name="Europe — Cities — East"
npx tsx data/scripts/build-points-map.ts --country=Europe --countries="Sweden,Norway,Denmark,Finland,Iceland" --lat-max=72 --lon-min=-25 --min-population=50000 --exclude=Bærum --out=data/maps/europe-cities-north --name="Europe — Cities — North"
npx tsx data/scripts/build-points-map.ts --country=Europe --countries="Spain,Portugal,Italy,Greece,Albania,North Macedonia,Serbia,Montenegro,Bosnia and Herzegovina,Croatia,Kosovo,Malta" --lat-min=36 --lon-min=-10 --min-population=100000 --max-per-country=14 --exclude=Piraeus --out=data/maps/europe-cities-south --name="Europe — Cities — South"

npx tsx data/scripts/build-facts.ts --map=<each of the above>
```

| Map | Targets | Map | Targets |
|---|---|---|---|
| europe-countries | 39 | europe-capitals | 44 |
| africa-countries | 52 | africa-capitals | 54 |
| asia-countries | 47 | asia-capitals | 47 |
| north-america-countries | 16 | north-america-capitals | 23 |
| south-america-countries | 12 | south-america-capitals | 13 |
| oceania-countries | 6 | oceania-capitals | 11 |
| europe-cities-west | 62 | europe-cities-central | 68 |
| europe-cities-east | 67 | europe-cities-north | 43 |
| europe-cities-south | 62 | | |

Audited by hand: every name on all seventeen maps was read, and pairs of towns
closer than 25 km were listed. Piraeus (5 km from Athens) and Bærum (a suburb
of Oslo, not a town) were dropped; Brazzaville and Kinshasa, 9 km apart across
the Congo, both stay as capitals. Fixups added to `build-points-map.ts`:
Astana, Ngerulmud, Andorra la Vella, Plzeň, Panevėžys, Peja.

### Names in each language (rebuilt 2026-09-26, FT-81, #71)

The six Countries maps, the six Capitals maps, Europe's five city maps and
the world picker were rebuilt with the same commands as above. Their
map.json (and picker.json) gained `names: { en?, it?, de? }` where a place's
name differs in that language. Every tileset came out byte-identical.

- A country: admin-0 `NAME_IT` / `NAME_DE`, with
  `COUNTRY_NAME_FIXUPS_BY_LANGUAGE` (multiCountry.ts). They're kept out of
  the tiles.
- A town, on a map of several countries only (`build-points-map.ts` with
  `--continent` or `--countries`): populated places' `NAME_EN` / `NAME_IT` /
  `NAME_DE`, less `TOWN_NAMES_NOT_SHOWN`. A town whose name the region was
  added to ("Córdoba, Spain") gets none.
- `targetName.test.ts` checks that no other map carries `names`, that no two
  places on a map read the same in any language, and that the picker agrees
  with the Countries maps.

### The world picker (built 2026-09-26, FT-76)

The map the home screen opens on (v0.13, #58): the 172 countries of the six
Countries maps, each tagged with its continent. It is not a playable map. It
writes `picker.json` beside its tiles instead of a `map.json`, so every scan
for maps (the catalog test, `index.json`, the tour and terrain checks) skips
it. There's no terrain, no facts and no tour.

```
npx tsx data/scripts/build-picker.ts            # --simplify=5% --max-zoom=5
```

- Each continent is filtered and clipped exactly as its Countries map is
  (the six commands above), so France has no French Guiana, the USA no
  Hawaii, and Crimea is Ukraine's. The one exception: Europe's clip is
  widened to `-25,34,180,82`, so Russia is whole and the world view has no
  hole where Siberia is.
- `picker.json` gives each continent a `view`, its Countries map's box,
  which the continent view fits to. Europe frames Europe, not all of Russia.
- **Size, measured 2026-09-26** (tiles, 172 countries each time): 10%/z5
  636 KB, **5%/z5 446 KB (chosen)**, 3%/z5 348 KB, 3%/z4 229 KB, 1.5%/z5
  257 KB. At 5% Norway's coast, the Danish islands and the Aegean still
  read at continent zoom.
- `worldPicker.test.ts` checks that the picker holds exactly the Countries
  maps' countries, each on the continent whose map lists it.
- **The land underneath** (FT-77): a `land` layer, all of admin-0 unclipped
  (to 60° S) and dissolved into one shape. Greenland, Antarctica and the
  parts the clips cut away (French Guiana, Hawaii) would otherwise be holes.
  mapshaper writes it with `geojson-type=FeatureCollection`, since with no
  fields left it would write a GeometryCollection, which tippecanoe skips.
  With it the tiles are **531 KB**.

### Germany's towns in six parts, from Wikidata (built 2026-09-24, #39 batch C)

Six maps of 60 towns each, by state; the reasoning is in DECISIONS.md,
"Germany's towns come from Wikidata". Node only for the fetch, WSL for the
build as usual:

```
npx tsx data/scripts/fetch-wikidata-places.ts --country=germany --min-population=15000

G='--country=Germany --source=data/places/germany.geojson --min-population=20000 --max-count=60 --min-spacing=5'
npx tsx data/scripts/build-points-map.ts $G --admin1="Schleswig-Holstein,Hamburg,Niedersachsen,Bremen,Mecklenburg-Vorpommern" --out=data/maps/germany-towns-north --name="Germany — Towns — North"
npx tsx data/scripts/build-points-map.ts $G --admin1="Nordrhein-Westfalen" --out=data/maps/germany-towns-west --name="Germany — Towns — West"
npx tsx data/scripts/build-points-map.ts $G --admin1="Hessen,Rheinland-Pfalz,Saarland" --out=data/maps/germany-towns-center --name="Germany — Towns — Center"
npx tsx data/scripts/build-points-map.ts $G --admin1="Berlin,Brandenburg,Sachsen,Sachsen-Anhalt,Thüringen" --out=data/maps/germany-towns-east --name="Germany — Towns — East"
npx tsx data/scripts/build-points-map.ts $G --admin1="Baden-Württemberg" --out=data/maps/germany-towns-southwest --name="Germany — Towns — South-West"
npx tsx data/scripts/build-points-map.ts $G --admin1="Bayern" --out=data/maps/germany-towns-southeast --name="Germany — Towns — South-East"
npx tsx data/scripts/build-facts.ts --map=<each of the above>
```

- `fetch-wikidata-places.ts` runs two SPARQL queries (towns with names and
  coordinates; their population statements since 2011) - joined in one, the
  endpoint needs most of its 60-second limit. It throttles a client that has
  used a minute of query time in the last minute, which shows up as
  "other side closed" or a 503: wait a minute and rerun.
- `--source` reads the snapshot; map.json records it as `placesSource`, and
  `build-facts.ts` matches each town against the same file (population, state,
  capital). The attribution names Wikidata as well as Natural Earth.
- `--admin1` keeps the towns of the listed ADM1NAMEs - here the German state
  names the snapshot writes from the AGS prefix.
- `--min-spacing=<km>` (`placeSelection.ts`'s `spacedOut`) skips a town within
  that distance of a bigger one already kept.

| Map | Smallest town | Closest pair |
|---|---|---|
| germany-towns-north | 33 768 | 7.2 km |
| germany-towns-west | 57 961 | 5.2 km |
| germany-towns-center | 25 401 | 5.1 km |
| germany-towns-east | 27 064 | 7.2 km |
| germany-towns-southwest | 27 700 | 6.2 km |
| germany-towns-southeast | 22 011 | 5.2 km |

### Admin-2, and four new countries (built 2026-09-24, #39 batch D)

The rules are in DECISIONS.md, "Admin-2 maps, and the first boundaries not in
the public domain". `fetch-natural-earth.sh` now also fetches the two
geoBoundaries files into `data/source/geoboundaries/`.

New `build-map.ts` options:

- `--rename="Fingal=Dublin,Laoighis=Laois"` renames before the dissolve, so
  `--dissolve=name` can merge pieces into one target;
- `--source=<geojson>` builds from a file outside Natural Earth, reading
  `--source-name-field` (default `shapeName`) through `--clean-names`
  (`admin2.ts`); `--attribution` is the credit its licence asks for, and
  map.json records `boundarySource` so `build-facts.ts` does not describe a
  district by its state's Natural Earth row;
- `--within=<admin-1 names>` keeps the targets whose interior point is in
  those areas of `--country` (nearest area for one that is in none).

```
FR=(--country=France --type=province "--exclude=Guyane française,Martinique,Guadeloupe,La Réunion,Mayotte")
npx tsx data/scripts/build-map.ts "${FR[@]}" --out=data/maps/france-departments --name="France — Departments"
npx tsx data/scripts/build-map.ts "${FR[@]}" --lat-min=46.8 --out=data/maps/france-departments-north --name="France — Departments — North"
npx tsx data/scripts/build-map.ts "${FR[@]}" --lat-max=46.8 --out=data/maps/france-departments-south --name="France — Departments — South"
npx tsx data/scripts/build-map.ts --country=Spain --type=province --exclude="Ceuta,Melilla,Santa Cruz de Tenerife,Las Palmas" --out=data/maps/spain-provinces --name="Spain — Provinces"
npx tsx data/scripts/build-map.ts --country=Ireland --type=county --dissolve=name --rename="Fingal=Dublin,South Dublin=Dublin,Dún Laoghaire–Rathdown=Dublin,North Tipperary=Tipperary,South Tipperary=Tipperary,Laoighis=Laois" --out=data/maps/ireland-counties --name="Ireland — Counties"
npx tsx data/scripts/build-map.ts --country=Switzerland --type=region --out=data/maps/switzerland-cantons --name="Switzerland — Cantons"
npx tsx data/scripts/build-map.ts --country=Austria --type=state --out=data/maps/austria-states --name="Austria — States"
npx tsx data/scripts/build-map.ts --country=Romania --type=county --out=data/maps/romania-counties --name="Romania — Counties"

DE=(--country=Germany --type=county --source=data/source/geoboundaries/DEU-ADM3.geojson --clean-names=german-districts --dissolve=name "--attribution=© GeoBasis-DE / BKG 2023, dl-de/by-2-0 (via geoBoundaries)")
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Schleswig-Holstein,Hamburg,Niedersachsen,Bremen,Mecklenburg-Vorpommern" --out=data/maps/germany-districts-north --name="Germany — Districts — North"
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Nordrhein-Westfalen" --out=data/maps/germany-districts-west --name="Germany — Districts — West"
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Hessen,Rheinland-Pfalz,Saarland" --out=data/maps/germany-districts-center --name="Germany — Districts — Center"
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Berlin,Brandenburg,Sachsen,Sachsen-Anhalt,Thüringen" --out=data/maps/germany-districts-east --name="Germany — Districts — East"
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Baden-Württemberg" --out=data/maps/germany-districts-southwest --name="Germany — Districts — South-West"
npx tsx data/scripts/build-map.ts "${DE[@]}" --within="Bayern" --out=data/maps/germany-districts-southeast --name="Germany — Districts — South-East"

NL=(--country=Netherlands --type=region --source=data/source/geoboundaries/NLD-ADM2.geojson --dissolve=name "--attribution=Kadaster / CBS via geoBoundaries (CC0)")
npx tsx data/scripts/build-map.ts "${NL[@]}" --within="Groningen,Friesland,Drenthe" --out=data/maps/netherlands-municipalities-north --name="Netherlands — Municipalities — North"
npx tsx data/scripts/build-map.ts "${NL[@]}" --within="Overijssel,Flevoland,Gelderland" --out=data/maps/netherlands-municipalities-east --name="Netherlands — Municipalities — East"
npx tsx data/scripts/build-map.ts "${NL[@]}" --within="Noord-Holland,Utrecht" --out=data/maps/netherlands-municipalities-west --name="Netherlands — Municipalities — West"
npx tsx data/scripts/build-map.ts "${NL[@]}" --within="Zuid-Holland,Zeeland" --out=data/maps/netherlands-municipalities-southwest --name="Netherlands — Municipalities — South-West"
npx tsx data/scripts/build-map.ts "${NL[@]}" --within="Noord-Brabant,Limburg" --out=data/maps/netherlands-municipalities-south --name="Netherlands — Municipalities — South"

npx tsx data/scripts/build-facts.ts --map=<each of the above>
```

| Map | Targets | Map | Targets |
|---|---|---|---|
| france-departments | 96 | germany-districts-north | 71 |
| france-departments-north | 48 | germany-districts-west | 53 |
| france-departments-south | 48 | germany-districts-center | 68 |
| spain-provinces | 48 | germany-districts-east | 68 |
| ireland-counties | 26 | germany-districts-southwest | 44 |
| switzerland-cantons | 26 | germany-districts-southeast | 96 |
| austria-states | 9 | netherlands-municipalities-north | 40 |
| romania-counties | 42 | netherlands-municipalities-east | 82 |
| | | netherlands-municipalities-west | 69 |
| | | netherlands-municipalities-southwest | 66 |
| | | netherlands-municipalities-south | 87 |

Germany's six add up to its 400 Kreise and the Netherlands' five to its 344
municipalities. `mapshaper -dissolve name` reads a bare `name` as its own
`name=` option, so a dissolve on the name field passes `fields=name`.

### Poland's powiats, and eleven new countries (built 2026-09-24, #39 batch E)

The rules are in DECISIONS.md, "Poland's powiats under ODbL, and eleven more
countries". `fetch-natural-earth.sh` now also fetches `POL-ADM2`. The maps
were built in the WSL clone with `PMTILES_BIN=$HOME/.local/bin/pmtiles`.

New `build-map.ts` options:

- `--disambiguate-by=<field>` gives a target whose name occurs twice in the
  source its admin-1 area, named from `<field>` through the country's
  `NAME_FIXUPS`: "powiat brzeski (Opolskie)". It is worked out over the whole
  country before `--within`, so the suffix is the same on every part.
- `--clip` now also cuts admin-1 maps (Chile, South Africa).
- `--clean-names=polish-counties` (`admin2.ts`).

Reader-facing names (#182): a powiat's `name` ("powiat oleski") stays as it is,
because the tiles join on it, but `names` carries "oleski" so the redundant
prefix never shows. `build-map.ts` writes `names` for `--clean-names=polish-counties`;
`npx tsx data/scripts/label-polish-counties.ts` patched the five committed
`map.json` files without rebuilding any tile.

```
PL=(--country=Poland --type=county --source=data/source/geoboundaries/POL-ADM2.geojson --clean-names=polish-counties --disambiguate-by=name_pl "--attribution=© OpenStreetMap contributors, ODbL (via geoBoundaries)")
npx tsx data/scripts/build-map.ts "${PL[@]}" --within="West Pomeranian,Pomeranian,Kuyavian-Pomeranian,Warmian-Masurian" --out=data/maps/poland-counties-north --name="Poland — Counties — North"
npx tsx data/scripts/build-map.ts "${PL[@]}" --within="Lubusz,Greater Poland,Lower Silesian" --out=data/maps/poland-counties-west --name="Poland — Counties — West"
npx tsx data/scripts/build-map.ts "${PL[@]}" --within="Masovian,Podlachian,Łódź" --out=data/maps/poland-counties-east --name="Poland — Counties — East"
npx tsx data/scripts/build-map.ts "${PL[@]}" --within="Lublin,Subcarpathian,Świętokrzyskie" --out=data/maps/poland-counties-southeast --name="Poland — Counties — South-East"
npx tsx data/scripts/build-map.ts "${PL[@]}" --within="Opole,Silesian,Lesser Poland" --out=data/maps/poland-counties-south --name="Poland — Counties — South"

npx tsx data/scripts/build-map.ts --country=Belgium --type=province --out=data/maps/belgium-provinces --name="Belgium — Provinces"
npx tsx data/scripts/build-map.ts --country="Czech Republic" --type=region --out=data/maps/czechia-regions --name="Czechia — Regions"
npx tsx data/scripts/build-map.ts --country=Croatia --type=county --name-field=adm1_code --out=data/maps/croatia-counties --name="Croatia — Counties"
npx tsx data/scripts/build-map.ts --country=Greece --type=region --out=data/maps/greece-regions --name="Greece — Regions"
npx tsx data/scripts/build-map.ts --country=Bulgaria --type=province --out=data/maps/bulgaria-provinces --name="Bulgaria — Provinces"
npx tsx data/scripts/build-map.ts --country=Chile --type=region --clip=-76,-56.5,-66,-17 --out=data/maps/chile-regions --name="Chile — Regions"
npx tsx data/scripts/build-map.ts --country=Peru --type=region --out=data/maps/peru-regions --name="Peru — Regions"
npx tsx data/scripts/build-map.ts --country="South Africa" --type=province --clip=16,-36,33.5,-22 --out=data/maps/south-africa-provinces --name="South Africa — Provinces"
npx tsx data/scripts/build-map.ts --country=Iran --type=province --out=data/maps/iran-provinces --name="Iran — Provinces"
npx tsx data/scripts/build-map.ts --country=Thailand --type=province --out=data/maps/thailand-provinces --name="Thailand — Provinces"
npx tsx data/scripts/build-map.ts --country="Saudi Arabia" --type=region --out=data/maps/saudi-arabia-regions --name="Saudi Arabia — Regions"

npx tsx data/scripts/build-points-map.ts --country=Chile --name-field=NAME_ES --min-population=100000 --out=data/maps/chile-towns-100k --name="Chile — Towns"
npx tsx data/scripts/build-points-map.ts --country=Peru --name-field=NAME_ES --min-population=100000 --out=data/maps/peru-towns-100k --name="Peru — Towns"
npx tsx data/scripts/build-points-map.ts --country="South Africa" --min-population=100000 --out=data/maps/south-africa-towns-100k --name="South Africa — Towns"
npx tsx data/scripts/build-points-map.ts --country=Iran --min-population=100000 --out=data/maps/iran-towns-100k --name="Iran — Towns"
npx tsx data/scripts/build-points-map.ts --country=Thailand --min-population=100000 --out=data/maps/thailand-towns-100k --name="Thailand — Towns"
npx tsx data/scripts/build-points-map.ts --country="Saudi Arabia" --min-population=100000 --out=data/maps/saudi-arabia-towns-100k --name="Saudi Arabia — Towns"

npx tsx data/scripts/build-facts.ts --map=<each of the above>
npx tsx data/scripts/build-map-index.ts
```

| Map | Targets | Map | Targets |
|---|---|---|---|
| poland-counties-north | 85 | chile-regions | 16 |
| poland-counties-west | 79 | chile-towns-100k | 24 |
| poland-counties-east | 83 | peru-regions | 26 |
| poland-counties-southeast | 62 | peru-towns-100k | 22 |
| poland-counties-south | 71 | south-africa-provinces | 9 |
| belgium-provinces | 11 | south-africa-towns-100k | 32 |
| czechia-regions | 14 | iran-provinces | 31 |
| croatia-counties | 21 | iran-towns-100k | 56 |
| greece-regions | 14 | thailand-provinces | 77 |
| bulgaria-provinces | 28 | thailand-towns-100k | 26 |
| | | saudi-arabia-regions | 13 |
| | | saudi-arabia-towns-100k | 22 |

Poland's five add up to its 380 powiats. Rebuilt with the changed builders,
`germany-districts-southeast`, `netherlands-municipalities-south`,
`spain-provinces` and `europe-cities-central` come out byte-identical;
`poland-regions` and `poland-towns-100k` differ from the committed tiles in
the `.pmtiles` only, and identically with `main`'s builders - the WSL
clone's tool versions, not this change.

### Eight new countries (built 2026-10-02, v0.17, #163)

Denmark, Kazakhstan, Kenya, New Zealand, Norway, the Philippines, Serbia and
Venezuela. Built in the WSL clone (`PMTILES_BIN=$HOME/.local/bin/pmtiles`).
geoBoundaries (pinned commit, `fetch-natural-earth.sh`) where Natural Earth is
out of date or missing: Kenya (47 counties, public domain), Kazakhstan (16
regions, 2017 borders: no Abai, Jetisu, Ulytau, Turkistan; ODbL), Norway (11
counties, the 2020-23 set with Viken; CC BY 4.0), Serbia (25 districts, ODbL),
the Philippines (17 regions, and 87 provinces as an advanced map; CC BY 3.0
IGO). Natural Earth for Denmark (5 regions), New Zealand (16 regions, without
the Chatham Islands, Tokelau and the sub-Antarctic islands) and Venezuela (24
states, without the Dependencias Federales and the Guayana Esequiba strip,
`--exclude-field=adm1_code`). Names go through `NAME_FIXUPS` (register nouns
dropped, #182).

```
G=data/source/geoboundaries
npx tsx data/scripts/build-map.ts --country=Kenya --type=county --source=$G/KEN-ADM1.geojson "--attribution=RCMRD GeoPortal, public domain (via geoBoundaries)" --out=data/maps/kenya-counties --name="Kenya — Counties"
npx tsx data/scripts/build-map.ts --country=Kazakhstan --type=region --source=$G/KAZ-ADM1.geojson "--attribution=© OpenStreetMap contributors, ODbL (via geoBoundaries)" --out=data/maps/kazakhstan-regions --name="Kazakhstan — Regions"
npx tsx data/scripts/build-map.ts --country=Norway --type=county --source=$G/NOR-ADM1.geojson "--attribution=© Kartverket, CC BY 4.0 (via geoBoundaries)" --out=data/maps/norway-counties --name="Norway — Counties"
npx tsx data/scripts/build-map.ts --country=Serbia --type=district --source=$G/SRB-ADM1.geojson "--attribution=© OpenStreetMap contributors, ODbL (via geoBoundaries)" --out=data/maps/serbia-districts --name="Serbia — Districts"
npx tsx data/scripts/build-map.ts --country=Philippines --type=region --source=$G/PHL-ADM1.geojson "--attribution=NAMRIA, PSA, OCHA Philippines, CC BY 3.0 IGO (via geoBoundaries)" --out=data/maps/philippines-regions --name="Philippines — Regions"
npx tsx data/scripts/build-map.ts --country=Philippines --type=province --source=$G/PHL-ADM2.geojson "--attribution=NAMRIA, PSA, OCHA Philippines, CC BY 3.0 IGO (via geoBoundaries)" --out=data/maps/philippines-provinces --name="Philippines — Provinces"
npx tsx data/scripts/build-map.ts --country="New Zealand" --type=region --exclude="Auckland Islands,Campbell Islands,Antipodes Islands,Chatham Islands Territory,Kermadec Islands,Tokelau,The Snares,Three Kings Islands" --out=data/maps/new-zealand-regions --name="New Zealand — Regions"
npx tsx data/scripts/build-map.ts --country=Venezuela --type=state --exclude-field=adm1_code --exclude="VEN-44,VEN+99?" --out=data/maps/venezuela-states --name="Venezuela — States"
npx tsx data/scripts/build-map.ts --country=Denmark --type=region --out=data/maps/denmark-regions --name="Denmark — Regions"

npx tsx data/scripts/build-points-map.ts --country=Philippines --min-population=100000 --out=data/maps/philippines-towns-100k --name="Philippines — Towns"
npx tsx data/scripts/build-points-map.ts --country=Kazakhstan --min-population=100000 --out=data/maps/kazakhstan-towns-100k --name="Kazakhstan — Towns"
npx tsx data/scripts/build-points-map.ts --country=Venezuela --min-population=100000 --out=data/maps/venezuela-towns-100k --name="Venezuela — Towns"
# Natural Earth lists too few towns over 100 000 in these (4-7), so 50 000:
npx tsx data/scripts/build-points-map.ts --country=Kenya --min-population=50000 --exclude="Kendu Bay,Sotik" --out=data/maps/kenya-towns-50k --name="Kenya — Towns"
npx tsx data/scripts/build-points-map.ts --country="New Zealand" --min-population=50000 --exclude="North Shore,Waitakere,Manukau" --out=data/maps/new-zealand-towns-50k --name="New Zealand — Towns"
npx tsx data/scripts/build-points-map.ts --country=Norway --min-population=50000 --exclude="Bærum" --out=data/maps/norway-towns-50k --name="Norway — Towns"
npx tsx data/scripts/build-points-map.ts --country=Denmark --min-population=50000 --out=data/maps/denmark-towns-50k --name="Denmark — Towns"
npx tsx data/scripts/build-points-map.ts --country=Serbia --min-population=50000 --out=data/maps/serbia-towns-50k --name="Serbia — Towns"
```

Targets: kenya-counties 47, kazakhstan-regions 16, norway-counties 11,
serbia-districts 25, philippines-regions 17, philippines-provinces 87,
new-zealand-regions 16, venezuela-states 24, denmark-regions 5; towns 31
(Philippines), 20 (Kazakhstan), 31 (Venezuela), 16 (Kenya), 15 (New Zealand),
8 (Norway), 6 (Denmark), 7 (Serbia). Not done: German/Italian facts for these
(v0.18), and towns from Wikidata where Natural Earth is thin.

## The Terrain layer: `terrain.pmtiles` (FT-33, 2026-09-19)

Every map has a **second** tileset beside its `tiles.pmtiles`, holding the
sea, the rivers and the named physical features around it. The app's Terrain
button (map bar, beside the language pills) fetches it on demand; it is off
by default, so a player who never presses the button never downloads it.

**Four layers**, all clipped to the map's padded extent (`-clipsrc`, not
`-spat`: the ocean is a single global polygon, so a bbox *filter* would hand
every map the whole world's coastline):

| Layer             | Source                                      | What it is                                                |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| `sea`             | `ne_10m_ocean`                              | the water, so a coastline reads at all                     |
| `rivers`          | `ne_10m_rivers_lake_centerlines`            | rivers only — lake centerlines and canals are left out     |
| `terrain`         | `ne_10m_geography_regions_polys`            | named ranges, deserts, plateaus, basins, coasts            |
| `physical_labels` | the two above + marine polys                | one point per named feature, with `name_de` and `name_it`  |
| `peaks`           | `ne_10m_geography_regions_elevation_points` | named summits with their height (FT-37)                    |
| `lines`           | `ne_10m_geographic_lines`                   | Equator, Tropics, Polar Circles, Date Line (FT-37)         |

Islands, island groups, continents, NE's three "Lake" polygons and its
`Dragons-be-here` joke entry are skipped: they either restate the coastline
the sea layer already draws, or are too broad to be a mnemonic.

**Peaks (FT-37) use two of the six elevation-point classes.** `mountain`
(633 of the 711, and the famous volcanoes are here — Vesuvio, Monte Etna,
Fuji, Nevado del Ruiz — even though Natural Earth does not flag a volcano
as such) and `depression` (nine, but one of them is the Qattara Depression).
The other four are unusable rather than merely uninteresting: every
`spot elevation` row has a **null name**, and the `plateau` rows are
Antarctic research stations — "Vostok Station (Rus.)", and **"Fuji Station
(Japan)" at 3 810 m**, which outranks the real Fuji at 3 776 m and is why
the class filter matters rather than just taking the tallest rows. Each map
keeps its **12 tallest** (`PEAKS_PER_MAP`); China has 97 in its box and
Russia 87, and a map that writes them all is a wall of text the collision
pass then hides. Named depressions are kept whatever the cap.

**A trap worth naming**, because it cost a build: the ogr2ogr select renames
`featurecla` to `kind` for every layer here, so `selectPeaks` filters on
`kind`. Reading `featurecla` instead silently matched nothing and tippecanoe
dropped the empty layer without a word — `pmtiles show --metadata` listing
the layers is what caught it, not a screenshot.

### Where a terrain name goes (fixed 2026-09-19)

Two labels on the Italy map ended up in the sea, and the product owner found
both by reading the map. The fix is one rule with two halves: **the label
point is computed from the feature's WHOLE geometry, and it has to be inside
the feature.**

- **Inside, not the middle of the box.** The Apennines follow the peninsula,
  so the centre of their bounding box is off the ridge and out to sea.
  `interiorPoint` (`factGeometry.ts`) walks horizontal slices and takes the
  middle of the widest run that is actually inside the shape.
- **The whole feature, not the clipped remnant.** The Balkan Peninsula runs
  to 29.7° E; clipped to Italy's box it keeps only its western sliver, whose
  middle is in the Adriatic. So the label pass reads the sources with
  `-spat` (a filter, whole shapes) while the fills still use `-clipsrc` (a
  cut) — and a feature whose own interior point is off this map is **left
  out entirely**, because its name is about somewhere else.
- **Except when it covers the map.** The Sahara's interior point is in
  Algeria, but a map of Egypt should still say SAHARA. A feature covering at
  least 35 % of the map (`coverageOf`, sampled on a grid) keeps its name,
  placed inside the part that shows.

**`TERRAIN_NAME_FIXUPS`** corrects Natural Earth's own translations where
they are wrong rather than merely different — the same mechanism and
reasoning as `build-map.ts`'s `NAME_FIXUPS`. So far one entry: the feature
named `APPENNINI` carries `name_it` "Appennino ligure" and `name_de`
"Ligurischer Apennin", naming one sub-range at the north-west end of a
chain that runs the length of Italy. A third of the 581 named land features
have a localized name longer than the English one, and nearly all of those
are ordinary translations ("Penisola di Taz", "Selva Boema"), so there is no
heuristic here — only a list, added to when someone reads the map and finds
one wrong.

**Two numbers are chosen per map, not fixed:**

- **The clip box** is the targets' extent padded by 25 % (`padBbox`), so the
  sea reaches the screen edge — the app fits a map to its targets and then
  pads that fit in pixels (`mapFit.ts`), so the visible area is always wider
  than the targets.
- **The label box is tighter** (5 %). The polygons need the generous box;
  the *names* do not. Without this, Italy's map labels the Atlas Saharien
  and the Böhmerwald.
- **The maximum zoom** follows the map's extent:
  `min(6, max(4, round(log2(360 / span)) + 3))`. Cost here is driven by
  extent, not detail — Russia is 850 KB at zoom 6, and simplifying its
  vertices ten times harder only reaches 547 KB, while one zoom level less
  reaches 553 KB and two reach 385 KB. Past the built maximum MapLibre
  over-zooms: a slightly soft coastline on a background layer, nothing more.

`--drop-rate=1` is **required** on this tileset, the same as on a towns map:
without it tippecanoe thins point features at low zoom and silently drops
ALPS and APPENNINI from Italy — the two names the layer exists for — while
keeping smaller ranges further out.

**Building it.** New maps get one from `build-map.ts` / `build-points-map.ts`
automatically. For a map that already exists:

```bash
npx tsx data/scripts/build-terrain.ts --map=italy-regions
npx tsx data/scripts/build-terrain.ts --all          # skips maps that have one
npx tsx data/scripts/build-terrain.ts --all --force  # rebuilds every one
```

The 63 maps shipping today were backfilled with `--all --force` on
2026-09-19: **5.16 MB in total** (4.94 MB before FT-37 added peaks and
lines), from 6.6 KB (portugal-towns-100k) to 394 KB (russia-regions),
averaging 84 KB. Their `tiles.pmtiles` were
deliberately **not** rebuilt — the Terrain layer is a separate archive, so
the existing tilesets did not change, and rebuilding them anyway would have
meant 63 binary files in one commit for no reason (see the next section).

## The derived fact: `facts.json` (FT-34, 2026-09-19)

Every map has a `facts.json` beside its `map.json`, one entry per target,
written by `data/scripts/build-facts.ts` and holding **structured fields,
not sentences** — a population, a list of neighbours, a compass position.
`app/src/lib/facts.ts` turns those into clauses at run time through the i18n
dictionary, which is what makes the derived half trilingual without a word
of it being translated by hand.

```bash
npx tsx data/scripts/build-facts.ts --map=italy-regions
npx tsx data/scripts/build-facts.ts --all
```

Since FT-41 every one of the 2 235 targets also carries authored `hooks`,
three sentences deep, from the 28 country files in `data/facts/`. That took
the total from 503 KB to **1.4 MB over all 63 maps** — the largest single
file is `italy-provinces` at 64 KB. `facts.json` is fetched lazily and per
map, so what matters is that per-map figure, not the total; no map's file
approaches the size of its tileset.

Since FT-45 the app reads only four of those fields - `hooks`, `kind`,
`largestCity`, and `region`/`populationRank` for a town. The rest are still
written and still shipped: about **0.20 MB of the 1.4 MB** across all 63
maps is fields nothing currently displays. That is deliberate. Keeping them
means a dropped clause can come back in one line of `factClauses` with no
rebuild of anything; the alternative saves a fifth of a megabyte and makes
that a data migration. Revisit if the figure grows.

**Coverage over the 2 235 targets** (measured 2026-09-19, 503 KB in total):

| Field                    | Targets   |     | Field            | Targets   |
| ------------------------ | --------- | --- | ---------------- | --------- |
| `coastal`, `position`    | 2 235 · 100 % |  | `largestCity`    | 911 · 41 % |
| `population` (+ rank)    | 1 182 · 53 %  |  | `population1950` | 360 · 16 % |
| `borders`                | 1 031 · 46 %  |  | `peak`           | 193 · 9 %  |
| `region`                 | 1 008 · 45 %  |  | `localName`      | 174 · 8 %  |
| `type`                   | 985 · 44 %    |  | `capitalOf`      | 28 · 1 %   |

**Three things here were found the hard way and are worth keeping:**

- **Coastal is decided by shared vertices, not by distance.** Natural
  Earth's admin-1 polygons and its coastline are generalised from the same
  land, so a coastal region's boundary *shares vertices* with the coastline.
  Hashing the coastline to a hundredth of a degree and testing a region's
  own boundary against it returns, for Italy, exactly the five landlocked
  regions (Valle d'Aosta, Piemonte, Lombardia, Trentino-Alto Adige, Umbria)
  and the fifteen coastal ones. A town, having no boundary, falls back to a
  distance test.
- **Source rows are matched to targets by extent, never by name.** A map may
  be dissolved (no admin-1 row is called "Piemonte" — the regions come from
  the provinces), and surviving names are often rewritten on the way out
  (Apulia → Puglia). The test is **containment, then smallest**: comparing
  corners fails because simplification drops small outlying islands, so
  Sicily's source rows reach Lampedusa at 35.5° N while its target stops at
  36.7° N — more than a degree out, same shape. With containment, all 110 of
  Italy's provinces and all 20 of its regions match.
- **`POP1950`…`POP2050` are in THOUSANDS**, unlike `POP_MAX`, which is
  absolute. Seattle's row reads 795 against a `POP_MAX` of 3 074 000. Both
  are right once multiplied out and both are nonsense if they are not.

`facts.json` rebuilds byte-identically (checked on `italy-regions` and
`usa-cities`), and `mapData.test.ts` requires every target to have exactly
one entry and every entry to belong to a target.

## What reproduces, and what doesn't

`map.json` and `tour.json` are reproducible: rebuilding a shipped map with
the current scripts produces byte-identical files, which is how each new
flag has been shown to be a no-op at its defaults (`--min-count`/
`--max-count` in 2026-09-13, the slice flags in 2026-09-18).

`tiles.pmtiles` is **not** byte-stable across toolchain versions. Rebuilding
`italy-towns-100k` on tippecanoe v2.49.0 in 2026-09-18 produced a tileset
five bytes shorter and differing from byte 32 on, from identical input (the
`map.json` was unchanged). Nothing is wrong with either file; tile packing
is simply not promised to be deterministic between versions. So: **don't
commit a rebuilt tileset unless the map itself changed** — it is a 200 KB
diff that says nothing.

`terrain.pmtiles` *is* byte-stable within one toolchain version: building
`italy-regions` twice in a row on tippecanoe v2.49.0 gave the same MD5
(2026-09-19). The label file it contains is sorted by name for exactly that
reason. The cross-version caveat above still applies to it.

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
- **Missing country/region contours — found by the user actually looking
  at a finished towns map, not anticipated in the design pass.** A point
  map's markers floated over plain background with no visible country
  outline or internal admin-1 borders — a polygon map never has this gap
  because the target polygons themselves, filled edge to edge, already
  show the whole country. Fixed the same way as the lakes context layer:
  a new `context` source-layer (`selectCountryContext()` in
  `mapBuildUtils.ts`, reusing the same `ne_10m_admin_1_states_provinces`
  dataset `build-map.ts` uses for actual polygon targets, filtered by
  `admin='{country}'`), rendered by new `context-fill`/`context-outline`
  style layers positioned beneath `lakes-fill`/the targets layers in
  `base.json` — purely visual, no hit-testing, no feature-state, same
  treatment as `lakes-fill`. A polygon map's tileset has no `context`
  source-layer, so the two new style layers are a harmless no-op for it,
  same pattern as `targets-circle` being a no-op for a polygon map.
  Verified via screenshot: both `italy-towns-100k` and
  `germany-towns-100k` now show the country's full outline and internal
  admin-1 borders behind the markers, and `germany-states` (a polygon
  map) renders unchanged with no console errors.

**Land context and family colors (v0.16, proposal #146):** admin-1 maps
and single-country towns maps now carry a separate `land` source-layer
made from nearby Natural Earth admin-0 polygons, clipped to the padded
map extent and excluding the mapped country. The style draws this as
quiet land beneath the blue sea background; it does not participate in
target interaction. The existing `context` layer remains the mapped
country's admin-1 geometry on towns maps and neighboring countries on
Countries maps. On single-country city maps, `geoclickMap.ts` gives the
mapped-country context a brighter fill while nearby land stays muted. On
multi-country city maps, the context layer contains the surrounding
countries, so that entire context uses the brighter city treatment.
Ordinary polygon targets are opaque so their palette is not tinted by the
sea color beneath them. Since `land` is baked into PMTiles, changing its
selection requires rebuilding the map tiles as well as the style.
All currently shipping single-country polygon and point maps were rebuilt
with the `land` layer. Country-level and multi-country maps already carry
their surrounding countries in the `context` layer and did not need a new
land layer. `germany-states` and `germany-towns-100k` were opened in the
local app with Terrain off as representative visual checks: neighboring
land reads warm-neutral against the blue sea, and the towns map gives
Germany its brighter country-context fill. The downloaded Natural Earth
inputs remain in ignored `data/source/`; only regenerated `tiles.pmtiles`
archives are committed.

**Sequencing:** `italy-provinces` needed none of the above and shipped
first. `italy-towns-100k`/`germany-towns-100k` needed all of it —
`build-points-map.ts`, the `targets-circle` style layer, the
hit-testing/camera-framing changes, and the two fixes found only by
actually testing the built maps (tippecanoe's zoom-dependent dropping,
the dense-cluster tolerance bug) — real work, not a footnote.
