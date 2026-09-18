# v0.7.0 — More maps, and slices of them (planned 2026-09-18)

The programme that follows [PLAN_V0.6.md](PLAN_V0.6.md), which closed with
v0.6.0. That release changed how the game plays; this one changes how much
there is to play. The United States has states but no cities — the most
obvious gap in the collection — and the biggest countries have more cities
than one map can hold, so some maps get cut into regional slices.

**Status: planned.** The product decisions below were taken by the product
owner on 2026-09-18; no task is started.

Input: the product owner's request ("US cities is the prominent one that is
missing… even have additional sub-maps… similar game for Italy and Germany…
evaluate also what other maps to add"), and the counts measured from
`data/source/ne_10m_populated_places` on the same day, recorded under "What
the source data holds" below.

---

## Product decisions (2026-09-18)

| #   | Question                                | Decision                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How do US cities become maps?           | **One national map of the 50 biggest, plus three regional slices at 200 k.** The national map is every city over a million — exactly 50, the same size as every other towns map. The slices are East (82), Center (49) and West (46), split at longitude −87 (roughly the Mississippi) and −104 (roughly the Rockies). |
| 2   | Lower thresholds for Italy and Germany? | **No — split Italy's provinces instead.** Natural Earth thins out below 100 k (Italy 40 → 53 at 50 k; Germany 49 → 58), so a lower threshold adds a dozen names, not a new game. Italy's 110 provinces, which already exist, split into North (52), Center (24) and South (34). Germany keeps the maps it has.         |
| 3   | How many new countries?                 | **Six, with both maps each:** Turkey, Nigeria, Vietnam, Colombia, Egypt, South Korea. Twelve new maps.                                                                                                                                                                                                                 |
| 4   | How is a slice labelled?                | **The map-type label carries the region:** a country's cards read "States", "Cities", "Cities — East", "Cities — Center", "Cities — West". No new grouping level on the home page.                                                                                                                                     |

## What the source data holds

Measured from `ne_10m_populated_places` (7 342 places) and
`ne_10m_admin_1_states_provinces` (4 596 rows), 2026-09-18.

**United States — cities clearing each threshold**

| ≥ 1 M | ≥ 500 k | ≥ 200 k | ≥ 150 k | ≥ 100 k |
| ----- | ------- | ------- | ------- | ------- |
| 50    | 93      | 177     | 213     | 281     |

