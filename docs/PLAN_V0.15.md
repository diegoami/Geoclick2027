# v0.15.0 — direct map entry, in-country switching, and antique sea art

> Navigation scope approved via proposal
> [#110](https://github.com/diegoami/Geoclick2027/issues/110) on 2026-09-28;
> antique sea art approved via [#112](https://github.com/diegoami/Geoclick2027/issues/112)
> on 2026-09-29. These are the v0.15 feature set; the proposals are the decision
> threads, and this plan holds implementation tasks and the ledger.

## Why

The world picker currently requires a continent drill-down and then a separate
map selection. Country selectors also begin with a “Choose map” placeholder,
and maps are not consistently ordered from broad to specific. Once a map is
open, MapNav has no way to switch to another map in that country, so the player
goes back to Maps. The shared Terrain sea is a uniform fill, leaving large
empty areas around the geography visually blank.

Findings: `WorldPicker.svelte` (country clicks drill down instead of opening a
map), `MapRows.svelte` (country selectors have a placeholder), `MapNav.svelte`
(the map selector has a placeholder and omits the active map), and
`mapCatalog.ts` (catalog arrays need a broad-to-specific country order; Italy
currently puts Provinces before Regions). Proposal #112 also found
`terrainLayer.ts:76-83` renders the sea as one flat fill.

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
  choosing another opens Known at the base `/map/[mapId]` route. New country
  map picks also open that route, not Overview. The continent-row selector may
  retain its placeholder. Preserve favorites, Recent, direct routes, and Back.
- **Added 2026-09-29 via #112:** draw a subtle, original vector pattern of
  antique-chart motifs (sea creature, ship, compass rose, and wave hatching)
  over empty sea only. Bundle the art locally for offline use, keep it
  non-interactive and beneath playable geography, and tie its visibility to the
  existing Terrain preference/toggle. Include a short “Here be dragons”
  inscription rendered from the player's English, German, or Italian locale;
  do not use MapLibre's remote glyph server.

## Tasks

### FT-86 — open the preferred country map from the picker · Medium

- **Do:** open a mapped country directly from the main picker on one tap.
  Keep countries with no map in the existing informational path. Add and
  validate the Italy default-map override and preserve guided tutorial flow.
- **Test:** browser interaction covers one-tap Known navigation and the
  no-maps notice. Unit tests validate configured defaults and ordered fallback.
- **DoD:** feature and tests merged; gates green; map access and tutorial
  behavior remain intact.

### FT-87 — switch sibling maps in MapNav · Small

- **Do:** remove the country selectors' “Choose map” placeholder; include the
  current map as MapNav's selected option. Order all country options broad to
  specific per the catalog tiers above. A selection opens that map's Known screen.
- **Test:** browser component tests cover no placeholder on country selectors,
  current selection, same-country options, semantic order, and navigation to
  Known. Check native keyboard access and narrow-phone fit.
- **DoD:** feature and tests merged; gates green; selector is keyboard and
  screen-reader accessible and fits narrow phone widths.

### FT-88 — antique-cartography sea decoration · Medium

- **Do:** add a low-contrast repeating vector pattern over the Terrain sea
  polygons using original bundled artwork. It is visible with Terrain and
  hidden by the existing Terrain toggle; geography, labels, and hit layers stay
  unchanged. Its inscription is localized in the bundled SVG data, without
  remote glyphs.
- **Test:** browser-layer tests verify the pattern is added only on the `sea`
  source layer, follows Terrain visibility, and gracefully falls back to the
  plain sea fill if the local asset cannot load. Review desktop and phone
  screenshots for scale, contrast, and placement.
- **DoD:** all gates green; vector asset is bundled/offline; no map interaction
  or target-label behavior changes.

## Out of scope

- Adding maps, changing source geometries, or changing catalog labels.
- Replacing the whole basemap, using unlicensed historical scans, or adding a
  general theme/customization system.
- Animations, a map editor/self-serve map-authoring, SSO/sync, or other backlog
  items in ROADMAP.md. These require separate owner-approved scope.

## Progress ledger

| Task  | State       | Merge   | Notes                                         |
| ----- | ----------- | ------- | --------------------------------------------- |
| FT-86 | merged      | efb7027 | direct one-tap map entry and preferred map    |
| FT-87 | merged      | efb7027 | placeholder-free, broad-to-specific selectors |
| FT-88 | in progress |         | antique-cartography sea decoration            |
