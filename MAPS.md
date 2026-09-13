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
   sanity check — every target labeled at once) before committing.
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
  it, so other maps' output is byte-identical. Not backfilled: the
  committed `russia-regions/map.json` gains the flag on its next rebuild.
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

**Sequencing:** `italy-provinces` needed none of the above and shipped
first. `italy-towns-100k`/`germany-towns-100k` needed all of it —
`build-points-map.ts`, the `targets-circle` style layer, the
hit-testing/camera-framing changes, and the two fixes found only by
actually testing the built maps (tippecanoe's zoom-dependent dropping,
the dense-cluster tolerance bug) — real work, not a footnote.
