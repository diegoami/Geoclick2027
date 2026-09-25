# Geoclick — Changelog

Release notes, newest first. See [`ROADMAP.md`](ROADMAP.md) for the
day-to-day build log and [`DECISIONS.md`](DECISIONS.md) for the reasoning
behind product/design choices — this file is the release-facing summary,
one entry per tagged version on `main`.

## v0.12.0 — 2026-09-25 — Facts for the new maps

**The places added in v0.11 get their fun facts: every country, every capital and city on the continents' maps, and every region and town of the 15 new countries. Plus a button that clears the map, and the fixes from playing on a tablet.**

Proposal #46 and [PLAN_V0.12.md](docs/PLAN_V0.12.md) (FT-69 to FT-75); the tablet fixes. PRs #47-#57, #59-#63.

For players:

- **The new maps have fun facts.** Tap a country on any continent's
  Countries map, a capital or city on the continents' maps, or a region or
  town of the 15 countries added in v0.11, and the card now tells you where
  its name comes from and more, in English and Italian: all 172 countries,
  286 capitals and cities, and the 537 regions and towns of Belgium,
  Czechia, Croatia, Greece, Bulgaria, Chile, Peru, South Africa, Iran,
  Thailand, Saudi Arabia, Ireland, Switzerland, Austria and Romania. A
  province and its town of the same name now each have their own facts.
  Smaller places get one or two facts rather than three.
- **A button to clear the map.** Under the zoom buttons, the eye hides the
  tabs, the map's name and the pills, so a round on a tablet has the whole
  map. Press it again to bring them back. The choice lasts until you close
  the app.
- **The credit line and the version no longer cover the names** in the Quiz
  or the Tour's buttons. On a phone the credit starts folded behind its (i).
  The version now sits in the bottom-left corner.
- **Switching Terrain off and on again keeps its names.** Before, the
  mountains and seas came back without them.
- **A region's name looks the same on every screen.** The Quiz, the
  Overview and the Tour now write it like Explore does, in capitals with no
  box. In the Quiz a name you placed is dark green and a name given away is
  brown. Town names keep their boxes.

Under the hood:

- **Where a place's facts come from (FT-69).** A country reads
  `data/facts/world.json`, a town its own country's file, whatever map it
  is on. "Czech Republic" and "Czechia" share one file (`factsFileFor`).
- **A region and a town of the same name are kept apart.** An entry can
  hold `region` and `city` lists, and each target reads the one of its own
  kind (`storedHooksFor`). The new files use it from the start; Spain's
  Sevilla still doesn't (tier 3).
- **The authored facts:** `world.json`, `greece.json` and 160 new country
  files. 172 countries, 286 towns, 537 regions and towns of the 15
  countries, in English and Italian. All pass the Italian house-style lint
  and the orphan lint.
- **The map chrome:** `hideButtonsControl.svelte.ts` is a MapLibre control;
  its state is per session and ignored while the tutorial runs.
  `mapBottomOverlay.ts` publishes the height of the Quiz tray and the Tour
  controls as CSS variables, which the credit line and the version badge
  sit above. A phone folds the credit once it's drawn.
- **Terrain names** are drawn again once the source is loaded and has
  labels (`terrainLayer.ts`), not on the first `data` event.
- **Region names:** the Quiz, Overview and Tour tag region popups
  `geoclick-region-name`, the same rules as Explore (FT-74).
- **Map builder nits from the v0.11.0 review (FT-75):** `--within`'s
  nearest-area fallback measures distance on the ground (longitude scaled
  by cos(latitude)); the error message names `--disambiguate-by`. The 16
  `--within` maps rebuild byte-identical.
