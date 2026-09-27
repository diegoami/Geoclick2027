# v0.14.0 — #87 and the loose ends (planned 2026-09-27)

> **Scope agreed** by the owner on 2026-09-27, recorded in
> [docs/HANDOVER.md](HANDOVER.md)'s "Next" row: **#87 plus the two loose
> ends v0.13.0 left** — the start screen's country rows in English, and the
> user manual's tutorial section. Proposed on
> [#93](https://github.com/diegoami/Geoclick2027/issues/93); the open
> questions there take the recommended answers unless the owner says
> otherwise. Nothing is built yet.
>
> **Deferred** (not in v0.14): the map screens' bar in the start-screen
> toolbar's style, the panel as a bottom sheet on phones, and FT-38.

## Why

v0.13.0 shipped the world-map start screen (#58). Its release review left a
SHOULD finding, [#87](https://github.com/diegoami/Geoclick2027/issues/87),
and the release did not finish two smaller things: the deeper FT-81 (#71)
language work reached the map but not the start screen's list, and the user
manual's tutorial section still describes the tutorial as it was before
FT-39 (the map opens on Known) and FT-43 (the Terrain step). v0.14 closes
those three and nothing else.

## Tasks

### FT-83 — Back waits for the world map to load (#87) · Small

- **Do:** move `setPickerShown(true)` out of
  `app/src/lib/WorldPicker.svelte:228` and into the MapLibre `load`
  callback, beside `loaded = true` (`:300`); delete the early call.
  `pickerGoUp()` (`app/src/lib/mapPrefs.svelte.ts:283-286`) is what
  `app/src/routes/+layout.svelte:34-37` consults before `App.exitApp()`, so
  until the map has loaded Back exits rather than going up from a continent
  nothing has drawn. If construction or loading fails, `pickerShown` stays
  false and Back exits too. `onDestroy` already resets it (`:403`).
- **Why:** now the flag is true between `fetchPicker()` and the map's
  `load` event, so on a slow or failed load the first Back press is
  swallowed and the player presses twice.
- **Tests:** the `mapPrefs` unit tests stay green; a `WorldPicker` browser
  test, or a manual Android check, that `pickerShown` is false until the
  map's `load`, so a Back during a slow load exits.
- **DoD:** `Fixes #87`; gates green; 🧑 once on the Android app.

### FT-84 — The country rows in the player's language · Small

- **Do:** add `countryNameOf(group)` to `app/src/lib/catalogSections.ts`
  (which already imports `data/maps/world-picker/picker.json`, `:8`): look
  the group's `pickerId` (`pickerIdOf`) up in `picker.countries` and return
  `c.names?.[getLanguage()] ?? group.country`. `MapRows.nameOf`
  (`app/src/lib/MapRows.svelte:38-39`) uses it for a country group, keeping
  `t('continent.<id>')` for the six continents.
- **Why:** `nameOf` translates a continent's row but returns the catalog's
  English `country` for a country's row, so since FT-81 (#71) the list says
  "Germany" while the map says "Germania". The translated names already
  ship in the picker (`names: { it?, de? }`, 113 of 172; the rest read the
  same as English).
- **Watch:** English is untouched — `names` holds only `it`/`de` — so
  "Great Britain" and "USA" stay as the catalog has them (open question 1
  on #93). Amending `DECISIONS.md`'s "Place names in the chosen language"
  to note the start-screen rows follow it too.
- **Tests:** a browser test that a row reads in the chosen language; a unit
  test that every catalog country's `pickerId` resolves to a picker
  country; English rows unchanged.
- **DoD:** gates green; 🧑 tried on the tablet in Italian or German.

### FT-85 — The manual's tutorial section · Small · after FT-84

- **Do:** rewrite `docs/USER_MANUAL.md` §13's step table to the 14 steps of
  `docs/TUTORIAL.md:47-64` and `app/src/lib/tutorialMachine.ts:56-212`
  (Terrain is step 6; the Known rows go), fix the step-number captions at
  `docs/USER_MANUAL.md:652-677`, and amend §14's "Country names stay in
  English everywhere" (`:731-732`), which FT-81 changed. No code.
- **Why:** the table lists 13 steps and still gives Known its own step,
  which the tutorial stopped having at FT-39; it has no Terrain row.
- **Tests:** the table's rows match `STEPS` (14 numbered); no Known row.
- **DoD:** gates green.

## Out of scope

- The map screens' bar (`MapNav`) in the toolbar's style; the panel as a
  bottom sheet on phones (both deferred from FT-82's proposal, #91).
- The map bar's breadcrumb (`mapDisplayName`, `mapCatalog.ts:494`)
  following the language: the same FT-81 inconsistency, but not the start
  screen's rows (open question 2 on #93).
- FT-38 (Wikidata landmarks), still parked on its product decisions.
- The English names "Great Britain" and "USA" (open question 1 on #93).

## Order

FT-83 and FT-84 are independent Small tasks; FT-85 (docs) goes last, so it
describes what shipped.

**→ Release `v0.14.0`** per [RELEASES.md](RELEASES.md), "The milestone".

## Progress ledger

| Task  | State | Merge | Notes |
| ----- | ----- | ----- | ----- |
| FT-83 | merged | 7ee11e1 | #87: `setPickerShown` into the map's `load` callback |
| FT-84 | merged | 43eacaf | the picker's `names` in `MapRows` |
| FT-85 | merged | 433c5ac | the manual's §13 table and §14 country sentence |
