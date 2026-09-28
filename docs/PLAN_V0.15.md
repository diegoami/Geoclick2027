# v0.15.0 — direct map entry and in-country switching

> **Scope approved** by the owner on 2026-09-28 via proposal
> [#110](https://github.com/diegoami/Geoclick2027/issues/110). This is one
> connected start/map navigation feature. The proposal is the decision thread;
> this plan holds the implementation tasks and ledger.

## Why

The world picker currently drills into a continent and only highlights a
country; the player then has to choose its map from a list. Once a map is open,
MapNav has no way to switch to another map in that country, so the player goes
back to Maps. The owner asked for a second tap to enter the selected country and
for sibling-map switching without returning to the list.

Findings: `WorldPicker.svelte:304-318` (world click chooses a continent; a
continent click only marks a country), `MapRows.svelte:69-79` (map choice only
from a row select), `MapNav.svelte:53-149` (mode tabs and Maps link, no sibling
selector), and `mapCatalog.ts:20-37, 242-252` (map groups have no preferred
picker map; Italy's alphabetic list puts Provinces before Regions).

## Design

- On a world-map country tap, zoom to its continent and carry the country
  selection into that view. A subsequent tap on the same country opens its
  configured picker-default map. In a continent view, the first tap on a
  different country selects/highlights it; a second tap opens its map. This is
  a deliberate second selection, not a time-thresholded double-click.
- Add optional `pickerDefaultMapId` metadata to map groups. Prefer the
  administrative region map; when no explicit override exists, use the
  catalog's first map as the fallback. Italy explicitly prefers
  `italy-regions` over `italy-provinces`. A country with no maps keeps the
  existing no-maps note and continent highlight.
- Disable MapLibre's default double-click zoom on the picker so it cannot
  consume the second tap. The zoom controls and touch pinch remain available.
- Add a native, accessible sibling-map selector in MapNav for country maps only.
  It navigates directly to the chosen map's Overview; mode tabs, direct routes,
  favorites and Recent keep their existing behavior.

## Tasks

### FT-86 — open the preferred country map from the picker · Medium

- **Do:** carry the selected country through the world-to-continent transition;
  open its configured picker-default map on the next tap. Keep countries with
  no map in the existing informational path. Add and validate the Italy
  default-map override.
- **Test:** browser interaction covers first tap (continent + highlight) and
  second tap (Overview route), including the preferred map and the no-map
  fallback. Unit tests validate configured defaults and catalog fallback.
- **DoD:** feature and tests merged; gates green; map access and tutorial
  behavior remain intact.

### FT-87 — switch sibling maps in MapNav · Small

- **Do:** add the country-only sibling-map selector next to the map title in
  MapNav, translated in English/German/Italian. A selection opens that map's
  Overview without going back to Maps.
- **Test:** browser component test checks visibility only when siblings exist,
  the available options belong to the same country, and selection navigates to
  the sibling Overview.
- **DoD:** feature and tests merged; gates green; selector is keyboard and
  screen-reader accessible and fits narrow phone widths.

## Out of scope

- Adding maps or changing map data/catalog labels beyond the preferred-map
  metadata.
- Animations, a map editor/self-serve map-authoring, SSO/sync, or other backlog
  items in ROADMAP.md. These require separate owner-approved scope.

## Progress ledger

| Task  | State       | Merge | Notes                              |
| ----- | ----------- | ----- | ---------------------------------- |
| FT-86 | in progress |       | direct map entry and preferred map |
| FT-87 | in progress |       | in-country map selector            |
