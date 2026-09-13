# Geoclick — Feature programme (planned 2026-09-13)

This programme turns the four requests in
[FEATURE_BACKLOG.md](FEATURE_BACKLOG.md) into twelve ordered tasks and two
releases. It is separate from the [remediation
programme](REMEDIATION_PLAN.md), which closed with `v0.2.0`: that one
fixed what a code review found, while this one adds things players will
notice.

**Status: planned, not started.** Nothing below is implemented yet.

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
| 4 | Text size: what scales, and how many sizes? | **Names only: map labels and quiz slips. Two sizes, Normal and Large.** |
| 5 | Does the tutorial save real progress? | **No, it's sandboxed.** A real quiz runs, but progress lives in memory for the tutorial only, so real review data is never written. |
| 6 | How does the tutorial start? | **From a Tutorial button, plus a dismissible first-visit nudge** on the home page. It never starts by itself. |
| 7 | Which map does the tutorial use? | **Always Italy — Regions.** |
| 8 | "Preview" in the tutorial request means? | **The existing Overview view.** |
| 9 | Merging | **Ask before every merge.** The remediation loop's automerge was approved for that loop only, and CLAUDE.md's default applies here. The product owner tries each branch before it lands. |

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
7. **Releases:** follow [RELEASES.md](RELEASES.md)'s checklist, including
   asking before tagging and not watching the deploy. FT-07 adds a "build
   and publish the installers" section to it, used from `v0.3.0` onwards.

Versioning follows RELEASES.md: a batch that adds features bumps the minor
version. `1.0.0` stays reserved for the public launch.

| Release | Tasks | Theme |
|---|---|---|
| `v0.3.0` | FT-01 to FT-08 | **Readable and installable.** Map names scale, the apps get a real logo, and anyone can download the Windows and Android installers. |
| `v0.4.0` | FT-09 to FT-12 | **Tutorial.** An interactive walkthrough in English, German and Italian. |

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
  `app/src/app.css` are a fixed `11px`, so they ignore browser zoom and OS
  text-size settings. Every other piece of text in the app scales.
- **Do:** switch `font-size` in `app.css`'s shared popup rule to a relative
  unit, bumped from 11px. Aim for about `0.8125rem` (13px at default
  settings), and tune it by looking. Keep one rule for both classes (the
  GC-022 consolidation), and keep the weights (900 explore/tour, 600
  solved).
- **Verify:** check overview crowding on `italy-provinces` (110 labels),
  `germany-states` (long German names) and a towns map. Also check that
  browser zoom 150% now enlarges the labels; before this change it
  doesn't.
- **DoD:**
  - no `px` font size remains on the popups;
  - labels scale with browser zoom;
  - before/after screenshots of the three maps;
  - DECISIONS.md's "Map colors" / popup notes updated if they quote 11px;
  - gates green.

### FT-03 — Text-size control: Normal / Large · Medium · deps: FT-02

- **Why:** FEATURE_BACKLOG.md §4, fix 2 (decision 4: names only, two
  sizes).
- **Do:**
  - Add one custom property on `:root`, `--geoclick-text-scale`: `1` for
    Normal, `1.25` for Large. Tune Large by looking.
  - Multiply it into the popup `font-size` in `app.css` and into
    QuizView's `.slip` `font-size` (currently `0.9rem`). Nothing else
    scales.
  - Put the setting in a small `textSize.svelte.ts`, modelled on
    `i18n.svelte.ts`: `$state`, key `geoclick:text-size:v1` in
    localStorage, with the same prerender/`typeof localStorage` guard.
  - Apply the setting from `+layout.svelte`, the same way `<html lang>` is
    applied.
  - UI: a two-pill `A` / `A+` switch styled like `LanguageSwitcher` and
    placed next to it, on the home page and in `MapNav`. Pill labels and
    aria-labels live in `i18n.svelte.ts` in all three languages; the
    union type makes a missing one a compile error.
  - **Gotcha:** QuizView caches the tray's measured slip height
    (`measureTraySizing` stores `trayHeightPx`). Switching size mid-quiz
    must re-measure, or the tray clips or leaves gaps.
- **Test:** a browser component test for the switch, like
  `LanguageSwitcher.svelte.test.ts`: it toggles, persists, and sets the
  property.
- **Verify:**
  - at Large, long German labels on `germany-states` and dense
    `italy-provinces` in DE/EN/IT;
  - the quiz tray at both sizes, switched mid-quiz;
  - a point map;
  - at phone width (about 400 px).
