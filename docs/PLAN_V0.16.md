# v0.16.0 - Map selection, map readability, and tutorial refresh

Proposal [#125](https://github.com/diegoami/Geoclick2027/issues/125), approved
by the product owner on 2026-09-30; scope addition [#140](https://github.com/diegoami/Geoclick2027/issues/140), approved on 2026-09-30. Each task below is a separate PR, with its own tests and gates. Recommended answers to all proposal questions were accepted. The tutorial task is last so its audit reflects the UI after the preceding changes.

## Agreed scope

- Open a continent's main Countries map when tapping continent land outside a
  country; country taps retain direct map entry.
- On selection rows, default the map-type combobox to the first listed map
  unless the player has a remembered manual choice; the row's country or
  continent button opens the selected map.
- Changing a selection-row combobox to another map type remembers the choice
  and immediately opens that map; the country or continent button remains the
  one-tap route to the row's current default/selected map.
- Allow a country to be selected by tapping its polygon only when its label is
  visible after collision placement.
- In map views, replace the country title/combobox with a second row of direct
  buttons for available map types.
- Keep the completed quiz result panel's only action as Close, leaving the
  solved map open; show Again on that map until a new round starts or map type
  changes.
- Improve towns-map land, border, and sea contrast without changing polygon
  region colors.
- Move the version/build badge from bottom to top; keep Tour controls clear of
  the fact card and use icons for actions.
- Show the bundled chart SVG as non-interactive filler outside the map viewport,
  not over the sea inside MapLibre.
- Extend spine-following region labels to Known, Overview, Quiz, and Tour;
  towns remain point labels and regions without usable spines use the popup
  fallback.
- Thoroughly audit and revise every tutorial step against current behavior,
  all supported languages, and the user manual. The visible Skip action says
  "Exit tutorial"; Escape remains a keyboard shortcut.

## Tasks

| # | Task | Status |
|---|---|---|
| 1 | Selection-row defaults, remembered choices, and open-by-row button | Merged (PR #126) |
| 2 | World-picker continent taps and visible-label country picking | Merged (PR #130) |
| 3 | Direct in-map map-type button row | Merged (PR #137) |
| 4 | Quiz completion Close and map-level Again action | Merged (PR #138) |
| 5 | Towns-map land/border/sea contrast | Merged (PR #139) |
| 6 | Version badge at the top | Merged (PR #141) |
| 7 | Tour icon controls and non-overlapping fact card | Merged (PR #143) |
| 8 | Chart SVG filler outside map viewport | In progress |
| 9 | Spine-following labels in all map views | Planned |
| 10 | Open the selected map immediately when its map type is chosen | Merged (PR #142; approved proposal #140) |
| 11 | Full tutorial audit, rewrite, translations, and manual | Planned; last |

Each task is independently testable and follows the implementation split in
proposal #125. Any scope change returns to the proposal for owner agreement.