**The chosen split, at ≥ 200 k:** East 82 · Center 49 · West 46.
(At 100 k it would be 126 · 87 · 68, and the East slice would be larger than
Italy — Provinces, today's densest map at 110.)

**Two facts that decided the shape:**

- **Density, not length, is the real limit.** At a country-wide zoom Newark
  and New York are 16.8 km apart — about two pixels, against a 24 px drop
  tolerance and a 9 px dot. A national map at 100 k would be unplayable
  around New York however well the labels behave; a regional slice zooms in
  about three times and separates them.
- **Names collide.** Fifteen names repeat among US cities ≥ 100 k
  (Springfield, Columbus, Portland, Kansas City, Charleston…). Target names
  must be unique within a map — `data/styles/base.json` keys features by
  name (`promoteId`). At ≥ 200 k only **Kansas City** collides inside a
  slice, and the top 50 has none, so the chosen thresholds keep this to a
  single case.

**The six new countries**

| Country     | Cities ≥ 100 k | Admin-1 regions |
| ----------- | -------------- | --------------- |
| Nigeria     | 51             | 37              |
| Turkey      | 50             | 81              |
| Vietnam     | 44             | 63              |
| Colombia    | 34             | 34              |
| Egypt       | 31             | 27              |
| South Korea | 26             | 17              |

Turkey's 81 provinces and Vietnam's 63 are above the comfortable size; both
get `--max-count`-style curation like China and Russia already have.

**Italy's provinces, split by latitude** (43.8° N and 41.3° N): North 52 ·
Center 24 · South 34.

---

## Tasks

One branch per task, `feat/ft-NN-…`; `npm run gates` before pushing; verify
in a real browser with screenshots; **ask the product owner before every
merge**; tick the ledger after each merge. Same rules as the previous two
programmes. 🧑 marks a point where the task stops for the product owner.

Building maps needs the WSL2 toolchain (`ogr2ogr`, `tippecanoe`, `pmtiles`),
as MAPS.md's Pipeline section describes. Every new map's exact command goes
into MAPS.md as it lands — that is the project rule, and it is what makes a
map reproducible rather than a one-off artefact.

### FT-27 — The city builder can take a slice of a country · Medium

- **Why:** the US city maps need a way to say "only this part of the
  country", and `build-points-map.ts` has no such filter today. It also has
  to stop two cities with the same name from landing in one map.
- **Do:**
  - `--lon-min` / `--lon-max` (and `--lat-min` / `--lat-max` for symmetry):
    keep only places inside the box, applied before `--min-count` /
    `--max-count` so those still mean what they say;
  - when two selected places share a name, disambiguate both with their
    `ADM1NAME` ("Kansas City, Missouri" / "Kansas City, Kansas") rather than
    dropping one, and record the plain name as an alias so the quiz still
    accepts it;
  - a `NAME_FIXUPS` entry for `Washington,  D.C.` — the source has a double
    space, the same class of typo as the Russian one already fixed there.
- **Tests:** unit tests for the slice filter and the disambiguation helper;
  rebuild `italy-towns-100k` and confirm a byte-identical `map.json` /
  `tour.json` (the established proof that a new flag changes nothing at its
  default).
- **DoD:** gates green; MAPS.md's flag documentation updated.

### FT-28 — The United States gets its cities · High · deps: FT-27

- **Do:**
  - build four maps: `usa-cities` (50, ≥ 1 M), `usa-cities-east`,
    `usa-cities-center`, `usa-cities-west` (≥ 200 k, 82 / 49 / 46);
  - audit every name against the source, as each previous batch did — the
    US list is where "Washington, D.C." and the Kansas City pair live;
  - register them in `mapCatalog.ts` and `data/maps/index.json`, with new
    type labels `mapType.cities`, `mapType.citiesEast`, `.citiesCenter`,
    `.citiesWest` in EN/DE/IT. US maps say **Cities**, not Towns: every
    entry is over 200 000 people, and "town" would read oddly for Chicago;
  - MAPS.md entries with the exact commands.
- **Tests:** a browser run of each map's quiz — in particular that Newark
  and New York are separable on the East slice, which is why the slices
  exist; the existing `mapData.test.ts` keeps catalog, index and map.json in
  step.
- **DoD:** four maps playable; gates green; MAPS.md and ONBOARDING current.

### FT-29 — Italy's provinces in three · Medium

- **Why:** 110 provinces is the densest map we ship and about half its names
  are hidden at the opening zoom (FT-23's trade-off). Thirds make each one
  readable, and give a player a way in.
- **Do:**
  - the same slice flags on `build-map.ts` (polygon maps), applied to the
    target centroids;
  - `italy-provinces-north` (52), `-center` (24), `-south` (34), labelled
    "Provinces — North" and so on;
  - the full map stays; the slices sit beside it.
- **Tests:** rebuild `italy-provinces` unchanged (byte-identical) to prove
  the flag is a no-op at its default; a browser run of one slice.
- **DoD:** three maps playable; gates green; MAPS.md current.

### FT-30 — Six countries that have no map at all · High · deps: FT-27

- **Do:** regions and cities for **Turkey, Nigeria, Vietnam, Colombia,
  Egypt, South Korea** — twelve maps, built with the existing scripts, each
  name audited against the source before it ships (every previous batch
  found real errors this way: typos, exonyms, missing diacritics).
- **Watch for:** Turkey's 81 and Vietnam's 63 regions want capping or
  keeping whole — a judgement call per country, recorded in MAPS.md;
  Egypt's and Nigeria's city names have several romanizations in the source.
- **Tests:** a browser run per country (overview and quiz); `mapData.test.ts`
  as above.
- **DoD:** twelve maps playable; gates green; MAPS.md current.

### FT-31 — The map list stays findable at sixty-plus maps · Medium

- **Why:** the home page lists every map, grouped by country. This release
  takes it from 44 maps in 22 countries to 63 in 28 — the "All maps" list
  becomes a long scroll, and Favourites and Recent carry more of the weight
  than they were designed to.
- **Do:** a way to narrow the list — a search box over country and map name
  is the cheapest honest answer; collapsing countries is the alternative.
  Whichever it is, it must work on a phone and in all three languages.
- **Tests:** browser runs at 1280 px and 390 px; the tutorial's first step
  (open Italy — Regions from the home page) still works.
- **DoD:** the list is usable at 63 maps; gates green.

### FT-32 — The items v0.6.0 left open · Low

- 🧑 **The ladder's thresholds** (25 / 60 / 85 % of a map known before the
  tray narrows to 6, 3, 1 names) and the wording "3 names at a time" — the
  product owner wanted to play with them before deciding.
- 🧑 **The Progress tab's name** — currently Progress; Known / Gewusst /
  Conoscenza was the alternative.
- **Tap targets (review F8):** the language pills (32 × 22), the favourite
  star (28 × 28), the zoom buttons (29 × 29) and the tray handle are below
  the 44 × 44 minimum. Padding, not bigger glyphs.
- **An accessibility pass:** v0.5.0's release notes flagged that the
  favourite star and the language pills lose their name and pressed state in
  the emulator's accessibility tree. Worth a TalkBack check on a real phone.
- **DoD:** each item either done or explicitly deferred with a reason.

## Order

FT-27 → FT-28 → FT-30, with FT-29 whenever convenient (it only touches the
polygon builder) and FT-31 after the map count has actually grown. FT-32 can
land any time; its two 🧑 items need the product owner first.

**→ Release `v0.7.0`** per [RELEASES.md](RELEASES.md): a beta pre-release for
the product owner's test on the phone first, then the stable release.

## Progress ledger

| Task  | State      | Merge     | Notes                                                                                                                                         |
| ----- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FT-27 | **merged** | `434d703` | slice flags + same-name disambiguation, both pure and unit-tested; the italy-towns rebuild came out byte-identical; three US name typos fixed |
| FT-28 | **merged** | `2d59d4c` | four maps: 50 over a million, then East 82 / Center 48 / West 44; four source name errors fixed; crowding measured against japan-towns        |
| FT-29 | todo       | —         |                                                                                                                                               |
| FT-30 | todo       | —         |                                                                                                                                               |
| FT-31 | todo       | —         |                                                                                                                                               |
| FT-32 | todo       | —         | 🧑 two decisions                                                                                                                              |

## Out of scope

- **Lower thresholds for Italy and Germany** (decision 2). The data does not
  support them; revisit only with a different source than Natural Earth.
- **A world map, or continents.** Natural Earth's admin-0 countries file is
  not downloaded and nothing in the pipeline reads it. A different shape of
  game, and a bigger one than this release.
- **The remaining uncovered countries** — Iran, the Philippines, Thailand,
  South Africa, Romania, Hungary, Greece, Switzerland and the rest measured
  above. They are a batch for another release, not a reason to stretch this
  one.
- **Anything about scheduling.** v0.6.0 hid the review dates deliberately;
  bringing them back as a suggestion is its own piece of design.

## Risks

- **Download size.** 44 maps are 15 MB of tiles today, and the Android APK
  is 24.5 MB. Nineteen more maps — the US city maps carry the country's
  context layer, which is the heaviest part — should add roughly 7 MB, so
  the APK lands around 31 MB. Acceptable, but worth measuring at the beta
  rather than at the store listing.
- **Curation is the real work, not the builds.** Every previous batch found
  genuine errors in the source names. Twelve maps for unfamiliar countries
  is a lot of names to check, and checking them is not something the scripts
  can do.
- **Slices are a new kind of map.** Three cards called "Cities — East",
  "Cities — Center", "Cities — West" are only obvious to someone who already
  knows the country. If they read as clutter on the home page, the fallback
  is to keep the national map and drop the slices, which is why FT-28 builds
  the national map first.