- **DoD:**
  - the two sizes persist across reloads;
  - only labels and slips change;
  - the tray re-measures;
  - screenshots at both sizes;
  - DECISIONS.md entry "Text size";
  - ONBOARDING.md mentions the property;
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

### FT-09 — Tutorial script and interaction spec · Low · deps: none (start after v0.3.0)

- **Why:** FEATURE_BACKLOG.md §3 says this item needs a design pass
  before building. Decisions 5–8 settled the big questions; what's left
  is the exact script.
- **Do:** write `docs/TUTORIAL.md` with a table of steps: intro, the nine
  requested steps, then an outro. For each step, record:
  - the route it happens on;
  - the real element it highlights, by the `data-tutorial="…"` anchor
    it will add;
  - what advances it: a real action (route change, correct drop, wrong
    drop, clicking Tour), or "Next" for the explanation-only steps
    (step 8, spaced repetition);
  - the English copy.

  It also covers:
  - Skip, Back and Replay behaviour;
  - what happens if the player goes off-script (navigates elsewhere):
    pause and offer "Resume tutorial" or "End";
  - phone-width layout, and touch on Android, where dragging is
    pointer-based already;
  - what the sandbox means for step 7. Returning to the quiz shows the
    regions solved during the tutorial, from the in-memory store (FT-10),
    not the player's real progress.
- 🧑 **Product owner:** reviews the copy and flow at the merge request.
  It's product text, so the product owner has the final word.
- **DoD:** TUTORIAL.md merged; the German and Italian copy is drafted in
  it for FT-11 to paste in.

### FT-10 — Sandboxed progress store for the tutorial · Medium · deps: FT-09

- **Do:**
  - Add `createInMemoryProgressRepository()`, implementing the full
    `ProgressRepository` interface (`progressRepository.ts`), including
    `clearMap` / `clearAll`.
  - While a tutorial is active, `createProgressRepository()`, the single
    factory every view calls, returns one shared in-memory instance. That
    covers localStorage, Tauri SQLite and Capacitor alike.
  - The instance survives client-side navigation between the map, the
    overview and the quiz, which is what step 7 needs. It is discarded
    when the tutorial ends or is skipped.
  - QuizView's same-day carry-forward (`alreadySolvedIds`) then shows the
    solved regions with no extra code.
- **Tests:**
  - a full tutorial-mode quiz session leaves `localStorage` byte-identical
    (a snapshot of every key before and after);
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
    - MapNav's Overview, Quiz and Tour buttons;
    - the quiz tray and the map canvas.
  - **Advancing:** on real events. Route changes come through SvelteKit's
    `afterNavigate`. Correct and wrong drops come from a small hook
    QuizView calls on each resolved drop; it does nothing when no
    tutorial is running. For the steps that demonstrate a drop, pick
    target regions that are large in `italy-regions`, such as Sicilia or
    Sardegna, so the drop lands reliably.
  - **Tutorial button:** "near the top of the app" means the home page
    header and `MapNav`. All copy in EN/DE/IT from TUTORIAL.md; the
    `TranslationKey` union makes a missing string a compile error.
- **Tests:** browser component tests for step advancement, skip/back and
  anchor-missing handling. The store's transitions are unit-tested.
- **Verify:** a full real run in the browser, in English, with
  screenshots of every step.
- **DoD:**
  - all 9 requested steps work on `italy-regions` through real clicks and
    drags;
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
  - Walk it at phone width and at Large text size (FT-03).
- **DoD:**
  - screenshots of every step in all three languages (step 4 and step 7
    at minimum at phone width);
  - ONBOARDING.md explains how to add or edit a tutorial step;
  - ARCHITECTURE.md mentions the overlay and the sandbox;
  - gates green.

**→ Release `v0.4.0`.** Web plus freshly built installers, per
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
| FT-01 | todo | — | v0.3.0 | |
| FT-02 | todo | — | v0.3.0 | |
| FT-03 | todo | — | v0.3.0 | |
| FT-04 | todo | — | v0.3.0 | 🧑 logo pick |
| FT-05 | todo | — | v0.3.0 | |
| FT-06 | todo | — | v0.3.0 | 🧑 keystore |
| FT-07 | todo | — | v0.3.0 | |
| FT-08 | todo | — | v0.3.0 | 🧑 public repo, publish |
| FT-09 | todo | — | v0.4.0 | 🧑 copy review |
| FT-10 | todo | — | v0.4.0 | |
| FT-11 | todo | — | v0.4.0 | |
| FT-12 | todo | — | v0.4.0 | |

| Release | State | Tag | Date |
|---|---|---|---|
| `v0.3.0` | not cut | — | — |
| `v0.4.0` | not cut | — | — |
