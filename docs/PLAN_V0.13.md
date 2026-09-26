# v0.13.0 — The world map as the start screen (planned 2026-09-26)

> **Agreed** on [#58](https://github.com/diegoami/Geoclick2027/issues/58),
> 2026-09-25. The agreed design is the issue's last comment; this file holds
> the tasks. Nothing is built yet. It also carries the one finding v0.12.0
> left open, [#68](https://github.com/diegoami/Geoclick2027/issues/68), and
> [#71](https://github.com/diegoami/Geoclick2027/issues/71) (place names in
> the chosen language, agreed 2026-09-26) as FT-81.

## Why

The home screen is a list: Favourites and Recent, then **All maps**, 49
groups in alphabetical order (43 countries and 6 continents), 127 maps, and
a search box (`app/src/routes/+page.svelte:229-268`, the groups from
`app/src/lib/mapCatalog.ts:36`). The backlog entry of 2026-09-20 already said
the list "cannot be finalized". It had 66 maps then and has 127 now, with
more to come. On a tablet it takes many screens of scrolling, and much of
the clutter is countries with many maps: Germany alone has 14 buttons.

A geography game should open on the world. You go to the place you want,
tap it, and pick the kind of map.

## What was agreed (#58)

- **The app opens on the map.** The list is not lost: a **Map / List
  switch** sits at the top, and the choice is remembered on the device.
- **Two levels, world then continent.**
  - **World view:** the six continents. A tap anywhere on a continent, on
    any of its countries, **switches to that continent's view**. You always
    go through the continent.
  - **Continent view:** the continent's countries. Those with maps are
    coloured and named.
    - A country **with maps**: a **panel** opens with its maps, as cards
      with progress bar and star. It's a bottom sheet on a phone and a side
      panel on a tablet or desktop. The map stays visible, so another
      country can be tapped without closing the panel.
    - A country **with no maps**: the panel opens with **the continent's
      own maps** (Countries, Capitals, and Europe's five city maps).
    - **Tiny countries** are found here, where they have room.
    - A **World** button goes back up.
  - **The view you left**, the world or one continent, is where the app
    opens next time.
- **The list, decluttered:** **one row per country and per continent**,
  with a **listbox** of its maps. **Choosing a map opens it at once.** The
  row shows the country's progress; the per-map star stays on the map's
  own screen and in Favourites. Search filters the rows. **Favourites and
  Recent stay exactly as they are.**
- **The tutorial teaches the map:** Europe on the world view, then Italy on
  the continent view, then Italy's card in the panel.
- **The link from the map to the catalog** is an explicit id per catalog
  group ("Great Britain" → `united-kingdom`, "USA" → `united-states`), and a
  test checks that every group has one.

## What the code gives us, and what it doesn't

- **A world map is an ordinary Geoclick map.** `build-map.ts
  --level=country` (`data/scripts/build-map.ts:505-512`) already builds the
  six continents' Countries maps, 172 country targets, each with its
  `CONTINENT` (`build-map.ts:56`). The picker is one more build of the same
  kind: same pmtiles, same MapLibre view, same offline path. There's no
  second rendering stack.
- **Size is unknown.** The six Countries maps weigh about 10 MB of tiles
  together, plus 2.3 MB of terrain, at quiz detail. A picker needs far less.
  The target is under about 1.5 MB, and FT-76 measures it before anything
  is built on it. The APK is 61.5 MB today.
- **The home page is prerendered** (`app/src/routes/+layout.ts:5`), and
  MapLibre only runs in the browser. The list stays in the prerendered HTML
  and serves until the map has loaded, and whenever the map isn't wanted.
- **The tutorial's first step spotlights a list card**
  (`app/src/lib/tutorialMachine.ts:60-66`, anchor `home-map-card` at
  `+page.svelte:130` and `:264`), so it has to learn the new front door.
- **Everything else addresses maps by id:** deep links `/map/<id>`,
  Recent, Favourites and the tutorial's own map. None of that changes. The
  picker is a new way in, not a new way of naming maps.
- **Device preferences** already live in `mapPrefs.svelte.ts` (Favourites,
  Recent, Terrain: `localStorage`, read after mount). The Map / List choice
  and the last view go there too.

## Tasks

### FT-76 — The picker map, measured · Small

- **Do:** one world build of `build-map.ts --level=country` across all
  continents, at low detail, with no terrain, no facts and no tour. Each
  country target carries its continent. It's not in the catalog, and not a
  map anyone plays. Suggested id: `world-picker`.
- **Measure first:** tiles size at two or three `--min-area` and
  simplification settings; pick the smallest that still reads at continent
  zoom. **Gate:** if it can't get under about 1.5 MB, stop and bring the
  numbers to the owner before FT-77.
- **Watch:**
  - The antimeridian (Russia, Fiji): the existing handling should cover
    it; check it on the world view.
  - Overseas parts of admin-0 countries (French Guiana is part of France's
    polygon; memory rule: exclude overseas territories). On the picker a tap
    there would open France's panel. Clip them, as the country maps do.
  - Transcontinental countries: Natural Earth puts Russia in Europe, Turkey
    in Asia, Egypt in Africa. The picker follows the continents' Countries
    maps, so a country is on the continent whose maps list it. Check that
    each of the 172 is on exactly one.
  - Islands whose `CONTINENT` is "Seven seas (open ocean)" (the Maldives,
    Mauritius…) go to the continent whose Countries map already holds them.
  - *Done 2026-09-26:* each continent is filtered and clipped as its
    Countries map is, so both points hold by construction. No
    "Seven seas" country is on any Countries map, and each of the 172 is on
    exactly one continent (`worldPicker.test.ts`). Size: 446 KB. Details in
    MAPS.md, "The world picker".
- **Tests:** the picker's `map.json` has 172 country targets, each with a
  continent among the six; no target is in two.
- **DoD:** the build command in MAPS.md; the size measured and recorded in
  this file; gates green.

### FT-77 — World and continent views, and the panel · Medium · deps: FT-76

- **Do:**
  - A home-screen map view built on `createMap`, with the two levels. The
    continent view is the same map fitted to the continent, with the other
    continents dimmed and not tappable.
  - On the world view, a tap anywhere on a continent flies to it. On the
    continent view, countries with maps are coloured and named (their
    names from `mapCatalog`, translated), the rest pale and unnamed.
  - **The panel**, a bottom sheet on a phone and a side panel on a tablet
    or desktop: a country's maps as today's `mapCard`s (progress bar, star,
    one tap). For a country with no maps, the continent's maps. It stays
    open while another country is tapped, and its content changes.
  - A **World** button on the continent view.
  - The view left (world, or which continent) is stored in `mapPrefs` and
    restored on the next visit.
  - **The catalog link:** each `CountryGroup` gets a `pickerId` (the
    picker's country id, or a continent id for the six continent groups).
- **Watch:**
  - The phone's back button: on the continent view it goes to the world
    view, not out of the app (KEYCODE_BACK exits when nothing is open).
  - The panel covers the bottom of the map on a phone, so it publishes
    with `publishBottomOverlay` (FT-80 first).
  - Offline: the picker's tiles ship in the bundle like every map's.
- **Tests:**
  - Every catalog group has a `pickerId`, and every one resolves to a
    picker target or a continent.
  - Every picker country with maps has at least one group.
  - The panel lists the right maps for a country and for a country without
    maps.
  - The stored view round-trips.
- **DoD:** gates green; 🧑 tried on the tablet.

### FT-78 — The list with listboxes, and the Map / List switch · Small · deps: FT-77 for the switch

- **Do:**
  - One row per catalog group, with its name, its progress (known over
    total across its maps) and a listbox of its maps. Choosing a map opens
    it at once.
  - Search filters the rows (`mapSearch.ts` today filters groups and maps;
    keep matching a map's label so "Towns" still finds every Towns map).
  - The Map / List switch at the top of the home screen, remembered in
    `mapPrefs`. The prerendered HTML shows the list, and the map replaces it
    once loaded if the choice is Map.
  - Favourites and Recent are untouched.
- **Watch:** the listbox must work with a keyboard and a screen reader;
  the list stays the accessible way in.
- **Tests:** the switch round-trips; search still counts and filters as
  `mapSearch.test.ts` expects; a row's progress sums its maps.
- **DoD:** gates green; 🧑 tried on the tablet.

> **Amended 2026-09-26 (#58):** the drill-down is the panel's too. On the
> world, the panel lists the continents' own maps, then each continent's
> countries; on a continent, that continent's maps and countries; a tap on a
> country marks its row. The list shows the same sections. On a phone the
> panel sits below the map.

### FT-79 — The tutorial's new first steps · Small · deps: FT-77

- **Do:** the "choose a map" step becomes three steps: spotlight Europe on
  the world view, then Italy on the continent view, then Italy's card in
  the panel. The tutorial's own map is unchanged. If the player has chosen
  the list, the tutorial switches to the map for these steps and back
  afterwards.
- **Tests:** `tutorialMachine` steps and anchors; a browser test that the
  spotlight lands on each.
- **DoD:** `docs/TUTORIAL.md` updated; gates green; 🧑 run through once.

### FT-80 — Bottom-overlay publishers don't clear each other (#68) · Small

- **Do:** `publishBottomOverlay` (`app/src/lib/mapBottomOverlay.ts:19-38`)
  keeps a set of active elements. Each measurement takes the largest of
  them, and a cleanup removes only its own element and republishes from
  the rest. The variables go only when the set is empty.
- **Why now:** unreachable in v0.12 (Explore, the Quiz and the Tour are
  separate routes), but FT-77's panel is a new publisher on the home page,
  and the home page gains a map with its own credit line.
- **Tests:** in `mapChrome.browser.test.ts`: A, then B, then `stopA()`
  leaves B's values; stopping both clears them.
- **DoD:** `Fixes #68`; gates green.

### FT-81 — Place names in the chosen language (#71) · Medium · before FT-77

- **Agreed on #71 (2026-09-26):** countries follow the chosen language
  (Francia, Frankreich); on the **continent maps** (the six Capitals maps
  and Europe's five city maps) towns do too (Mosca, Praga, Atene). A
  country's own maps keep local town names, and regions keep their local
  names everywhere. English, Italian and German.
- **Do:**
  - The builders write an optional `names: { it?, de? }` on a target whose
    name differs in that language. Countries take Natural Earth's admin-0
    `NAME_IT` / `NAME_DE`, towns on the continent maps the populated
    places' `NAME_IT` / `NAME_DE`. Fixups where Natural Earth's form isn't
    the short current one ("Repubblica Ceca" → "Cechia"; Cabo Verde,
    Timor-Leste, Côte d'Ivoire checked in both languages).
  - One app helper, `targetName(target, language)`, falling back to
    `name`. It's used by every place that shows a target's name: labels
    (`stretchedNames.ts` and the popups in `MapView`, `QuizView`,
    `OverviewView`, `TourView`), the facts card title and the Quiz slips.
    Labels redraw when the language changes.
  - Rebuild the six Countries maps, the six Capitals maps, Europe's five
    city maps and the world picker (`build-picker.ts` writes `names` too).
  - DECISIONS.md: amend the #39 entry ("a country is called by its short
    English name"; "a town has one name on every map it is on").
- **Watch:** ids, progress, Favourites and the facts files don't change, and
  neither do the names the facts sentences use. The Quiz is drag-and-drop,
  so there's no typed answer to accept in several languages.
- **Tests:** `targetName` falls back correctly; every country on the
  Countries maps has an Italian and a German name; a switch of language
  redraws a label (browser test); the region and country-Towns maps carry
  no `names`.
- **DoD:** gates green; 🧑 Europe — Countries and Europe — Capitals read in
  Italian on the tablet.

## Out of scope

- **Tier 3 facts** (1 474 places on the finer maps, and Sevilla the
  province still showing the city's facts): a release of its own.
- **German** facts (FT-51), still postponed.
- **More levels:** regions inside a country on the picker. A country's
  panel lists its maps; it doesn't open a third level.
- **The 129 countries with no maps of their own** get no new maps here;
  their panel shows the continent's maps.

## Order

**FT-80 and FT-76 first** (independent, both small; FT-76's size gate
decides whether the rest goes ahead as planned). **Then FT-81** (#71: the
picker's labels use its helper), **then FT-77, then FT-78 and FT-79.** An alpha after FT-77 for the tablet, since the map view,
the panel and the back button are all things to feel on the device.

**→ Release `v0.13.0`** per [RELEASES.md](RELEASES.md), "The milestone".

## Progress ledger

| Task  | State   | Merge | Notes |
| ----- | ------- | ----- | ----- |
| FT-76 | **merged** | PR #70 | 172 countries, 446 KB of tiles (5%, z5), well under the 1.5 MB gate; ids and continents match the six Countries maps exactly |
| FT-77 | **merged** | PR #73 | on the home page above the list until FT-78's switch; picker gains a `land` layer (531 KB) |
| FT-78 | **merged** | PR #74 | with #58's amendment (2026-09-26): the map's panel is the catalog in sections (continents, then each continent's countries), replacing FT-77's per-country cards; the list is the same sections; a `<select>` per row; a running tutorial shows the list until FT-79 |
| FT-79 | in PR   | —     | Europe, Italy, then Italy's row: 14 steps; the map shows during a tutorial even when the list is chosen; opening Italy — Regions another way skips ahead |
| FT-80 | **merged** | PR #69 | #68: a set of publishers, the largest wins; a cleanup removes only its own |
| FT-81 | **merged** | PR #72 | #71: 17 maps and the picker rebuilt, tiles unchanged; `targetName()` in every view; 42 town names not shown |
