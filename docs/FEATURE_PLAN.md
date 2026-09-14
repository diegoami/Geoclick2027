# Geoclick — Feature programme (planned 2026-09-13)

This programme turns the four requests in
[FEATURE_BACKLOG.md](FEATURE_BACKLOG.md) into sixteen tasks and three
releases. It is separate from the [remediation
programme](REMEDIATION_PLAN.md), which closed with `v0.2.0`: that one
fixed what a code review found, while this one adds things players will
notice.

**Status: in progress** — see the ledger at the bottom. v0.4.0 (FT-13, FT-14) is out. v0.5.0 is in progress: all tasks (FT-09 to FT-12, FT-15 to FT-17) are merged; v0.5.0-beta.1 was held back for FT-18 (merged); v0.5.0-beta.2 next, then v0.5.0.

---

## Product decisions (answered by the product owner, 2026-09-13)

Every question FEATURE_BACKLOG.md left open was put to the product owner
before this plan was written. They are recorded here, and in
DECISIONS.md's "Feature programme decisions" entry, so no task has to guess.

| # | Question | Decision |
|---|---|---|
| 1 | Where do public desktop/Android downloads live, given the source repo is private? | **A separate public "releases-only" GitHub repo.** Installers are attached to its Releases, so anyone can download without logging in, the source stays private, and nothing is committed to git. The main repo stays private; going public stays tied to the 1.0 launch. |
| 2 | How are the installers built? | **Manually on the local machine, following a checklist.** No CI for now. |
| 3 | Who designs the logo? | **Claude drafts 2-3 candidates** and the product owner picks or redirects. Generating the platform icon sets from the chosen one is a normal task. |
| 4 | Text size: what scales, and how many sizes? | **Names on the map: magnify on demand.** Hover on desktop (FT-02), tap on touch screens (FT-03), with no persistent size setting. *Revised at FT-02's review; the original answer was a Normal/Large switch for map labels and quiz slips.* |
| 5 | Does the tutorial save real progress? | **No, it's sandboxed.** A real quiz runs, but progress lives in memory for the tutorial only, so real review data is never written. |
| 6 | How does the tutorial start? | **From a Tutorial button, plus a dismissible first-visit nudge** on the home page. It never starts by itself. |
| 7 | Which map does the tutorial use? | **Always Italy — Regions.** |
| 8 | "Preview" in the tutorial request means? | **The existing Overview view.** |
| 9 | Merging | **Ask before every merge.** The remediation loop's automerge was approved for that loop only, and CLAUDE.md's default applies here. The product owner tries each branch before it lands. |
| 10 | Opening a map (added 2026-09-14) | **Maps open on their overview**, with every name shown, instead of the blank explore view. The explore view (click a region to see its name) **stays, as its own "Explore" tab** in the map bar. |
| 11 | Android back button (added 2026-09-14) | **Back goes up one level, not back through history:** quiz, tour and explore go to that map's overview; the overview goes to the map list; on the map list, back closes the app as usual. Browser and desktop back buttons are unchanged. |
| 12 | Release order (added 2026-09-14) | **These two ship first, as `v0.4.0`**, so they can be tried on a phone before the tutorial work starts. The tutorial moves to `v0.5.0`. |
| 13 | Recent maps (added 2026-09-14) | **Any map you open counts:** overview, explore, quiz or tour. The home page shows the **5 most recent**, newest first, and reopening one moves it to the top. |
| 14 | Favourite maps (added 2026-09-14) | **A star on every home page map card and in the map bar**; both toggle the same favourite. |
| 15 | Home page order (added 2026-09-14) | **Favourites, then Recent, then all maps by country.** A section shows only when it has something in it. Both lists live on the device, like the language setting. |
| 16 | Tutorial and Recent (added 2026-09-14) | **The tutorial's practice run doesn't count as a visit.** It stays out of Recent, the same way it saves no real progress (decision 5). |
| 17 | Explore in the tutorial (FT-09 review, 2026-09-14) | **A step of its own:** open Explore and click a region to see its name. The tutorial has eleven steps. |
| 18 | Tutorial sandbox scope (FT-09 review, 2026-09-14) | **Only Italy — Regions is sandboxed.** Every other map reads and writes real progress during the tutorial, so the home page looks normal and a map played while the tutorial is paused is saved. |
| 19 | Tutorial ending (FT-09 review, 2026-09-14) | **The star is a tip in the outro**, not a step, and **Finish leaves the player on the tour.** |

Why decision 1 beat FEATURE_BACKLOG.md's own suggestion (static files on
the Netlify site): the current builds are 18 MB (`.msi`), 17 MB
(`-setup.exe`) and 27 MB (debug `.apk`). Serving them from Netlify means
committing them to git, about 60 MB per release. That would take the repo
from 15.6 MiB to about 75 MiB on the first release and past GC-080's
100 MB "revisit git storage" threshold on the second.

---

## How this programme runs

This is a lighter version of the remediation loop, sized for twelve tasks.
It deliberately does **not** reuse `scripts/task.mjs`, `docs/tasks.yaml` or
the `.orchestrator/state` files. Those are hardwired to the remediation
programme, and a twelve-row table doesn't need a state machine.

1. **One task at a time, in the order below.** A task starts only when its
   dependencies have merged. Each task gets its own branch off `main`,
   `feat/ft-NN-<slug>`, which is committed and pushed without asking
   (CLAUDE.md).
