# Geoclick — Changelog

Release notes, newest first. See [`ROADMAP.md`](ROADMAP.md) for the
day-to-day build log and [`DECISIONS.md`](DECISIONS.md) for the reasoning
behind product/design choices — this file is the release-facing summary,
one entry per tagged version on `main`.

## Unreleased

**Your favourite and recent maps, one tap away.**

For players:

- **Star the maps you like.** Every map on the home page has a star, and
  so does the map bar while you're on a map. Starred maps appear in a
  "Favourites" section at the very top of the home page. It's kept on
  your device only.
- **A "Recent" section at the top of the home page** lists the last five
  maps you opened, newest first, so you don't have to find them in the
  country list again. It's kept on your device only.

Under the hood:

- FT-15: `mapPrefs.svelte.ts` (a device-local list, like the language
  setting), recorded whenever a map view opens.
- FT-16: favourites in the same store, and a `FavouriteStar` button.
  Home order: Favourites, Recent, all maps.

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
- The version is kept in step across all three shells *and* both lockfiles
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
