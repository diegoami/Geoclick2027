# v0.15.0 — direct map entry and in-country switching

> **Scope approved** by the owner on 2026-09-28 via proposal
> [#110](https://github.com/diegoami/Geoclick2027/issues/110). This is one
> connected start/map navigation feature. The proposal is the decision thread;
> this plan holds the implementation tasks and ledger.

## Why

The world picker currently requires a continent drill-down and then a separate
map selection. Country selectors also begin with a “Choose map” placeholder,
and maps are not consistently ordered from broad to specific. Once a map is
open, MapNav has no way to switch to another map in that country, so the player
goes back to Maps.

Findings: `WorldPicker.svelte` (country clicks drill down instead of opening a
map), `MapRows.svelte` (country selectors have a placeholder), `MapNav.svelte`
(the map selector has a placeholder and omits the active map), and
`mapCatalog.ts` (catalog arrays need a broad-to-specific country order; Italy
currently puts Provinces before Regions).

## Design

- **Revised 2026-09-29:** a single tap on a mapped country opens its configured
  broadest administrative map directly, without an intermediate continent
  view. A country tapped from an already-open continent also opens on the first
  tap. Countries without maps keep the existing notice/highlight; continent
  labels and panel navigation still drill into a continent. Tutorial navigation
  remains guided.
- Keep optional `pickerDefaultMapId` metadata. Otherwise use the first map in
  the country's deliberately ordered catalog list; Italy explicitly prefers
  `italy-regions`.
- Country map order is scope-based, not alphabetical: top-level administrative
  map; zoomed/split maps at that level; smaller administrative divisions,
  broad-to-narrow and adjacent to their split maps; full-country cities/towns;
  city/town subsets; other map types last. Picker and in-map selectors share
  the catalog order.
- Remove the “Choose map” placeholder from country selectors. The in-map
  selector lists every map for its country and shows the current map selected;
  choosing another opens its Overview. The continent-row selector may retain
  its placeholder. Preserve favorites, Recent, direct routes, and Back.

## Tasks

### FT-86 — open the preferred country map from the picker · Medium

- **Do:** open a mapped country directly from the main picker on one tap.
  Keep countries with no map in the existing informational path. Add and
  validate the Italy default-map override and preserve guided tutorial flow.
- **Test:** browser interaction covers one-tap Overview navigation and the
  no-maps notice. Unit tests validate configured defaults and ordered fallback.
- **DoD:** feature and tests merged; gates green; map access and tutorial
  behavior remain intact.

### FT-87 — switch sibling maps in MapNav · Small

- **Do:** remove the country selectors' “Choose map” placeholder; include the
  current map as MapNav's selected option. Order all country options broad to
  specific per the catalog tiers above. A selection opens that map's Overview.
- **Test:** browser component tests cover no placeholder on country selectors,
  current selection, same-country options, semantic order, and Overview
  navigation. Check native keyboard access and narrow-phone fit.
- **DoD:** feature and tests merged; gates green; selector is keyboard and
  screen-reader accessible and fits narrow phone widths.

## Out of scope

- Adding maps, changing source geometries, or changing catalog labels.
- Animations, a map editor/self-serve map-authoring, SSO/sync, or other backlog
  items in ROADMAP.md. These require separate owner-approved scope.

## Progress ledger

| Task  | State       | Merge | Notes                                         |
| ----- | ----------- | ----- | --------------------------------------------- |
| FT-86 | in progress |       | direct one-tap map entry and preferred map    |
| FT-87 | in progress |       | placeholder-free, broad-to-specific selectors |
