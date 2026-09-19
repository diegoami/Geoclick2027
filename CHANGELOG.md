# Geoclick — Changelog

Release notes, newest first. See [`ROADMAP.md`](ROADMAP.md) for the
day-to-day build log and [`DECISIONS.md`](DECISIONS.md) for the reasoning
behind product/design choices — this file is the release-facing summary,
one entry per tagged version on `main`.

## Unreleased

**Something to hang a name on.** The programme in
[`docs/PLAN_V0.8.md`](docs/PLAN_V0.8.md).

For players:

- **A Terrain button in the map bar** (Gelände, Rilievo). Press it and the
  sea turns blue, the rivers appear, and the ranges, deserts and seas around
  the map get their names — the Alps behind Trentino, the Adriatic beside
  Puglia, the Po across Lombardia. Until now every map was politics only,
  with the water the same sand colour as the land, so no coastline read at
  all. Off by default, one setting for every map, remembered per device.
- **The names come in your language**: Alpen and Adriatisches Meer in
  German, Alpi and Mar Adriatico in Italian.
- A terrain name never covers a name you are learning — it gives way, and
  comes back when there is room.
- With Terrain on, the region colours lighten so the ground shows through:
  the Apennines run visibly down the middle of Italy, the Appalachians up
  the eastern United States. Switching it off puts the colours straight back.

Under the hood:

- FT-33: five more Natural Earth datasets; a second tileset per map
  (`terrain.pmtiles`, 4.94 MB over all 63, fetched only when the layer is
  switched on) built by `data/scripts/build-terrain.ts`; its maximum zoom
  follows each map's extent.

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