2. **Quality gates:** `npm run gates` (check, test, lint, build). The
   pre-push hook already runs them.
3. **Verify locally, labelled as such.** Use the dev server or a served
   production build, in a real browser, with screenshots in
   `.orchestrator/log/FT-NN-*` (that folder is gitignored, same as
   before). Tell the product owner the concrete steps to try the feature
   themselves.
4. **Ask before merging.** The request gives the branch, what changed, how
   it was verified, how to try it, and any deviation from the spec. Merge
   only after an explicit OK.
5. **After a merge:** tick the ledger at the bottom of this file, delete
   the branch locally and on `origin`, and stop any dev server.
6. **Product-owner steps are marked 🧑 in the task specs.** At those points
   the task stops and waits, even mid-task. Three kinds:
   - choices only the product owner can make (the logo),
   - secrets the agent must never hold (the Android signing key),
   - public, outward-facing actions (creating the public repo, publishing
     binaries).
7. **Previews are pre-releases** (rule added 2026-09-14). A build handed
   out for testing before it's final, such as trying a task on a phone
   before its merge, is published as an **alpha** or **beta** GitHub
   pre-release, per [RELEASES.md](RELEASES.md), "Pre-releases". It's not
   sent around as a loose file.
8. **Releases:** follow [RELEASES.md](RELEASES.md)'s checklist, including
   asking before tagging and not watching the deploy. FT-07 adds a "build
   and publish the installers" section to it, used from `v0.3.0` onwards.

Versioning follows RELEASES.md: a batch that adds features bumps the minor
version. `1.0.0` stays reserved for the public launch.

| Release | Tasks | Theme |
|---|---|---|
| `v0.3.0` | FT-01 to FT-08 | **Readable and installable.** Map names magnify on hover or tap, the apps get a real logo, and anyone can download the Windows and Android installers. |
| `v0.4.0` | FT-13, FT-14 | **Navigation.** Maps open on their overview, explore gets its own tab, and Android's back button goes up a level. |
| `v0.5.0` | FT-15, FT-16, FT-17, FT-09 to FT-12, FT-18 | **Tutorial, favourites and recent maps.** Mark maps as favourites, find recently played maps at the top of the home page, and an interactive walkthrough in English, German and Italian. |

---

## Tasks

Effort: **Low** is under an hour or so, **Medium** is a focused session,
**High** is multi-step with real design risk.

### FT-01 — Link the live web app from the README · Low · deps: none

- **Why:** FEATURE_BACKLOG.md §1: README.md never links to
  <https://zesty-centaur-40e7c5.netlify.app/>. It's cheap and useful
  whatever else happens.
- **Do:** add a "Play it" link near the top of README.md. Placeholder
  mentions of downloads wait for FT-08.
- **DoD:** README.md opens with the live link; gates green.

### FT-02 — Map labels in relative units · Low · deps: none

- **Why:** FEATURE_BACKLOG.md §4, fix 1. Both popup classes in
  `app/src/app.css` are a fixed `11px`, so they ignore the browser's
  font-size setting, which the rest of the app's text follows. (Corrected
  while doing FT-02: page zoom, Ctrl +, scales `px` too, so zoom was never
  the gap; FEATURE_BACKLOG.md §4 said otherwise.)
- **Do:** switch `font-size` in `app.css`'s shared popup rule to a relative
  unit, bumped from 11px. Aim for about `0.8125rem` (13px at default
  settings), and tune it by looking. Keep one rule for both classes (the
  GC-022 consolidation), and keep the weights (900 explore/tour, 600
  solved).
- **Added by the product owner at review (2026-09-13): hover to magnify.**
  A 13px base alone was "still not satisfying". Now a label under the
  mouse grows to 20px (`1.25rem`), goes nearly opaque, and rises above
  its neighbours, so crowded or small names are readable without zooming
  the map. This is CSS only, in `app.css`: `font-size` rather than
  `transform`, so the text stays crisp and pinned to its point.
  `prefers-reduced-motion` turns the transition off. Touch screens have
  no hover; FT-03 adds tap-to-magnify for them.