- **A test that damaged the repository (#60).** `buildAssets.test.ts`'s
  scratch git repo inherited the pre-push hook's `GIT_DIR`. Pushed from a
  worktree, it set `core.bare` on the real `.git/config`. It now drops the
  repository variables, and a test checks it.
- **New tests:** `regionLabel.browser.test.ts` covers the Quiz, Overview
  and Tour; terrain names after off and on; the map chrome; the facts
  routing.

Not in this release:

- **FT-51, the facts in German**, is still postponed.
- **Tier 3, the finer maps:** 1 474 places (Germany's towns and districts,
  France's departments, the Dutch municipalities, Poland's powiats and
  others) still show only the generated sentences. Sevilla, the province,
  still shows Sevilla the city's facts.
- **Thin places.** About 250 of the 523 new places have one or two facts
  rather than three, and 44 regions have a fact that only says it is named
  for its town. They are to be filled with tier 3.
- **The world-map start screen**, agreed on #58, is v0.13.

## v0.11.0 — 2026-09-24 — Twice the maps

**The map list grows from 63 to 127 maps: whole continents, finer maps of the countries already here, and eleven countries new to the app, plus three fixes to how names show on the map.**

Proposal #39 (batches A-E) and the hardening batch #32 (FT-56, FT-59, FT-67, FT-68). PRs #33, #35-#38, #40-#43.

For players:

- **Continents.** Each continent has a Countries map and a Capitals map:
  Africa, Asia, Europe, North America, South America and Oceania. Europe's
  cities come in five parts: North, West, Central, East and South.
- **Finer maps of countries already in the app.** Germany's towns in six
  parts, 60 towns each, and its 400 districts (Kreise) in six parts. France's
  96 departments, whole and in two halves. Spain's provinces. The
  Netherlands' 344 municipalities in five parts. Poland's 380 powiats in
  five parts.
- **Countries new to the app.** Ireland, Switzerland, Austria and Romania,
  and eleven more: Belgium, Czechia, Croatia, Greece, Bulgaria, Chile, Peru,
  South Africa, Iran, Thailand and Saudi Arabia. The last six have a Towns
  map too.
- **Every map says where its data comes from.** A line of small print along
  the bottom edge names the source; on a narrow screen it is behind the (i).
- **On the Known map, tapping a name marks it Chosen**, even a name you
  already know, so a tap always shows. The choice lasts until you close the
  app (#11).
- **On Explore, a region's name that doesn't fit inside its shape** is now
  written like the names that do: in the same capitals, with no box around
  it (#34).
- **On Explore, the name you just tapped always shows.** Before, a name like
  Basilicata, squeezed between two others, opened its fact card but stayed
  hidden.
- **Nunavut's name is on its mainland**, not on Ellesmere Island.
- **One Italian fact sentence is rewritten** (Sardegna's) to match the style
  guide.

Under the hood:

- **Map builders:** `--level=country` builds maps of whole countries.
  `--source` reads boundaries that don't come from Natural Earth. `--within`
  splits a country by its states. `--disambiguate-by` tells apart two places
  with the same name. `--clip` now also works on region maps.
  `build-points-map.ts` builds maps with towns from several countries, and
  reads the committed Wikidata snapshot of German towns
  (`data/places/germany.geojson`).
- **New data sources, and their licences:**
  - Wikidata, for Germany's towns (CC0);
  - geoBoundaries' copies of three national datasets: Germany's districts
    (BKG, dl-de/by-2-0), the Dutch municipalities (CC0) and Poland's powiats
    (OpenStreetMap, ODbL; the product owner accepted ODbL for this);
  - `createMap` passes each map's `attribution` to MapLibre, so the credit
    line shows.
- **Spines** pick a region's largest part by its area on the ground, so
  Mercator's stretching near the poles no longer skews the choice (#35).
  `labelCollision.ts` adds `FOCUSED_CLASS`: the name whose fact card is
  open always gets its place (#37).
- **Known map:** `visibleTier` returns `asked` for any explicit tap. The
  choices are in-memory `$state`, and the FT-39 localStorage key is removed
  on load (#38).
- **New tests (#33, closes #7 and #8):**
  - FT-56 checks every map's `tour.json` against its `tourOrder`;
  - FT-67 runs `houseStyle` on every authored Italian sentence;
  - FT-68 tests `StretchedNames` on a scrolled page, for collisions and
    hit-testing;
  - FT-59 is a browser test of QuizView: grading, resuming a round, and the
    round summary.

Not in this release:

- **FT-51, the facts in German**, is still postponed.
- **The zoomable world map as the start screen.** It matters more now that
  the list is 127 maps long.
- **Maps not built:**
  - Great Britain's and Hungary's counties: Natural Earth's are outdated or
    broken.
  - Norway, Morocco and Kenya: Natural Earth predates their recent reforms.
  - Serbia: messy data.
  - Denmark: only five regions.
- **Same-name places share facts.** A district or province with the same
  name as a town (Sevilla, the province) shows that town's fact sentences.
  Separating them is authoring work in `data/facts/`.
- **Facts for the new maps.** Of the places on the 64 new maps, 2 469 have
  no authored sentences, only the generated ones (neighbours, coast, largest
  city). The Quiz, Overview and Tour keep their boxed region labels, as
  agreed on #34 (Q1). Both are proposed for v0.12 (#46).
- **The credit line on a phone** opens expanded, and folds behind the (i)
  only after the first touch on the map.

What shipped, and what was tried:

- **Review:** an independent model (DeepSeek V4 Pro, in OpenCode) reviewed
  `v0.10.0..133dbc8` on [Milestone v0.11.0 (#45)](https://github.com/diegoami/Geoclick2027/issues/45):
  round 1, AGREE, no issues, two nits for the next release. The tag sits on
  exactly that commit.
- **Beta:** `v0.11.0-beta.1` on `909fe78` (the candidate plus the version
  only). A map drew in the installed Windows app and in the APK on the
  emulator; the owner checked #36's boxless names on a tablet.
- **Installers:** Windows `.msi` and `-setup.exe`, Android `.apk`, all
  built from the `v0.11.0` tag. The `-setup.exe` (Poland — Counties —
  South, Greece — Regions) and the APK (Poland — Counties — South,
  installed over the beta, which kept its progress) were tried. The
  `.msi` was built but not installed.

## v0.10.0 — 2026-09-23 — The facts in Italian, and a calmer quiz

**Every place's facts now read in Italian, and six things that got in the way of playing on a tablet are fixed.**

FT-48 to FT-50 and FT-60 to FT-66 (FT-64 was a spike; FT-51, German, is postponed). PRs #18–#25.

For players:

- **The facts speak Italian.** With the interface in Italian, the fact
  card now reads in Italian for all 1 814 places, from where the name
  comes from to the rest of its facts. About 180 English facts were also
  corrected along the way, so the English reads better too.
- **A first round starts with ten names.** A map you had never played
  used to put every name in the tray at once (110 on the Italian
  provinces). The first hand now holds ten.
- **Dragging a name works on a tablet.** Pressing on a name no longer
  starts selecting its text, and a drag the tablet interrupts puts the
  name back in the tray.
- **The fact card waits for a miss.** It used to pop up after every
  answer, just as you reached for the next name. Now it only appears
  for a name you could not place.
- **Town names find the free space.** A town's name goes where there is
  the most room, so it no longer covers a neighbouring town's dot, and it
  stays put while you pan.
- **On the Known map, region names follow the region.** Where a name fits,
  it is written along the shape of its region, the way an atlas labels a
  territory. Where it does not fit, it keeps its usual label.
- **The map list shows a progress bar** instead of "0 / 49 known". A map
  with nothing known yet shows nothing.

Under the hood:

- **FT-48/FT-49:** facts are stored per language (`hooks`), with a
  per-sentence English fallback and no "EN" marker; Italy's 20 regions
  were the first file translated, and read, before the rest.
- **FT-50:** all 28 country files, 5 448 of 5 448 sentences, one commit per
  country, against `docs/TRANSLATION_STYLE_IT.md`. `translate-facts`
  merges a translation only when the places, the sentence count and order
  match; `refresh-facts-hooks` rewrites only the sentences in each map's
  `facts.json`, with no WSL needed. A new integrity check fails if a map
  ships sentences its country file no longer holds.
- **FT-60:** `HAND_SIZES[0]` is 10; while the tutorial runs, its two
  spotlit slips are dealt first.
- **FT-61:** `user-select` and `-webkit-touch-callout` guards on the slip,
  and a `pointercancel` handler that returns it to the tray.
- **FT-62:** the fact card shows only on `status === 'revealed'`.
- **FT-63:** eight candidate spots per town label, each scored in pixels
  (room, reach, other towns' dots, the map's edge), and a stay bonus
  only while the map moves.
- **FT-64/FT-66:** `build-map.ts` writes a spine (quadratic Bézier) per
  polygon target; Explore draws the name as an SVG `textPath` along it
  where it fits and the pill elsewhere. The stretched names join the
  collision pass and the magnify hit-test. Quiz and Tour keep pills.
- **FT-65:** a progress bar over `knownCount / total` on the map list,
  hidden at zero.
- **Review:** these PRs had no per-PR review. v0.10.0 is the first
  milestone under CLAUDE.md §3a: an independent model reviewed
  `v0.9.4..` the candidate on the `Milestone v0.10.0` issue, and the tag
  sits on exactly the commit it agreed with. Round 1 (AGREE, no issues)
  ran on `3ab4820`, the same code as `v0.10.0-beta.1`.
- **Installers:** `v0.10.0-beta.1` (Windows `-setup.exe`, Android `.apk`)
  was packaged and published before the candidate; a map drew in the built
  Windows app and in the APK on the emulator. The stable installers are
  built from the `v0.10.0` tag; the milestone issue records what was tried
  on them and on a device (FT-61 on a tablet, FT-66 on a phone or tablet).

Not covered:

- **German (FT-51)** is postponed until the Italian has been read.
- **FT-56 and FT-59**, the two v0.9.4 test gates, still wait for a
  hardening batch.
- **The Italian was spot-checked, not read end to end.** One Sardinian
  sentence still carries em dashes against the Italian house style.

## v0.9.4 — 2026-09-22 — The review's fixes that matter

**Six defects from an independent code review, all fixed — three a player can see, two that only bite when they bite, and one build-robustness fix.**

FT-52 to FT-58.

For players:

- **Terrain names follow the language.** Switching to Italian with a map
  open used to leave the mountain, sea and river labels in the previous
  language while everything around them changed. They now switch with it.
- **The Terrain button does what it says.** Turning Terrain off while it
  was still loading let it come back by itself, with the map left dimmed
  and the button reading off. It now stays off.
- **Back in the tutorial goes back.** Back out of the first quiz step — or
  Resume onto an Overview step — landed on the Known screen instead of the
  Overview and immediately paused again. It now reaches the Overview.
- **A storage failure no longer takes the app with it.** When the device's
  storage refuses to be read, the home page still lists every map and a
  quiz still plays: the round just is not remembered, and a notice says so.
  The language picker keeps working too.
- **A Russian region's label stopped being the first to give way.**
  Chukotka straddles the antimeridian, so its width was computed as
  negative and its name lost every collision it entered.

Under the hood:

- **FT-52:** antimeridian wrapping is derived from the bbox (`west > east`)
  rather than the optional `crossesAntimeridian` flag; the integrity suite
  asserts the two agree, and `russia-regions` was rebuilt.
- **FT-53:** the terrain layer gained `refreshLabels()`, called from a
  shared `followTerrainLanguage()` effect — on a map's first open the
  labels are drawn after an `await`, so the language was never tracked.
- **FT-54:** `add()` applies the latest requested visibility once the
  layers exist, and the pending tiles-arrived wait is dropped on hide.
- **FT-55:** the Screen-to-URL translation is `screenPath()`, tested
  through the effect handler rather than the emitted effect.
- **FT-57:** stored values are shape-validated instead of cast; the home
  page reads each map independently; and the quiz falls back to an
  in-memory repository when the real one cannot be opened or read.
- **FT-58:** `app/static/{maps,styles}` are prepared at build time instead
  of being committed symlinks, and `postbuild` fails the build if the map
  and style assets did not reach `app/build`. The first version used a
  Windows junction, which Git follows when replacing the path — it deleted
  the generated data during the merge; the prepared path is now a true
  symlink or a copy.
- **Every PR was reviewed by a second model** through a standing review
  loop; the reviewer's blocking findings are all fixed.
- **Installers:** rebuilt from the v0.9.4 tag — the Windows `.msi` (26.2 MB)
  and `-setup.exe` (25.0 MB), and the Android `.apk` (33.8 MB), signed with
  the current key, Android versionCode 90499 — and published to the releases
  page. **Not tried in this build:** neither shell was opened to check a map
  draws; that check is outstanding.

Not covered:

- **FT-56 and FT-59**, both test gates, were deliberately moved out of
  v0.9.4 to a later hardening batch.
- **The name-facts are still English only** — v0.10.0, still blocked on
  three product decisions.

## v0.9.3 — 2026-09-19 — The name origin, every time

FT-47, plus the plan for the one thing in the app that is still English
only ([docs/PLAN_V0.10.md](docs/PLAN_V0.10.md)).

For players:

- **The name origin is back on every card.** It was only ever showing one
  visit in three: the card rotated through all of a place’s facts, and only
  the first is about the name. Now that one is pinned and stays put, and the
  rotation moves the second line instead — so you always get "named for the
  Longobards", plus something different about Lombardia each time.

Under the hood:

- `placeFacts` pins `hooks[0]` as the origin and rotates `hooks[1..]` as the
  extra. The card is up to three lines in descending order of worth: the
  origin, one of the others, and the short derived clause.
- **It was not FT-45 that lost the origin.** The card had rotated through
  the whole list since FT-41 made it three deep in v0.9.0; the derived
  paragraph was covering for it, and cutting the paragraph is what made it
  visible. Putting the paragraph back would have hidden it again.
- Android versionCode 90399.
- **Installers:** all three rebuilt from the v0.9.3 tag — the Windows
  `.msi` and `-setup.exe`, and the Android `.apk`, signed with the current
  key.
- **Both shells were tried.** The `-setup.exe` was installed and driven over
  CDP on a cleared profile: 63 maps, Known on open, 21 names drawn, 22
  terrain features already on, the language picker one button. The APK
  installed as an update over v0.9.2 (versionCode 90399) and was driven on
  the emulator, where a town card showed all three lines in order —
  "Adelaide — Named for Queen Adelaide, wife of William IV." pinned on top,
  "It is called the city of churches…" rotating under it, and "In South
  Australia. No. 5 by population on this map." quiet at the bottom. That is
  FT-47 confirmed on a touch device.

Not covered:

- **The name-facts are still English only**, which now reads as a glitch
  rather than a gap: open a map with the interface in Italian and the tabs,
  the landmarks and the card’s bottom clause are all Italian while the
  name-fact is English. Measured and planned as v0.10.0 — 5 448 sentences
  per language, gated on translating one country first and reading it.
- **FT-38, the Wikidata landmark pass**, is still deferred.

## v0.9.2 — 2026-09-19 — What the second look found

**Three things found by using v0.9.1**, one of them a way to get the
tutorial stuck. FT-44 to FT-46.

For players:

- **The fact card stops telling you what the map is already showing.** It
  used to open with "In the north-west of the country. No coast of its own."
  — which you can see for yourself. Now it leads with the name-fact, and
  adds only what the map cannot show you: a region's biggest city, or a
  town's region and how big it is against the others.
- **Towns are easier to hit.** The tap area for a town was its dot and
  nothing more. It is now about two and a half times wider, so a finger
  lands on it without aiming.
- **The tutorial cannot get stuck** at "now get one wrong on purpose". If
  you placed the name it suggested correctly instead, it sat there waiting
  for a mistake you could no longer make with it. It now asks for any name
  on any wrong region, and if you finish the whole quiz without a single
  mistake it lets you move on.

Under the hood:

- FT-44: the tutorial machine gained a `quizDone` flag. A drop step offers
  Next once the tray is empty, because a step waiting for something that can
  never happen is a trap, not a lesson. It is a flag only and never advances
  a step by itself. The copy no longer names a slip that may already be
  placed.
- FT-45: `factClauses` returns at most two short clauses instead of
  composing a paragraph — a region's biggest city, or a town's region and
  rank. The **data is untouched**: `build-facts.ts` still writes every
  field, so about 0.20 MB of the 1.4 MB of facts shipped is now fields
  nothing reads. That buys a one-line revert instead of a data migration if
  a clause is ever wanted back; MAPS.md records the figure.
- FT-45 also **undid FT-42**. The small-screen rotation existed to alternate
  two full lines, and one line plus a short clause fit together on a phone,
  so `cardLines.ts` and its tests were deleted rather than left as a
  mechanism with nothing to rotate. Its DECISIONS entry is marked superseded
  rather than left to be found and believed.
- FT-46: an invisible `targets-hit` circle of radius 22 over each radius-9
  town dot, with the click bound to it **instead of** the dot — it covers
  the dot completely, so binding both would fire twice for one tap and
  toggle a name straight back off. MapLibre hit-tests geometry rather than
  painted pixels, so a transparent layer still answers clicks, and it is a
  style layer over a source that already exists: no tileset changed.
- Android versionCode 90299.
- **Installers:** all three rebuilt from the v0.9.2 tag — the Windows
  `.msi` and `-setup.exe`, and the Android `.apk`, signed with the key
  introduced on 2026-09-19.
- **Both shells were tried, not just built.** The `-setup.exe` was
  installed and driven over CDP on a cleared profile: 63 maps, Known on
  open, 21 names drawn, 22 terrain features already on. The APK installed
  as an update over v0.9.1 (versionCode 90299) and was driven on the
  emulator: Australia — Towns opened, and a tap **40 device pixels beside**
  a town dot — outside the 9 px dot, inside the new 22 px hit circle —
  selected Adelaide and opened its card, reading "Named for Queen
  Adelaide, wife of William IV." over "In South Australia. No. 5 by
  population on this map." That is FT-45 and FT-46 confirmed together on
  a touch device. v0.9.1 could not close this gate because the emulator
  would not render; a full `adb kill-server` and restart fixed it.

## v0.9.1 — 2026-09-19 — What the first look at v0.9.0 found

**Three things the product owner asked for after trying v0.9.0**, one of
them a fix for a mistake that release made. FT-43, the programme in
[`docs/PLAN_V0.9.md`](docs/PLAN_V0.9.md).

For players:

- **Terrain is on by default now.** It shipped switched off, so unless you
  pressed the button you never saw the sea, the rivers, the Alps or the
  peaks at all — which rather defeated the point of adding them. Every map
  now opens with them on. If you turned Terrain off yourself, it stays off:
  the change only affects devices that never touched the button.
- **The tour is a little slower.** A step now holds for 4 seconds rather
  than 3, and the camera takes longer to settle, so there is time to read a
  name and find the place rather than just watch it light up. Long tours
  still speed up to stay under three minutes, and 0.75× joins the speed menu
  if you want to set it yourself.
- **The language picker is one button instead of three.** It shows the
  language you are in and opens a list — English, Deutsch, Italiano, each in
  its own language — so the map bar keeps its space no matter how many
  languages get added later. It works from the keyboard: arrow keys to move,
  Enter to choose, Escape to close.
- **The tutorial explains Terrain**, in a new step of its own. It tells you
  what the sea, rivers and mountains behind the map are, and that the
  button switches them off and on. The tutorial is twelve steps now.

Under the hood:

- The Terrain preference now reads **three** states, not two: `'1'` on,
  `'0'` off, and *absent* meaning never touched. Only the absent case takes
  the new default, which is what lets it flip without overriding anyone who
  turned Terrain off. A two-state flag cannot tell "off" from "unset".
- The tour's default-speed floor moved from 1× to 0.75× in
  `tourSpeed.ts`, rather than by regenerating 63 `tour.json` files — so the
  pace stays the player's to override. The three-minute budget still
  outranks the floor, and a test asserts no committed tour exceeds it at its
  default, which is the check that matters when every tour is suddenly a
  third longer.
- `LanguageSwitcher.svelte` is a listbox, not a native `<select>`: a select
  shows one string per option and this needs two, terse closed and readable
  open. Full keyboard support, and the picker's own accessible name is now
  translated (`lang.label`) — the three-pill version hardcoded it in English.
- The tutorial machine gained a `terrain` advance, which follows the same
  path as `gesture` and `reveal`; the card's counter is derived from the
  step list, so it went from 11 to 12 on its own. The new step's copy key
  is `tutorial.terrain` rather than a number, so inserting it did not mean
  renumbering eight keys across three dictionaries.
- **A bug the default flip introduced, and its fix.** With Terrain off by
  default nothing asked for the layer until a player pressed the button,
  long after the map had loaded. On by default, the view asks as it
  mounts - which raced the style, and MapLibre threw "Style is not done
  loading" while the layer silently never appeared. `TerrainLayer` now
  waits for the style before adding its source. The local smoke test
  caught it; it would have shipped as exactly the complaint the change
  was meant to fix.
- Android versionCode 90199.
- **Installers:** all three rebuilt from the v0.9.1 tag — the Windows
  `.msi` and `-setup.exe`, and the Android `.apk`, signed with the key
  introduced on 2026-09-19.
- **What was tried, and what was not.** The `-setup.exe` was installed on
  Windows and driven over CDP on a cleared profile: 63 maps, Italy —
  Regions opens on Known, 21 names drawn, 22 terrain features showing
  with the button already on, and the language picker one button. The
  **APK was built and installed as an update over v0.9.0** (versionCode
  90199 accepted, versionName 0.9.1) and launched, **but a map was not
  opened on it**: the emulator began returning black screenshots with the
  app still focused, and did not come back after a restart. The web
  bundle inside the APK is the one that passed every check above, but
  that is an inference rather than a test, and RELEASES.md asks for this
  to be said rather than implied.

Not covered:

- **FT-38, the Wikidata landmark pass**, is still deferred, as in v0.9.0.
- **The name-facts are still English only**; the derived line above them
  remains trilingual.

## v0.9.0 — 2026-09-19 — The map you build yourself

**A map you build by tapping, and a name-fact on every place in the app.**
Nine tasks over two programmes — FT-33 to FT-37 in
[`docs/PLAN_V0.8.md`](docs/PLAN_V0.8.md) and FT-39 to FT-42 in
[`docs/PLAN_V0.9.md`](docs/PLAN_V0.9.md). **There is no stable v0.8.0**: that
programme only ever shipped as `v0.8.0-beta.1`, and everything in it is
here, so this release supersedes it.

For players:

- **A map now opens on Known, and you build it by tapping.** Tap a place and
  its name stays on the map; tap it again and it goes. Tap a second and the
  first one stays put — so the set of names in front of you is the set you
  chose to work on, not whatever you touched last. It is remembered per map,
  so it is still there tomorrow, and a **Clear** control puts a cluttered map
  back to plain. Overview is still there as a tab.
- **Every place on every map says where its name comes from.** All 28
  countries, all 63 maps, all 2 235 places — 5 448 sentences, at least three
  for every place, so the card keeps saying something new each time you meet
  it. Hiroshima is "wide island"; Giresun is where the word cherry comes
  from; Nîmes is where denim comes from; Teramo and Terni turn out to be the
  same word, "between the rivers"; Lombardia is named for the Longobards,
  the "long-beards" who took the north in 568; and Chicago is the
  Miami-Illinois word for the wild garlic that grew in its marshes.
- **Every place also tells you something about itself.** Tap a region in the
  Overview, click one in Known, or resolve a name in the Quiz, and a line
  appears: where it is, whether it has a coast, what range it is in, its
  biggest city, its highest point, who it borders. The Tour narrates each
  stop the same way. In the Quiz it can only ever appear *after* an answer is
  resolved, so it never gives one away — and after a mistake it stays up
  until your next drop, because that is the moment worth reading it.
- **A Terrain button in the map bar** (Gelände, Rilievo). Press it and the
  sea turns blue, the rivers appear, and the ranges, deserts and seas around
  the map get their names — the Alps behind Trentino, the Adriatic beside
  Puglia, the Po across Lombardia. Until now every map was politics only,
  with the water the same sand colour as the land, so no coastline read at
  all. Off by default, one setting for every map, remembered per device.
- **Peaks and the great circles**, in the same Terrain switch. Mont Blanc
  4 807 m above Valle d'Aosta, Monte Etna 3 322 m on Sicilia, Fuji on Honshu,
  the Qattara Depression at −133 m in Egypt's western desert — and the Tropic
  of Cancer drawn straight across Egypt, just above Aswan.
- With Terrain on, the region colours lighten so the ground shows through:
  the Apennines run visibly down the middle of Italy, the Appalachians up the
  eastern United States. Switching it off puts the colours straight back.
- **The terrain names come in your language**: Alpen and Adriatisches Meer in
  German, Alpi and Mar Adriatico in Italian. A terrain name never covers a
  name you are learning — it gives way, and comes back when there is room.
- Terrain names are placed inside the thing they name, and a name whose
  feature is really somewhere else is left off: the Apennines now sit on the
  ridge rather than out to sea, and a map of Italy no longer labels the
  Balkan Peninsula. Natural Earth calls the Apennines "Appennino ligure" in
  Italian, naming one sub-range for the whole chain; that is corrected.
- **On a phone the fact card shows one line at a time**, and changes to the
  other every few seconds — the name-fact first, because that is the one
  worth having if you only read one. Tablets and desktops are unchanged, and
  so is the card for anyone whose device asks for less motion: that one shows
  both lines and stays still.
- **The tutorial teaches the new model.** Its steps were reordered and
  rewritten in all three languages to show tapping names on and off as the
  way to build a map to study from, and every step was checked against the
  screen it actually lands on.

Under the hood:

- FT-42: `cardLines.ts` holds the small-screen rule — either viewport edge
  ≤ 700 px, so a phone held sideways counts — as a pure, unit-tested
  function; the card watches `matchMedia` and no caller changed.
- FT-41: 28 authored country files feeding all 63 maps. Authoring per country
  rather than per map is what made it affordable: Italy's 131 entries feed
  five maps and the USA's 219 feed five more. Where one id means two places
  on two maps — `new-york` the state and the city — the entry splits by kind.
  `facts.json` grows from 503 KB to 1.4 MB over all 63 maps, fetched lazily
  and per map; the largest single file is 64 KB.
- FT-40: the tutorial's zoom detection moved into `createMap`, after the
  tutorial stuck on step 2 because the step moved screens and its wiring did
  not.
- FT-39: `shownNames.ts` holds the whole show/hide rule — earned strength
  from the clean streak, overridden either way by a tap — pure and
  unit-tested, with the view only drawing what it is told. The overrides live
  in `mapPrefs.svelte.ts` (localStorage), not the SQLite progress store:
  they are a view of a map, not a record of what the player knows.
- FT-37: two more Natural Earth datasets; 12 peaks per map, the tallest
  first, and named depressions always kept.
- FT-36: name-facts authored per country in `data/facts/`, projected into
  every map containing the place; a rotation counter per device; and a lint
  that fails on a fact written for an id no map has.
- FT-35: one card, four screens, declaring itself to `mapFit` and taking no
  pointer events so a drag that crosses it still reaches the map.
- FT-34: a `facts.json` beside every `map.json` holding structured fields
  rather than prose, so the derived half of the fact box is trilingual with
  nothing translated by hand. Coastal-or-not is decided by vertices shared
  with the coastline, which gets Italy exactly right; source rows are matched
  to targets by extent rather than by name, which is what makes it work on
  dissolved maps.
- FT-33: five more Natural Earth datasets; a second tileset per map
  (`terrain.pmtiles`, 4.94 MB over all 63, fetched only when the layer is
  switched on) built by `data/scripts/build-terrain.ts`; its maximum zoom
  follows each map's extent.
- Android versionCode 90099.
- **Installers:** all three shells were rebuilt from the v0.9.0 tag — the
  Windows `.msi` and `-setup.exe`, and the Android `.apk`. The APK is
  signed with the key introduced on 2026-09-19. Each was tried before
  publishing, not just built: the APK was installed on an emulator and a
  map opened and tapped (Queensland — the card rotated from its name-fact
  to its derived line and back), and the `-setup.exe` was installed on
  Windows and driven over CDP (63 maps listed, Italy — Regions opened on
  Known, a click pinned Emilia-Romagna and opened its card, the quiz dealt
  20 slips). RELEASES.md requires this because v0.3.0 shipped desktop
  installers that opened every map empty.

Not covered:

- **FT-38, the Wikidata landmark pass**, is not in this release. It was split
  out of FT-34 when the Wikidata SPARQL endpoint proved too unreliable to
  depend on — the same query took 1 s, then 29 s, then returned a 502 — and
  it stays deferred rather than shipping a build that hangs waiting on
  someone else's server.
- **The name-facts are English only.** The derived line above them is
  trilingual, because it is composed at run time from numbers and the i18n
  dictionary; the authored sentences are prose and would have to be
  translated by hand. Decision 3 in PLAN_V0.8.md.
- **The Android signing key changed on 2026-09-19.** An install from any
  download before the v0.7.0 re-upload cannot be updated in place — Android
  refuses an update signed by a different key. Uninstall first, which clears
  that device's saved progress on this app.

## v0.7.0 — 2026-09-19 — More maps, and slices of them

**Nineteen more maps, including the United States' cities — and a search box to find any of them.**
Six tasks (FT-27 to FT-32), the programme in
[`docs/PLAN_V0.7.md`](docs/PLAN_V0.7.md). Geoclick goes from 44 maps in 22
countries to **63 in 28**. The product owner tried v0.7.0-beta.1 before this
was cut.

For players:

- **The United States has cities at last** — four maps of them. **Cities**
  is the fifty over a million; **Cities — East**, **— Center** and
  **— West** split the country at the Mississippi and the Rockies and take
  everything over 200 000: 82, 48 and 44 places.
- **Six countries that had no map at all**: Turkey (81 provinces, 49
  towns), Nigeria (37 states, 50), Vietnam (63 provinces, 44), Colombia (33
  regions, 34), Egypt (27 governorates, 30) and South Korea (17 regions,
  26).
- **Italy's provinces now come in thirds as well** — North, Center and
  South. The full map of 110 can only write about half its names at the
  zoom it opens at; each third writes nearly all of its own.
- **A search box above the map list.** Type a country ("korea") or a kind
  of map ("towns") and the list narrows, with a count; Escape or Clear puts
  it back. It follows the language you are in, so "Städte" works in German.
- **The Progress tab is now called Known** (Gewusst, Conoscenza) — it says
  what the screen shows: the names you know, drawn as strongly as you know
  them.
- **Easier to hit on a phone.** The language pills and the favourite star
  keep their size but take taps from a finger-sized area around them, and
  the map's zoom buttons grew from 29 to 40 px.
- Place names were checked against the source for every new map, and a
  number of real errors fixed: "Washington, D.C.", "St. Paul" and
  "Ft. Worth" each had a double space, "Barlett" was Bartlett, Tennessee,
  three Vietnamese provinces carried their macro-region's name instead of
  their own, and Nasarawa, Elazığ, Seongnam, Osogbo and Ogbomoso were
  spelled the old way.

Under the hood:

- FT-27: `--lon-min`/`--lon-max`/`--lat-min`/`--lat-max` on the city
  builder, and a rule that tells two places of the same name apart by their
  region ("Kansas City, Missouri") while leaving two rows for the _same_
  place to the existing dedup.
- FT-28: the four US maps; `usa-cities-west` stops at −125 so Honolulu and
  Anchorage stay out, as `usa-states` already does.
- FT-29: the same slice flags on the polygon builder, and Italy in thirds.
- FT-30: twelve maps for six countries, each built from the name field that
  the source actually gets right (`name_tr`, `name_vi`, `name_en`…).
- FT-31: `mapSearch.ts`, matching country and label, accent- and
  case-insensitive; the catalog is sorted alphabetically again.
- FT-32: the tab rename in three languages, touch targets, and a check of
  the real accessibility tree (the star and pills do carry their names and
  pressed state — v0.5.0's note blamed the app for what was the emulator).
- The map data grows by about 4 MB; 63 maps now.
- Android versionCode 70099. Installers: Windows `.msi` and `-setup.exe`,
  and the Android APK, all rebuilt for this release.

Not covered:

- **The site moved to <https://geoclick.netlify.app/>** during this release
  (the generated address it had before now returns 404). Every published
  release's notes and the downloads page were corrected, so nothing points
  at the old one any more.
- **A name that has nowhere to go is still left out** until you zoom in —
  v0.6.0's bargain, and the reason Italy's provinces now come in thirds as
  well as whole.
- **Russia on a narrow phone screen** still shows its Arctic coast partly
  behind the map bar; MapLibre clamps the camera that far north, as
  DECISIONS.md records.
- **The remaining countries with no map** — Iran, the Philippines,
  Thailand, South Africa, Romania and the rest — are a batch for another
  release.

## v0.6.0 — 2026-09-18 — Harder as you get better

**Harder as you get better: the game now tracks how well you know each name, and the map stops giving the answer away.**
Eight tasks (FT-19 to FT-26), the programme in
[`docs/PLAN_V0.6.md`](docs/PLAN_V0.6.md). The product owner tried
v0.6.0-beta.1 before this was cut.

For players:

- **Every name you place is remembered as a streak.** Place a name right
  three times in a row with no mistake and it counts as _known_; one
  mistake and that name starts again from zero.
- **The better you know a map, the fewer names you get to choose from.**
  The tray starts with every name, then offers 6 at a time, then 3, then
  one — so the last few drops of a round can't be worked out by
  elimination any more, and a map you know keeps being worth playing.
- **One mistake and the name is shown.** A wrong drop flashes the region
  you hit red, then puts the name where it really belongs, in gold-brown.
  Before, you had three tries and the third one gave it away with no
  warning.
- **A progress map replaces Explore.** The tab (now called **Progress**)
  shows every name you have placed right, written as strongly as you know
  it: full strength for a name you know, lighter for two right in a row,
  faint for one. Clicking a region still tells you its name, as Explore
  did.
- **Names never overlap.** On any map, a name that has nowhere legible to
  go tries a line above or below its place and is otherwise left out
  until you zoom in — the way an atlas does it. A town's name now sits
  _beside_ its dot, never on top of it, so Italy — Towns shows all 40
  names instead of 26.
- **A map opens fully visible on a phone.** The opening view leaves room
  for the map bar and the quiz tray, and covers each region's whole
  shape, so you no longer have to pan before you can play.
- **The home page says how well you know each map** — "14 / 20 known",
  with "3 names at a time" once the map gets harder — instead of how many
  places are due for review. The quiz always plays the whole map now, so
  "Up to date!", practice mode and review counts are gone. Geoclick still
  keeps a schedule underneath; it just doesn't ask you to think about it.
- **A round survives a trip to the Overview.** Look a name up and come
  back: the round is exactly as you left it.
- The tutorial and the user manual follow all of this, in English, German
  and Italian.

Everyone playing already starts from a clean streak of zero on every
name, so the first round after updating will show maps as unknown and
offer every name; the streaks rebuild over the next few rounds.

Under the hood:

- FT-19: `cleanStreak` in `packages/srs`, persisted in all three stores
  (localStorage, Tauri SQLite migration 2, Capacitor SQLite).
- FT-20: `MISSES_BEFORE_REVEAL = 1`; a wrong drop resolves the name.
- FT-21: `difficulty.ts` — the map's level from its streaks, and the
  tray's hand of names.
- FT-22: the retention map in `MapView`, three label strengths and a
  legend.
- FT-23/FT-24: `labelCollision.ts` — labels are measured after every map
  move and placed in the best free spot they have; a symbol layer was
  reconsidered and rejected again (it would need glyph fonts shipped in
  the app, and could not magnify one label).
- FT-25: `mapFit.ts` — overlays declare where they are and the opening
  fit clears them; the fit covers target extents, not centroids.
- FT-26: whole-map rounds, mastery copy in three languages,
  `quizRound.ts` for a round in progress.
- Android versionCode 60099. Installers: Windows `.msi` and
  `-setup.exe`, and the Android APK, all rebuilt for this release.

Not covered:

- **Russia on a narrow phone screen** still shows its Arctic coast partly
  behind the map bar. That far north, the Mercator world is shorter than
  the viewport, so MapLibre clamps the camera and no amount of padding
  helps; every region's centre is on screen, and it is no worse than
  v0.5.0 (DECISIONS.md, "A map opens fully visible").
- **A name that has nowhere to go is left out**, by design — on Italy —
  Provinces about half the names show at the opening zoom, the rest
  appear as you zoom in. This was the product owner's choice over
  shrinking or stacking names.
- **Review dates are still kept but never shown.** Scheduling as a
  suggestion of what to play next is a later release, not this one.

## v0.5.0 — 2026-09-14 — Tutorial, favourites and recent maps

**A tutorial that shows you around, and your favourite and recent maps one tap away.**
Eight tasks: the tutorial (FT-09 to FT-12), favourite and recent maps
(FT-15 to FT-17), and FT-18, found while testing the beta. The product
owner tried v0.5.0-alpha.1 and v0.5.0-beta.2 before this was cut;
beta.1 was built but held back for FT-18.

For players:

- **A hands-on tutorial.** Press "Tutorial" at the top of the home page or
  any map, and it walks you through Italy — Regions for real: open the
  map, zoom and pan, the overview, Explore, dragging names in the quiz
  (including getting one wrong on purpose), spaced repetition and the
  tour. It waits for you to do each thing, in English, German or Italian,
  and nothing you do in it touches your real progress. First-time visitors
  are offered it on the home page, once.
- **Sicily no longer starts hidden under the name tray** in the quiz: the
  map now fits into the space above the tray, on every map.
- **Dragging the map works everywhere,** even when the drag starts on a
  region's name. Before, on a phone, it often just enlarged the name. A
  name still grows when you point at it with a mouse or tap it.
- **Star the maps you like.** Every map on the home page has a star, and
  so does the map bar while you're on a map. Starred maps appear in a
  "Favourites" section at the very top of the home page. It's kept on
  your device only.
- **A "Recent" section at the top of the home page** lists the last five
  maps you opened, newest first, so you don't have to find them in the
  country list again. It's kept on your device only.
- Favourites and Recent share their own panel at the top of the home page,
  with an "All maps" heading below it, so they stand out from the full
  list.

Under the hood:

- FT-15: `mapPrefs.svelte.ts` (a device-local list, like the language
  setting), recorded whenever a map view opens.
- FT-16: favourites in the same store, and a `FavouriteStar` button.
  Home order: Favourites, Recent, all maps.
- FT-17: Favourites and Recent in one panel, "All maps" heading.
- FT-09: the tutorial's script and interaction spec (`docs/TUTORIAL.md`).
- FT-10: progress sandbox for the tutorial (Italy — Regions in memory,
  every other map live).
- FT-11: tutorial engine (`tutorialMachine.ts`, pure and unit-tested),
  overlay, button and hooks; the quiz fits the map above its tray.
- FT-12: first-visit nudge, walked in all three languages at 360px and
  1280px; step 10 shortened to fit.
- FT-18: map labels take no pointer input; hover and tap magnify are
  worked out from the pointer's position.
- Android versionCode 50099. Installers: Windows `.msi` and `-setup.exe`,
  and the Android APK, all rebuilt for this release.

Not covered:

- The emulator's accessibility tree showed the favourite star without its
  name and pressed state (the language pills lose their state the same
  way, so probably the tool). Worth a TalkBack check on a phone.
- Country names stay in English inside map names ("Italy — Regionen"), as
  decided for i18n; unchanged here.

## v0.4.0 — 2026-09-14 — Navigation

**Maps open where the names are, and Android's back button goes where you'd expect.**
Two tasks added ahead of the tutorial, FT-13 and FT-14. It's also the first
release to go through the new alpha pre-release: the product owner tried
v0.4.0-alpha.1 on Windows and on their phone before this was cut.

For players:

- **A map now opens on its overview**, with every region or town named, so
  you see the whole map before testing yourself. The old click-a-region
  view is still there, as the new **Explore** tab next to Overview, Quiz
  and Tour.
- **Android's back button goes up a level.** From a quiz, tour or explore
  it returns to that map's overview. From the overview it returns to the
  map list, and from the list it closes the app. Before, it retraced every
  screen you'd visited.
- On phones, the map bar no longer slides under the + / − zoom buttons,
  and map names no longer show through the tabs.

Under the hood:

- FT-13: maps open on the overview, the Explore tab, and the map bar
  layout (measured at 360 to 1024 px in EN, DE and IT).
- FT-14: `@capacitor/app` handles the back button, and `parentRoute()` in
  `backNavigation.ts` decides where it goes (unit-tested).
- New release rule: previews are published as **alpha** or **beta**
  GitHub pre-releases, never "latest" (docs/RELEASES.md, "Pre-releases").
  Android's version number is now `(M·10000 + m·100 + p)·100 + stage`,
  so alpha → beta → stable install as updates. This release is 40099.

Not covered:

- On a phone, names at the top of the overview can still peek through the
  small gaps between the map bar's tabs. A follow-up could start the map
  a little lower. Not scheduled.

## v0.3.1 — 2026-09-13 — Desktop maps fixed

**The Windows app shows its maps again.** A hotfix for v0.3.0, whose
desktop installers opened every map empty.

For players:

- **Maps appear in the Windows app.** In v0.3.0 the desktop app showed a
  map's background but no regions, borders or towns, so the quiz, tour and
  overview couldn't be used. Now every map loads as it does in the browser
  and on Android. If you installed v0.3.0 on Windows, install this version
  over it; your progress is kept.

Under the hood:

- The desktop app's built-in file server doesn't answer "send me part of
  this file" requests, which the map loader relies on. The desktop app now
  loads each map's tile file in one piece, as the Android app already did
  for the same reason. It's found and verified by debugging the built app
  through WebView2 (ONBOARDING.md explains how). The web version is
  unchanged.
- The Android app and website aren't affected. The Android APK is rebuilt
  only so that all downloads carry the same version.

Not covered: this was caught by the product owner trying the published
desktop app, not before release. v0.3.0's checks had tested the Android
app and the website, but not the Windows installers, and RELEASES.md's
"try them" step is where it would have shown.

## v0.3.0 — 2026-09-13 — Readable and installable

**Map names you can read, a real logo, and apps anyone can download.**
The first half of the feature programme in `docs/FEATURE_PLAN.md`: eight
tasks, FT-01 to FT-08.

For players:

- **Place names on the map are bigger, and they follow your browser's
  text-size setting.** They were a fixed 11 pixels; now they start at 13
  and grow if you've told your browser to use larger text.
- **Point at a name to magnify it.** With a mouse, hovering over any name
  on the map enlarges it and brings it in front of its neighbours. So a
  crowded label, like Reggio Emilia between Parma and Modena, is readable
  without zooming. On a phone or tablet, tap the name, and tap again (or
  anywhere else) to shrink it.
- **Geoclick has its own icon**: a cream map pin on dark green. It shows in
  the browser tab, on the desktop app and its installer, and on the
  Android home screen. The Android app also opens on a green launch screen
  with the pin, instead of a white one.
- **The desktop and Android apps can be downloaded by anyone.** The home
  page links to the public
  [releases page](https://github.com/diegoami/geoclick-releases/releases/latest):
  a Windows installer (`-setup.exe` or `.msi`) and an Android `.apk`.

Under the hood:

- One script, `design/logo/generate-icons.mjs`, generates every icon from
  `design/logo/geoclick-logo.svg`: desktop, Android launcher and splash,
  and favicon (FT-04, FT-05).
- Android release signing reads a gitignored key file or environment
  variables. The key and passwords never touch git (FT-06).
- `scripts/package-release.mjs` builds the installers from a release tag
  into `dist-release/`, with checksums. Android's version code now rises
  with every release, so phones see updates as updates (FT-07).
- `scripts/publish-release.mjs` uploads them to
  `diegoami/geoclick-releases`, a public repo holding only a README and
  the releases. It is a dry run unless given `--confirm` (FT-08).
- The README links to the live web app (FT-01).
- `*.browser.test.ts` runs plain-TypeScript tests that need a real DOM in
  Chromium.

Not covered, stated plainly:

- **The Windows installers aren't code-signed**, so Windows shows "unknown
  publisher" when installing (More info → Run anyway). A certificate
  costs money every year; that's revisited at the 1.0 launch.
- Tap-to-magnify was tested with simulated touch in a desktop browser and
  on the Android emulator's launcher, but not on a physical phone.
- The local test of the built app placed a slip by real mouse drag on the
  Italian provinces quiz. The towns quiz only loaded; it wasn't replayed.
- The desktop app's Start menu and taskbar icons weren't seen installed.
  They come from the same icon file as the app and installer, which were
  checked.

## v0.2.0 — 2026-09-13 — Known issues from the 2026-09-13 review resolved

**The milestone that closes out the 2026-09-13 code review: every one of
its 30 punch-list items has now shipped in v0.1.1, v0.1.2 or this
release.** Waves 3 and 4 plus GC-080 — five tasks.

For players:

- **Neighbouring regions never share a colour any more.** Map colours used
  to come from the length of each region's name, so neighbours often
  matched and borders vanished. On Italy's provinces, Bolzano, Sondrio,
  Belluno, Brescia and Bergamo were one olive blob. Every map now uses a
  six-colour palette, assigned so that no two neighbours match. A test
  checks all 44 maps. Unsolved regions are also more saturated, so
  the palette reads at a glance, and solved regions (green) still stand
  out clearly. (GC-032)
- **Dragging a slip over a region is easier to see.** The hover highlight
  is now a deep blue, because the new palette's light blue made it nearly
  invisible on one region in six. (GC-032)
- **Tours on big maps are watchable.** The Italian provinces tour used to
  take 5½ minutes at normal speed. Big maps now start the tour faster:
  italy-provinces at 2× (2:45), russia-regions and japan-towns-100k at
  1.5×. Every other map is unchanged, and the speed menu still lets you
  pick any speed. (GC-033)

Under the hood:

- Map labels are inserted as plain text instead of HTML, so a place name
  can never inject markup. That matters once maps come from users or
  OpenStreetMap. The popup styling that was copied into four
  views now lives once in `app/src/app.css`. It was checked in all four
  views and looks identical: same computed styles and widths as before.
  (GC-022)
- The map-build scripts are now typechecked (strict) and linted as part of
  the regular gates. All their `any`s are gone, and the resulting code is
  otherwise identical, so every map would build the same. (GC-004)
- Decided (not migrated): the map tiles stay in plain git rather than Git
  LFS. The repo pack is 15.6 MiB; the decision gets revisited at
  100 MB, a 25 MB tileset or about 60 countries. (GC-080, see DECISIONS.md)
- `npm run build-map-colors` recolours committed maps without rebuilding
  tiles, and the build scripts now colour new maps automatically.

Review findings closed: C8, D4, D12, and punch-list #8, #17, #21 (the
popup CSS, folded into GC-022), #25, #29, #30. With v0.1.1 and v0.1.2, that
is all 30 punch-list items.

What this milestone does not claim:

- **The review's broader point is only partly addressed.** It said the
  code's rules live in comments and prose rather than in checks.
  GC-021 (drop scoring), GC-030 (map data) and now GC-032 (colours) turned
  their rules into tests, but nothing makes future work keep doing so.
- **`feature/supabase-sso-sync` stays parked**, as DECISIONS.md records.
  Cross-device sync is not part of this release.
- **Desktop and Android builds were not rebuilt for this tag.** The web app
  is the verified artefact. The GC-040 Android check on a real device is
  still outstanding.

## v0.1.2 — 2026-09-13

**The second remediation batch: a faster home page, safer saving, and the
quiz's trickiest logic finally under test.** Wave 2 of the plan — four tasks.

For players:

- **The home page loads without downloading every map.** It used to fetch
  all 44 map files (~484 KB) on every visit just to count what's due; that
  information now ships with the page itself — 0 extra requests. Due counts
  are exactly the same as before. (GC-071)
- **A full or blocked browser storage no longer breaks a quiz.** Saving
  progress in Safari's private mode, or with storage full, used to throw
  mid-drag; now the save is skipped quietly and the quiz carries on.
  (GC-041)

Under the hood:

- The drop-scoring decision — including the Bremen tolerance rescue and the
  Essen/Duisburg "closest city" rule, both bugs found by real play — is now
  a pure, unit-tested function instead of inline component code, checked on
  the real maps before and after (GC-021).
- Progress can be cleared per map or entirely, on all three storage
  backends — groundwork only, no reset button yet (GC-041).
- Map build scripts find the `pmtiles` CLI via `PATH` / `PMTILES_BIN`
  instead of one machine's hardcoded path, and flag targets that cross the
  date line (today: Chukotka) (GC-031).
- The loop's `doctor` no longer force-removes other git worktrees — it
  would have deleted a parallel planning session's live work.

Review findings closed: C9, D8, D10, and punch-list #10, #13, #16, #22, #26,
#27, #28.

Known, documented, not changed: five shipped Polish map ids are mangled by
the id generator (`wroc-aw` for Wrocław, and similar) — players only ever
see the correct names, and changing ids would wipe saved progress (see
MAPS.md). At a large window's zoom, Bremen's edge sits beyond the 24px drop
tolerance from its centre — noted in GC-021's ledger row. GC-080's pmtiles
storage decision is already on `main` but belongs to the v0.2.0 milestone
notes.

## v0.1.1 — 2026-09-13

**The first remediation batch: the review's correctness bugs fixed, and the
quality gates actually running again.** Waves 0 and 1 of the plan in
`docs/REMEDIATION_PLAN.md` — ten tasks, each merged on green gates.

For players:

- **Regions you know well no longer vanish from review forever.** After about
  20 clean reviews the scheduler used to overflow into an invalid date and
  silently retire the card; review intervals are now capped at a year. A
  region you once fumbled can also climb back to full ease with clean
  answers, instead of carrying that one mistake forever. (GC-010)
- **Two quiz crashes fixed:** clicking "Practice all regions" before the map
  finished loading, and leaving the quiz within a moment of a wrong drop.
  Both were reproduced before being fixed. (GC-020)
- **A practice round no longer overwrites your real last score** on the home
  page. (GC-020)
- **Screen readers pronounce German and Italian correctly** — the page
  language now follows the language switcher. (GC-050)
- **Android: saved progress now has a proper upgrade path.** Future database
  changes apply exactly once per phone, and existing installs keep every
  saved answer (tested against a real SQLite; still needs a check on a real
  device — plan in the GC-040 commit). (GC-040)

Under the hood:

- `npm run lint` passes for the first time in weeks — Windows line endings
  had been failing it silently, so ESLint never ran (GC-001). A pre-push
  hook now runs all four gates before every push (`npm run setup-hooks`
  once per clone; GC-002).
- Component tests run again, in a real headless Chromium
  (`npx playwright install chromium` once per machine; GC-003). A
  map-data integrity test guards all 44 maps (unique names and ids, valid
  geometry, tour order, and that every map is listed on the home page), and
  `data/maps/index.json` is generated from the map files (GC-030).
- Asset loading works under a subpath, e.g. GitHub Pages (GC-070); the
  `window.__map` debug handle no longer ships to users (GC-020); docs now
  state the real 44 maps / 22 countries (GC-060).
- The version is kept in step across all three shells _and_ both lockfiles
  by `scripts/sync-version.mjs`, which had been missing `Cargo.lock` and
  `package-lock.json`.

Review findings closed: C1, C2, C3, C4, C5, C6, C7, C11, C12, C13, D1, D2,
D7, S1, S2, S3, S4, and punch-list #1-7, #9, #11, #12, #14, #15, #18, #19,
#20, #23, #24.

Not in this release: the GC-040 Android check on a real device; the map
palette and tour tuning (v0.2.0); GC-080's pmtiles storage decision, which is
ready but held for the v0.2.0 milestone on the product owner's call.

## v0.1.0 — 2026-09-13

**The first tracked release.** Everything built through Iteration 8+ before
the remediation work below begins, now given a version number, a tag, and
a visible build identifier in the app itself (bottom-right corner on every
screen: `vX.Y.Z · <commit>`).

- **22 countries, 44 maps** — regions/states/provinces plus a
  population-thresholded towns map per country, point- and polygon-target
  support, tour + quiz + spaced repetition (SM-2) on every one.
- **Three shells**: the live web app (Netlify), a Tauri desktop app
  (`.msi`/`.exe`/`.deb`/`.rpm`/`.AppImage`), and a Capacitor Android APK
  (POC quality).
- **UI in English, German, and Italian.**
- **Visual refresh**: warm background palette, opacity-driven
  solved/unsolved contrast on the map.
- **Local-first persistence** — `localStorage` in the browser, SQLite on
  desktop and Android, no accounts, no backend.
- Supabase-backed optional sign-in / cross-device sync was built and
  reconciled with `main` but is deliberately **paused**, not shipped — see
  `DECISIONS.md`'s "SSO/cross-device sync deferred" entry.
- An independent Opus code review (`CODE_REVIEW_2026-09-13.md`) found real
  correctness issues — most notably an uncapped SRS interval that can
  silently retire a card forever, and an ease factor that never recovers
  once lowered. None of those fixes are in this release; they're the
  subject of the remediation work that follows it.

Versions are kept in sync across all three shells' manifests by
`scripts/sync-version.mjs`; the root `package.json` is the source of truth.