- **Verify:** check overview crowding on `italy-provinces` (110 labels),
  `germany-states` (long German names) and a towns map. Also check that
  a larger root font size (the browser's font-size setting) now enlarges
  the labels; before this change it doesn't.
- **DoD:**
  - no `px` font size remains on the popups;
  - labels follow the browser's font-size setting;
  - before/after screenshots of the three maps;
  - DECISIONS.md's "Map colors" / popup notes updated if they quote 11px;
  - gates green.

### FT-03 — Tap to magnify a label on touch screens · Low–Medium · deps: FT-02

- **Why:** FT-02's hover-to-magnify doesn't exist on touch screens (the
  Android app, tablets, phones). The product owner chose this over the
  planned Normal/Large switch at FT-02's review (decision 4, revised): one
  behaviour on every device, and no new setting or UI.
- **Do:**
  - Add an explicit `.is-magnified` state, styled by the same rule as
    `:hover` in `app.css`.
  - Limit the `:hover` half to real pointers, `@media (hover: hover)`.
    Mobile browsers fake a sticky `:hover` on tap, and it behaves
    inconsistently; the explicit state replaces it.
  - One delegated `pointerdown` listener on the map container. Add it
    in `createMap` (`geoclickMap.ts`) so all four views get it. A
    non-mouse pointer on a `.maplibregl-popup-content` toggles
    `.is-magnified` on that label and clears any other. A touch anywhere
    else on the map clears it. At most one label is magnified at a time.
  - It must not change what a tap does today. In explore mode, a tap on a
    region still selects it. In the quiz, a slip drag keeps pointer
    capture on the slip, and drop hit-testing stays coordinate-based.
- **Test:** a browser component test on a fixture container. A touch
  `pointerdown` on a label magnifies it. A second label moves the
  magnification to it. A touch on empty map clears it. A mouse
  `pointerdown` does nothing, because mouse users have hover.
- **Verify:**
  - Chrome DevTools touch emulation on the `italy-provinces` overview
    (tap Reggio Emilia) and in the quiz on solved and revealed labels;
  - one quiz drag at phone width (about 400 px);
  - the Android app on the emulator or a device, if available; say which.
- **DoD:**
  - tap magnifies, a second tap or a tap elsewhere shrinks it back;
  - mouse hover still works;
  - no change to region taps or quiz drops;
  - screenshots;
  - DECISIONS.md "Feature programme decisions" updated for decision 4
    (done at the FT-02 merge);
  - ONBOARDING.md mentions the magnify behaviour;
  - gates green.

### FT-04 — Logo candidates → product owner picks · Medium · deps: none

- **Why:** FEATURE_BACKLOG.md §2 (decision 3). Both shells ship scaffold
  art: `desktop/src-tauri/icons/*` is Tauri's default set, and Android's
  `mipmap-*`, adaptive `ic_launcher.xml` and `drawable*/splash.png` are
  Capacitor's defaults.
- **Do:**
  - Draft 2-3 distinct candidates as SVG under `design/logo/`, each a
    simple map/pin/quiz mark in the app's existing palette.
  - Show each on one comparison page at 16, 32, 48, 192 and 512 px, on
    light and dark backgrounds, and inside Android's adaptive-icon safe
    zone (a 66% circle, since launchers crop to circles, squircles or
    squares).
  - Also show the current favicon next to them.
- 🧑 **Product owner:** picks a candidate (or redirects, which means
  another round), and decides whether the web favicon switches to it.
  The default is to switch, so all three shells match.
- **DoD:**
  - the approved master is committed as `design/logo/geoclick-logo.svg`
    plus a 1024×1024 PNG;
  - rejected drafts are removed;
  - DECISIONS.md entry "App logo" records the choice.

### FT-05 — Generate icon sets and splash from the approved logo · Low–Medium · deps: FT-04

- **Do:**
  - **Desktop:** `npx tauri icon design/logo/geoclick-logo.png` (from
    `desktop/`) regenerates everything in `desktop/src-tauri/icons/`.
  - **Android:** generate the adaptive icon (foreground on a solid
    background), legacy and round `mipmap-*` densities, and the splash
    screens. `@capacitor/assets` does all of it from one source image.
    Android Studio's Image Asset tool is the fallback.
  - **Web:** `app/src/lib/assets/favicon.svg`, if FT-04 said to switch.
- **Verify:**
  - Rebuild the desktop installer and check the icon on the installer,
    the Start menu, the taskbar and the window title bar.
  - Rebuild the APK and check the launcher icon (round and square
    launchers if the emulator allows) and the splash screen, which must no
    longer be Capacitor's logo.
  - Screenshots of each.
- **DoD:**
  - no scaffold art remains in either shell;
  - the favicon matches FT-04's decision;
  - ONBOARDING.md explains how to regenerate the icons;
  - gates green.

### FT-06 — Android release signing · Low · deps: none

- **Why:** the only APK so far is `app-debug.apk`, signed with a
  per-machine debug key. If that key changes, installed copies can't be
  updated, and it isn't a proper artefact to publish.
  `mobile/android/app/build.gradle` has no `signingConfigs.release` at all.
- **Do:**
  - Add `signingConfigs.release` that reads the keystore path, alias and
    passwords from a gitignored `mobile/android/keystore.properties`, or
    from environment variables.
  - The build must still work without that file; it simply doesn't
    produce a signed release.
  - Gitignore `keystore.properties` and `*.jks` / `*.keystore`.
- 🧑 **Product owner:** generates the keystore with the `keytool` command
  the task provides, fills in `keystore.properties`, and keeps a backup
  of both outside the repo. **The agent never sees or types the
  passwords.** If the key is lost, installed apps can never be updated,
  which is why ONBOARDING.md must say so plainly.
- **DoD:**
  - `assembleRelease` produces a signed APK, confirmed with
    `apksigner verify --print-certs`;
  - no secret is in git (check `git log -p` for the new files);
  - ONBOARDING.md's Android section is updated;
  - gates green.

### FT-07 — Release packaging checklist and script · Medium · deps: FT-06

- **Do:**
  - Write `scripts/package-release.mjs`. It checks that the working tree
    is clean and that HEAD is at the `vX.Y.Z` tag, then runs the three
    builds:
    - the web app,
    - the desktop app (`tauri build`, which gives both `.msi` and NSIS
      `-setup.exe`),
    - the Android app (`assembleRelease`).
  - **Android `versionCode` must go up every release** (found in FT-06:
    `mobile/android/app/build.gradle` has `versionCode 1` fixed, and
    `scripts/sync-version.mjs` only sets `versionName`). Derive it from the
    version, for example `major*10000 + minor*100 + patch` (0.3.0 gives
    300), in `sync-version.mjs`, so installed copies see each release as
    an update.
  - It collects the output into a gitignored `dist-release/vX.Y.Z/` with
    clear names: `Geoclick-X.Y.Z-windows-x64.msi`,
    `Geoclick-X.Y.Z-windows-x64-setup.exe` and `Geoclick-X.Y.Z-android.apk`.
  - It writes `SHA256SUMS.txt` and prints a summary of files and sizes.
  - It is local only, with no CI (decision 2). It fails with a clear
    message when a toolchain is missing (Rust, the Android SDK, the JDK)
    or when the keystore isn't configured.
  - Add a "Build and publish the installers" section to
    `docs/RELEASES.md`, placed after tagging: package, then publish per
    FT-08, then say in the CHANGELOG entry which installers shipped.
- **DoD:**
  - a dry run on the current `main` produces all three files plus
    checksums (run on a scratch tag, then delete the tag, or with
    `--allow-untagged`);
  - `dist-release/` is gitignored;
  - RELEASES.md is updated;
  - gates green.

### FT-08 — Public releases repo + download link · Medium · deps: FT-01, FT-05, FT-07

- 🧑 **Product owner:** approves creating the public repo
  `diegoami/geoclick-releases`, which is outward-facing, at the moment it
  happens, via `gh repo create --public` or by the product owner directly.
- **Do:**
  - **The releases repo's README:** what Geoclick is, a link to the web
    app, and honest install notes:
    - the Windows installers are **not code-signed**, so SmartScreen
      shows "unknown publisher" (use "More info → Run anyway");
    - Android needs "install unknown apps" for the browser or file
      manager;
    - there is no auto-update.
  - Extend `scripts/package-release.mjs` (or a sibling script) with a
    `--publish` step: `gh release create vX.Y.Z --repo
    diegoami/geoclick-releases <files> --notes-file <player-facing part
    of the CHANGELOG entry>`. It is never run without the product owner's
    OK (🧑 per release).
  - **Web home page:** a small "Download for Windows / Android" link to
    `https://github.com/diegoami/geoclick-releases/releases/latest`. Show
    it only on the web build, not inside the desktop or Android apps
    (use the `isTauri()` / `Capacitor.isNativePlatform()` checks
    `progressRepository.ts` already uses). Link text goes in all three
    languages.
  - README.md gets the same link.
- **Ordering note:** merge FT-08 last before tagging `v0.3.0`, then
  package and publish right after the tag. The link points at an empty
  releases page only for those minutes.
- **DoD:**
  - the repo exists and is public;
  - its README is written;
  - the download link shows on the web only, in all three languages;
  - `--publish` has been dry-run;
  - DECISIONS.md is updated ("Feature programme decisions" #1 carries
    the repo URL);
  - gates green.

**→ Release `v0.3.0`.** This is the first release with public installers.
Follow RELEASES.md's release checklist, then its new build-and-publish
section. The publish step is 🧑.

### FT-13 — Maps open on the overview; Explore becomes a tab · Low–Medium · deps: none

- **Why:** decision 10. Opening a map today lands on the explore view, a
  blank map where you click a region to see its name. The product owner
  wants the overview, where every name is shown, as the first screen, and
  explore kept as a tab.
- **Do:**
  - Home page map cards link to `/map/<id>/overview` instead of
    `/map/<id>` (`app/src/routes/+page.svelte`). Look for any other link
    to the bare map route and point it at the overview too, unless it
    means explore specifically.
  - `MapNav.svelte`: add an **Explore** tab linking to `/map/<id>`, in the
    order Maps · Overview · Explore · Quiz · Tour. `active` gains
    `'explore'`, and `MapView.svelte` passes it. The label goes in
    `i18n.svelte.ts` in all three languages (for example Explore /
    Erkunden / Esplora), with an icon in the same style as the others.
  - **Watch the phone width:** a fifth tab has to fit the map bar at about
    400 px in all three languages. German labels run longest. If it
    doesn't fit, shrink or wrap the labels; don't drop the icons.
  - The `/map/<id>` URL keeps working, so bookmarks and the tutorial's
    later anchors are unaffected.
- **Test:** a browser component test of `MapNav` showing all five tabs,
  with the right one active in each view, if the existing test setup makes
  that cheap. Otherwise verify in the browser.
- **Verify:**
  - home → a map lands on the overview, on a polygon map and a towns map;
  - the Explore tab opens the click-to-reveal view;
  - all five tabs fit at phone width in EN/DE/IT;
  - the desktop app and the Android emulator.
- **DoD:**
  - maps open on the overview;
  - Explore is reachable from every map view;
  - no clipped nav at 400 px;
  - ONBOARDING.md and ARCHITECTURE.md describe the new default;
  - gates green.

### FT-14 — Android back button goes up a level · Medium · deps: FT-13

- **Why:** decision 11. Android's back button follows browsing history
  today, so after quiz → tour → back you land in the quiz, not the
  overview. The product owner wants it to go up the app's hierarchy.
- **Do:**
  - Add `@capacitor/app` to `app` and `mobile` at the Capacitor version
    already in use, and run `cap sync`. Commit the Gradle and plugin files
    that sync regenerates.
  - Write a pure function `parentRoute(pathname)`:
    - `/map/<id>/quiz`, `/map/<id>/tour` and `/map/<id>` (explore) go to
      `/map/<id>/overview`;
    - the overview goes to `/`;
    - `/` returns "exit".

    It must honour the app's base path (`resolve` from `$app/paths`).
  - Register one `App.addListener('backButton', …)` from `+layout.svelte`,
    only when `Capacitor.isNativePlatform()`. It navigates to
    `parentRoute` with `goto(…, { replaceState: true })`, so history
    doesn't grow, or calls `App.exitApp()` on the map list. Remove the
    listener on destroy.
  - Leave web and desktop back behaviour alone. Browser and Tauri history
    keep working as today.
- **Test:** unit-test `parentRoute` for every route, including a base
  path and trailing slashes.
- **Verify on the emulator:** `adb shell input keyevent KEYCODE_BACK` from
  the quiz, tour, explore and overview goes to the expected screen each
  time, and on the map list the app closes. Screenshots of each step.
  **Try the release APK, not just a debug build** (RELEASES.md, step 2).
- **DoD:**
  - the back button follows decision 11 on Android;
  - `parentRoute` is unit-tested;
  - web and desktop back are unchanged;
  - ONBOARDING.md notes the plugin and the listener;
  - gates green.

**→ Release `v0.4.0`.** Web plus freshly built installers, per
RELEASES.md (open a map in each installer before publishing).

### FT-15 — Recent maps on the home page · Low–Medium · deps: none (start after v0.4.0)

- **Why:** decisions 13, 15 and 16. Players come back to the same few
  maps, and today they have to find them in a 44-map country list every
  time.
- **Do:**
  - Add a small store, `app/src/lib/mapPrefs.svelte.ts`. It's shared with
    FT-16 and modelled on `i18n.svelte.ts`: `$state` plus localStorage, with
    the same `typeof localStorage` guard for prerendering and a try/catch
    for private-mode storage.
    - Key `geoclick:recent-maps:v1`.
    - `recordVisit(mapId)` moves the map to the front, drops duplicates,
      and keeps 5.
    - `recentMaps()` returns the list, ignoring ids no longer in the
      catalog (a removed map).
  - Record a visit whenever a map view opens. `MapNav` is on all four
    views, so its mount is the natural place. **No visit is recorded while
    the tutorial is running** (decision 16): FT-10's tutorial flag makes
    `recordVisit` a no-op.
  - **Home page:** a "Recent" section above the country list, shown only
    when non-empty. Its cards use the same style as the list, labelled
    with the full map name ("Italy — Regions", from `mapDisplayName`),
    and link to the map's overview. The heading goes in the i18n files in
    all three languages.
- **Test:** unit tests for the store: order, dedupe, cap at 5, unknown
  ids dropped, and broken or blocked storage tolerated.
- **Verify:** open three maps; the home page lists them newest first;
  reopen the oldest and it moves to the top; reload the page and the list
  persists. Check at phone width, in the desktop app and on the emulator.
- **DoD:**
  - Recent works as above on web, desktop and Android;
  - tests pass;
  - DECISIONS.md entry "Recent and favourite maps" (shared with FT-16);
  - gates green.

### FT-16 — Favourite maps · Medium · deps: FT-15

- **Why:** decisions 14 and 15.
- **Do:**
  - Extend `mapPrefs.svelte.ts`: key `geoclick:favourite-maps:v1`, with
    `toggleFavourite(mapId)`, `isFavourite(mapId)` and `favouriteMaps()`
    (in the order they were starred, unknown ids dropped).
  - **Home page:** a star button on every map card, in all three sections.
    Make it a sibling of the card link, not nested inside it, so
    keyboard and screen readers see two separate controls. Add a
    "Favourites" section at the very top, shown only when non-empty. The
    order is Favourites, then Recent, then all maps (decision 15).
  - **Map bar:** a star next to the map-name chip under the tabs, not a
    sixth tab, because the tab row is full at phone width (FT-13).
  - The star's accessible name says what it does ("Add to favourites" /
    "Remove from favourites"), with `aria-pressed`, in all three
    languages. It needs a clear filled or empty state and a visible focus
    ring.
- **Test:** store unit tests (toggle, order, unknown ids), and a
  browser component test for the star button (toggles, persists, and its
  label changes).
- **Verify:** star a map on the home page and it appears under
  Favourites; unstar it from the map bar and it disappears; reload the
  page and the state persists. Check at phone width in DE/IT, in the
  desktop app and on the emulator.
- **DoD:**
  - favourites work from both places on web, desktop and Android;
  - tests pass;
  - ONBOARDING.md mentions `mapPrefs`;
  - gates green.

### FT-17 — Set Favourites and Recent apart on the home page · Low · deps: FT-16

- **Why (product owner, 2026-09-14, while trying FT-11):** Favourites and
  Recent "look too much like the rest of the maps"; they read as two more
  country groups.
- **Do:** put both in one panel with its own background and border, give
  their headings an icon and the accent colour, make their cards white,
  and start the country list with an "All maps" heading (EN/DE/IT). The
  panel and that heading show only when there's a favourite or a recent
  map. Countries become `h3` under "All maps".
- **DoD:** checked at 1280px and 400px, EN and DE; gates green.

### FT-18 — Drags that start on a name label move the map · Low · deps: FT-12

- **Why (found testing v0.5.0-beta.1 on the Android emulator,
  2026-09-14):** a drag that starts on a label doesn't pan the map, and
  magnifies the label instead. MapLibre ignores gestures that begin on a
  popup, and FT-03's listener toggled on touch-down. On a phone the
  overview's names cover much of the map, so the tutorial's step 2 ("drag
  with one finger") often seemed to do nothing. The same happened with a
  mouse drag on desktop.
- **Do:** labels take no pointer input (`pointer-events: none`), so every
  gesture reaches the map. `labelMagnify.ts` finds the label under the
  pointer by position: mouse hover sets `.is-hovered` (replacing the
  `:hover` rule, which can't fire any more), and a touch or pen tap (down
  and up within 10px) toggles `.is-magnified`. A drag never magnifies.
- **DoD:** tests for tap, drag, hover, one-at-a-time and pointer-events;
  a drag from a label pans the map with mouse and touch in a real
  browser; tutorial walk still green; checked on the emulator in the
  beta; gates green.

### FT-09 — Tutorial script and interaction spec · Low · deps: FT-13, FT-14, FT-16

- **Why:** FEATURE_BACKLOG.md §3 says this item needs a design pass
  before building. Decisions 5–8 settled the big questions; what's left
  is the exact script.
- **Do:** write `docs/TUTORIAL.md` with a table of steps: intro, the ten
  steps below, then an outro. For each step, record:
  - the route it happens on;
  - the real element it highlights, by the `data-tutorial="…"` anchor
    it will add;
  - what advances it: a real action (route change, correct drop, wrong
    drop, clicking Tour, a zoom/pan gesture for the new step below), or
    "Next" for the explanation-only steps (step 9, spaced repetition);
  - the English copy.

  **Added 2026-09-13, after the original nine-step request:** a new step
  teaching map navigation — zoom and pan — since players may not
  realize the map supports either, and it's needed before the rest of
  the tutorial makes sense on a dense map. Insert it right after "select
  a map" and before "switch to Overview," so the player can navigate
  before being shown around. Renumbers the original steps 2–9 to 3–10;
  nothing else about them changes. Cover, on `italy-regions`:
  - scroll-wheel / trackpad-pinch zoom, and the `+`/`−`
    `NavigationControl` buttons (top-right on every map view);
  - click-and-drag pan;
  - touch pinch-to-zoom and drag-to-pan on Android (the map already
    supports both — this step only needs to point them out);
  - advance the step on any real zoom or pan action (a MapLibre `zoom`
    or `move` event), not just a button click, so a player who
    discovers the gesture on their own still progresses.

  **Adjust for v0.4.0 (added 2026-09-14):** after FT-13, selecting a map
  already lands on the overview, so the "switch to Overview" step becomes
  "here's the overview you land on", or merges into step 1. Explore now
  has its own tab, so decide whether the tour of the app shows it. On
  Android, the back button goes up a level (FT-14), which the "return to
  Quiz" / "back to Overview" steps can use. Settle this with the product
  owner in the copy review.

  **Also since 2026-09-14:** the home page now has Favourites and Recent
  sections (FT-15, FT-16). Decide in the copy review whether the tour of
  the app points out the star.

  It also covers:
  - Skip, Back and Replay behaviour;
  - what happens if the player goes off-script (navigates elsewhere):
    pause and offer "Resume tutorial" or "End";
  - phone-width layout, and touch on Android, where dragging is
    pointer-based already;
  - what the sandbox means for step 9 (was step 7). Returning to the
    quiz shows the regions solved during the tutorial, from the
    in-memory store (FT-10), not the player's real progress.
- 🧑 **Product owner:** reviews the copy and flow at the merge request.
  It's product text, so the product owner has the final word.
- **DoD:** TUTORIAL.md merged, with eleven steps including the new
  zoom/pan one and the Explore step (decision 17); the German and Italian copy is drafted in it for FT-11
  to paste in.

### FT-10 — Sandboxed progress store for the tutorial · Medium · deps: FT-09

> **Narrowed at FT-09's review (decision 18):** only `italy-regions` is
> sandboxed; every other map reads and writes the real store. The details
> are in [TUTORIAL.md](TUTORIAL.md), "The sandbox".

- **Do:**
  - Add `createInMemoryProgressRepository()`, implementing the full
    `ProgressRepository` interface (`progressRepository.ts`), including
    `clearMap` / `clearAll`.
  - While a tutorial is active, `createProgressRepository()`, the single
    factory every view calls, returns a repository that keeps
    `italy-regions` in one shared in-memory instance and passes every other
    map through to the real one. That covers localStorage, Tauri SQLite and
    Capacitor alike.
  - The instance survives client-side navigation between the map, the
    overview and the quiz, which is what step 9 (step 7 in the original
    request, see TUTORIAL.md) needs. It is discarded when the
    tutorial ends or is skipped.
  - QuizView's same-day carry-forward (`alreadySolvedIds`) then shows the
    solved regions with no extra code.
  - The same tutorial flag makes `recordVisit` in `mapPrefs.svelte.ts` a
    no-op for `italy-regions` (FT-15, decision 16), so the tutorial's map
    never lands in Recent. Other maps are still recorded.
- **Tests:**
  - a full tutorial-mode quiz session on `italy-regions` leaves
    `localStorage` byte-identical, including the Recent list (a snapshot
    of every key before and after);
  - a quiz on another map during the tutorial saves normally;
  - solved ids carry across a QuizView remount while tutorial mode is on;
  - ending the tutorial restores the real repository.
- **DoD:** tests as above; DECISIONS.md entry "Tutorial sandbox" (the
  precedent is Practice mode's "never writes SRS state"); gates green.

### FT-11 — Tutorial engine, overlay and steps · High · deps: FT-03, FT-10

- **Do:**
  - **`tutorial.svelte.ts`:** holds `active`, `stepIndex`, and
    start/next/back/skip/finish. Steps come from TUTORIAL.md's table.
  - **`TutorialOverlay.svelte`:** mounted once in `+layout.svelte` so it
    survives route changes. It spotlights the current anchor (read from
    `getBoundingClientRect`, following scroll, resize and the map's own
    re-layouts), shows a tooltip card with the step copy and Skip, and
    handles keyboard (Esc skips, focus moves to the card).
  - **Anchors:** `data-tutorial` attributes on the real elements:
    - the Italy — Regions card on the home page;
    - MapNav's Overview, Explore, Quiz and Tour buttons;
    - the quiz tray, the map canvas, and the `NavigationControl` `+`/`−`
      buttons (for the zoom/pan step).
  - **Advancing:** on real events. Route changes come through SvelteKit's
    `afterNavigate`. Correct and wrong drops come from a small hook
    QuizView calls on each resolved drop; it does nothing when no
    tutorial is running. The Explore step advances on a similar hook
    from MapView's region click (TUTORIAL.md, step 4). The zoom/pan step advances on the map's own
    `zoom` or `move` event (a control click, scroll/pinch, or a drag all
    fire one of these — no need to distinguish which). For the steps
    that demonstrate a drop, pick target regions that are large in
    `italy-regions`, such as Sicilia or Sardegna, so the drop lands
    reliably.
  - **Tutorial button:** "near the top of the app" means the home page
    header and `MapNav`. All copy in EN/DE/IT from TUTORIAL.md; the
    `TranslationKey` union makes a missing string a compile error.
- **Tests:** browser component tests for step advancement, skip/back and
  anchor-missing handling. The store's transitions are unit-tested.
- **Verify:** a full real run in the browser, in English, with
  screenshots of every step.
- **DoD:**
  - all 11 steps (the nine originally requested, plus the zoom/pan step
    added 2026-09-13 and the Explore step added at FT-09's review) work on `italy-regions` through real clicks, drags,
    scroll/pinch and pan;
  - no real progress is written (FT-10's test, plus a manual check of
    localStorage);
  - skip and replay work;
  - gates green.

### FT-12 — First-visit nudge, three-language walkthrough, docs · Medium · deps: FT-11

- **Do:**
  - Add a dismissible "New here? Take the tutorial" nudge on the home
    page, shown until dismissed or until the tutorial has been started
    once. It is persisted in localStorage (`geoclick:tutorial-seen:v1`,
    with the same guard as the other settings) and never auto-starts
    (decision 6).
  - Walk the whole tutorial in **German and Italian** as well as English,
    fixing overflow and wrapping. German copy runs longest.
  - Walk it at phone width, including magnifying a label by tap (FT-03).
- **DoD:**
  - screenshots of every step in all three languages (step 2 [zoom/pan],
    step 6 [drag] and step 9 [return to quiz] at minimum at phone width);
  - ONBOARDING.md explains how to add or edit a tutorial step;
  - ARCHITECTURE.md mentions the overlay and the sandbox;
  - gates green.

**→ Release `v0.5.0`.** Web plus freshly built installers, per
RELEASES.md.

---

## Deliberately out of scope

Each of these was considered and left out, not forgotten.

- **Code-signing the Windows installers.** A certificate costs real money
  every year. Without one, SmartScreen shows an "unknown publisher"
  warning, which the releases README (FT-08) explains. Revisit at the 1.0
  public launch.
- **macOS and Linux installers.** macOS can't be built on this Windows
  machine. Linux (`.deb` / `.AppImage`) could be built via WSL if
  there's demand.
- **CI builds** (decision 2), **auto-update**, and an **app-store
  listing**. The last belongs to the 1.0 milestone (DECISIONS.md, "SSO
  deferred").
- **Scaling the whole UI's text** (decision 4 limits it to names), and a
  **tutorial on towns maps** (decision 7).
- **Making the source repo public** (decision 1).

---

## Progress ledger

Update this table as tasks merge. Commit hashes are the merge commits.

| Task | State | Merge | Release | Notes |
|---|---|---|---|---|
| FT-01 | **released** | `6e05495` | v0.3.0 | README 'Play it' link under the intro |
| FT-02 | **released** | `fe3a809` | v0.3.0 | labels 11px → 0.8125rem (13px, follows browser font-size setting) + hover to magnify (20px, above neighbours); plan corrected: page zoom already scaled px |
| FT-03 | **released** | `2f7e7b0` | v0.3.0 | tap to magnify on touch (redefined at FT-02 review; was a Normal/Large switch); verified with simulated touch, not yet on a physical device |
| FT-04 | **released** | `2d3205e` | v0.3.0 | 🧑 picked A (pin) from 3 drafts; favicon switches too (FT-05) |
| FT-05 | **released** | `bf49643` | v0.3.0 | one generator script for all icons; checked in built exe + installer, emulator (drawer, launch screen) and favicon; Start menu/taskbar not seen (same .ico) |
| FT-06 | **released** | `6de2d98` | v0.3.0 | signing setup verified with throwaway keys (unsigned without, signed via env or properties); 🧑 real keystore pending, needed before FT-07's dry run |
| FT-07 | **released** | `8e6120e` | v0.3.0 | package-release.mjs dry run: .msi 17.0 MB, -setup.exe 15.8 MB, APK 24.5 MB + SHA256SUMS (throwaway key, output deleted); Android versionCode now tracks the version (1 → 200) |
| FT-08 | **released** | `e5aa02d` | v0.3.0 | 🧑 public repo created (diegoami/geoclick-releases, README only); web-only download link EN/DE/IT; publish script dry-runs unless --confirm; first publish = v0.3.0 |
| FT-13 | **released** | `d74ebb4` | v0.4.0 | maps open on the overview; Explore tab; tab row clear of the zoom control (360-1024px, EN/DE/IT); native shells checked with FT-14 |
| FT-14 | **released** | `88f7950` | v0.4.0 | back goes up a level (emulator: quiz/tour/explore → overview → list → exit); tried by the product owner on their phone via v0.4.0-alpha.1 |
| FT-15 | **merged** | `608937a` | v0.5.0 | Recent section (5 newest, any map view counts, device-local); browser-checked at 1280/400px; desktop (CDP) + Android (emulator) checked in v0.5.0-alpha.1 |
| FT-16 | **merged** | `a006833` | v0.5.0 | star on home cards + map bar, Favourites section first; browser-checked incl. 400px DE/IT; desktop (CDP) + Android (emulator) checked in v0.5.0-alpha.1. To check with TalkBack on a phone: the emulator's uiautomator dump showed the star with no name or pressed state (the language pills lose their state the same way, so likely the dump) |
| FT-17 | **merged** | `6429331` | v0.5.0 | Favourites + Recent in one panel, "All maps" heading before the countries; asked for by the product owner while trying FT-11; checked 1280/400px EN/DE |
| FT-18 | **merged** | `a2eae05` | v0.5.0 | labels take no pointer input; magnify by position (hover, real tap); drag from a label pans with mouse (163px) and touch (131px) |
| FT-09 | **merged** | `cd47cc6` | v0.5.0 | docs/TUTORIAL.md: 11 steps + intro/outro, EN/DE/IT copy; 🧑 copy approved 2026-09-14 (decisions 17-19: Explore step, italy-regions-only sandbox, star tip, Finish stays on tour) |
| FT-10 | **merged** | `1741112` | v0.5.0 | italy-regions in memory during the tutorial, other maps live (decision 18); no localStorage writes in a tutorial quiz (tested); normal play smoke-checked in the browser |
| FT-11 | **merged** | `fa00091` | v0.5.0 | Tutorial button, overlay, 11 steps on real actions; pause/resume, Back, Skip/Esc, Replay; full browser runs 1280 EN, 400 EN/DE; tried by the product owner in the browser. Also: quiz fits the map above the tray (Sicily was hidden) |
| FT-12 | **merged** | `89fb987` | v0.5.0 | "New here?" nudge (EN/DE/IT); full walks EN/DE/IT at 360 + 1280px, tap-to-magnify on phones; step 10 shortened to 4 lines; ONBOARDING step guide |

| Release | State | Tag | Date |
|---|---|---|---|
| `v0.3.0` | **cut** | `v0.3.0` → `abafcbb` | 2026-09-13 — installers published to diegoami/geoclick-releases (APK signed with the release key) |
| `v0.3.1` | **cut** (hotfix) | `v0.3.1` → `fd04733` | 2026-09-13 — desktop app opened maps empty in v0.3.0 (Tauri ignores Range requests; tiles now loaded whole). Installers published; v0.3.0 notes carry a warning |
| `v0.4.0-alpha.1` | **pre-release** (alpha) | `v0.4.0-alpha.1` → `a8b1d49` (FT-14 + main, never merged) | 2026-09-14 — setup.exe + APK on geoclick-releases as a GitHub pre-release; for the product owner's phone test of FT-13/FT-14 |
| `v0.4.0` | **cut** | `v0.4.0` → `441f57b` | 2026-09-14 — stable, latest on geoclick-releases (setup.exe, .msi, APK); same app code as alpha.1, which the product owner tried on Windows and Android |
| `v0.5.0-alpha.1` | **pre-release** (alpha) | `v0.5.0-alpha.1` → `b9793c0` (version bump on main `ea84ab5`, never merged) | 2026-09-14 — setup.exe + APK on geoclick-releases as a GitHub pre-release; FT-15 + FT-16 for the product owner to try. Checked: desktop over CDP, APK updating 0.4.0 on the emulator (40099 → 50001) |
| `v0.5.0-beta.1` | **built, not published** | `v0.5.0-beta.1` → `e703d2a` | 2026-09-14 — setup.exe + APK built and tested (desktop over CDP, emulator update 50001 → 50051, whole tutorial by touch); held back because a drag starting on a name label didn't pan the map (FT-18). Superseded by beta.2 |
| `v0.5.0` | not cut | — | — |
