# Onboarding — Geoclick

Welcome. This is a living doc for a new (junior) developer picking up
small tasks on this project. It's meant to get you from "cloned the repo"
to "shipped a small fix" without having to reconstruct context that
already exists elsewhere — read this first, then the doc it points you to
for whatever you're touching.

Keep this file updated as the project changes: if something here was
wrong or missing when you needed it, fix it in the same PR rather than
leaving it stale for the next person.

## Read these first, in order

1. **This file** — orientation and how to work day to day.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — what the system is made of and why
   (stack choices, domain model, hosting). Read the sections relevant to
   what you're touching, not necessarily cover to cover.
3. [ROADMAP.md](ROADMAP.md) — what's been built, what's in progress, and
   what's next. Check the **Status** section at the top first to see where
   the project is right now.
4. [CLAUDE.md](CLAUDE.md) — working conventions. Written for an AI
   assistant collaborating on this repo, but every rule in it applies to
   any contributor, human or not. Deliberately short and rule-only — see
   **AI assistant scope** below for why, and where the reasoning went.
5. [DECISIONS.md](DECISIONS.md) — *why* the product works the way it
   does, as a scannable list rather than scattered through iteration
   write-ups. Worth a skim before changing behavior that looks like it
   might have been a deliberate choice rather than an oversight — several
   entries exist specifically because something non-obvious got built,
   reconsidered, and corrected once already.
6. [MAPS.md](MAPS.md) — only if you're touching map data. The exact
   command behind every map currently shipping (so you can regenerate
   one, not just guess), and what's planned next.

## What this project is

A geography-learning browser game: pick a map (e.g. Italian regions),
either take a guided "tour" (regions revealed one at a time with context)
or a drag-and-drop quiz (match name slips to the correct region on the
map). Portfolio project, not commercial. See ARCHITECTURE.md's intro for
the full pitch and how it's meant to differ from existing tools like
Seterra.

## Stack, in one paragraph

SvelteKit (Svelte 5, runes — `$state`, `$derived`, `$props`, not the old
`export let`/reactive-statement style) for the app shell, MapLibre GL JS +
PMTiles for the map rendering, an npm workspaces monorepo for the app and
a couple of small pure-logic packages, deployed to Netlify as a static
site. No backend yet — everything is local-first. Full detail and the
*why* behind each choice is in ARCHITECTURE.md.

## Repo layout

```
app/                    SvelteKit app (the actual game UI)
  src/lib/
    MapView.svelte       Explore tab: click a region to see its name (/map/<id>)
    OverviewView.svelte  Overview tab: every name labelled; a map opens here
    MapNav.svelte        the map bar shared by all four map views
    TourView.svelte      guided tour mode
    QuizView.svelte      drag-and-drop quiz mode (the most complex view)
    geoclickMap.ts        shared map-loading helpers used by all three views
    mapDefinition.ts, tour.ts   data-shape types + tour logic
  src/routes/            SvelteKit file-based routing
  static/maps -> ../../data/maps       symlink, see "Gotchas" below
  static/styles -> ../../data/styles   symlink, same gotcha
  scripts/copy-maplibre-worker.mjs     postbuild step, see "Gotchas"

packages/
  quiz-engine/            pure quiz session logic (no DOM/Svelte) - the
                           part most worth reading to understand the quiz
                           domain model without wading through UI code
  srs/                    pure SM-2 scheduler (rate/isDue) - no DOM,
                           storage, or quiz-UI dependency, same style as
                           quiz-engine

data/
  maps/<map-id>/          generated per-map assets: map.json, tiles.pmtiles,
                           tour.json, terrain.pmtiles, facts.json -
                           committed to git, not hand-edited
  styles/base.json         shared MapLibre style, used by all maps
  source/                  raw Natural Earth downloads
  scripts/build-map.ts     the pipeline that turns source data into a map/
  scripts/build-terrain.ts  the Terrain layer's own tileset (FT-33), for a
                             map that already exists
  scripts/build-facts.ts    the fact box's derived data (FT-34)
  facts/<country>.json      hand-written name-facts (FT-36) - the only
                             authored content in the repo

desktop/                  Tauri wrapper (Iteration 7) - wraps app/build
                           unmodified in a native window, no separate UI code
  src-tauri/tauri.conf.json   window config, dev/build commands
  src-tauri/src/lib.rs         registers the SQLite plugin + its migrations
                                (the schema's single source of truth)
  src-tauri/target/            gitignored, Cargo build output

mobile/                   Capacitor wrapper (Iteration 8+, in progress) -
                           same "wrap app/build unmodified" strategy as desktop/
  capacitor.config.ts        webDir points at ../app/build
  android/                    native project, generated by `npx cap add
                               android` - committed like src-tauri/ is, not
                               regenerated like node_modules (see its own
                               .gitignore for what's excluded: build output,
                               local.properties, the copied web assets)
```

If you're fixing a UI bug in the quiz, you'll spend most of your time in
`app/src/lib/QuizView.svelte` and possibly `packages/quiz-engine/src/index.ts`
(the pure session state machine it calls into). If you're adding a new
demo map, you'll spend it in `data/scripts/build-map.ts` and
`data/maps/` — read [MAPS.md](MAPS.md) first, it has the exact commands
and the known snags already found. ARCHITECTURE.md has a per-area
breakdown if you need more.

**A gotcha worth knowing before you touch either builder** (FT-33): a map
now has **two** tilesets. `tiles.pmtiles` is the game; `terrain.pmtiles` is
the optional sea/rivers/named-terrain layer behind the map bar's Terrain
button, and it is a separate file precisely so the 63 existing
`tiles.pmtiles` never had to be rebuilt. If you add a map, both builders
write both files and you commit both. If you change something about the
Terrain layer alone, use `build-terrain.ts --all --force` and leave
`tiles.pmtiles` alone — MAPS.md's rule against committing a rebuilt tileset
that says nothing still holds.

## Getting it running locally

```bash
git clone git@github.com:diegoami/Geoclick2027.git
cd Geoclick2027
npm install
npm run setup-hooks            # once per clone - see "The pre-push hook" below
npx playwright install chromium  # once per machine - component tests run in it
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`). Pick a
map from the home page, try both Tour and Quiz modes.

Useful root-level scripts (run from the repo root, they fan out across
the npm workspace):

```bash
npm run dev      # start the app locally
npm run build    # production build (all workspaces)
npm test         # run unit tests (quiz-engine, srs, app)
npm run check    # svelte-check / type-check, plus tsc on data/scripts (data/tsconfig.json)
npm run lint     # prettier + eslint on the app and on data/scripts
npm run format   # prettier --write on both
npm run gates    # all four quality gates in order, stops at the first failure
npm run gates -- --quiet   # same, but only PASS/FAIL lines (and the tail of a failure)
```

### The pre-push hook

`npm run setup-hooks` (once per clone) sets `core.hooksPath` to the
committed `.githooks/` directory. Its `pre-push` runs the four gates —
`check`, `test`, `lint`, `build`, in that order — and **rejects the push
if any gate fails**. This is the project's only automated gate: there is
no hosted CI, and before this hook existed `npm run lint` failed silently
through several merges (GC-001, see "The fifth variant" in the gotchas
below). Expect ~15-20s per push.

- Pushes that only delete branches (`git push origin --delete <branch>`)
  skip the gates — they carry no code.
- To bypass it for one push, `git push --no-verify`. Use that for a
  genuine emergency or a WIP branch you are parking, not to dodge a red
  gate on work you are about to merge.
- It deliberately does **not** run the Tauri or Android builds — a
  multi-minute pre-push is one that gets bypassed every time.
- It runs them with `--quiet`, so a clean push prints four `PASS` lines
  instead of ~100 KB of passing test names. A gate that fails prints the
  tail of *its* output, which is the part you need. Run
  `npm run gates` by hand if you want to watch the full stream.
- `node scripts/task.mjs gates --json` gives the same verdict as JSON
  (per-gate pass/fail, exit code, timing, tail of output on failure).

### Two kinds of test

`app/vite.config.ts` defines two Vitest projects, and `npm test` runs both
(the app's output tags every test `|server|` or `|client (chromium)|`):

- **`server`** — plain `*.test.ts`, Node, no DOM. Pure logic.
- **`client`** — `*.svelte.test.ts`, mounted with `vitest-browser-svelte`
  in a real headless Chromium driven by Playwright. Component tests go
  here. Needs `npx playwright install chromium` once per machine; without
  it `npm test` fails, and so does the pre-push hook. Real browser rather
  than jsdom on purpose: the app is MapLibre + WebGL + pointer events,
  none of which jsdom implements, so jsdom would cap out at trivial
  components. `LanguageSwitcher.svelte.test.ts` is the canary. A plain-TS
  test that needs a real DOM but isn't a component is named
  `*.browser.test.ts` and runs here too (e.g. `labelMagnify.browser.test.ts`).
  Gotcha when faking touch from a script or test: `setPointerCapture` throws
  for a synthetic touch pointer that isn't really down, so a quiz slip drag
  can only be scripted with mouse-type events (pointerId 1).

Before GC-003 the `client` project had been deleted from the config, so a
`.svelte.test.ts` file silently never ran. If you add one and it doesn't
show up in the output as `|client (chromium)|`, check the config first.

## Running the desktop build (Iteration 7)

```bash
npm run dev --workspace=app    # start the Vite dev server first (port 5173)
cd desktop && npm run dev      # in a second terminal: opens the app in a native window
```

`cd desktop && npm run build` produces real installers (`.deb`/`.rpm`/
`.AppImage` on Linux) under `desktop/src-tauri/target/release/bundle/` -
the actual double-click-to-install artifact. `app/build` is bundled in as-is
via `beforeBuildCommand`, so there's no separate desktop-only frontend to
maintain.

Persistence swaps automatically: `app/src/lib/progressRepository.ts`'s
`createProgressRepository()` detects Tauri (`isTauri()` from
`@tauri-apps/api/core`) and picks the SQLite-backed repository
(`sqliteProgressRepository.ts`) instead of the browser's `localStorage`
one - same `ProgressRepository` interface either way, so nothing in
`QuizView.svelte`/the home page needs to know which backend is active.

**WSL2/WSLg gotcha, cost real time to track down:** the built binary
exits immediately with no error unless `WEBKIT_DISABLE_DMABUF_RENDERER=1`
is set - webkit2gtk's DMA-BUF renderer doesn't work under WSLg's GPU
passthrough. Do **not** also set `LIBGL_ALWAYS_SOFTWARE=1` to "fix"
rendering further - that disables WSLg's real `d3d12` Mesa driver
(confirmed present at `/usr/lib/x86_64-linux-gnu/dri/d3d12_dri.so`) and
produces a window that opens but never paints anything (MapLibre's
WebGL context silently gets nothing to render into). The working
combination, confirmed by actually launching the built binary:
`GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 ./target/release/app`.
Real hardware (or a non-WSL Linux desktop) shouldn't need any of this.

**Debugging the built Windows app (v0.3.1).** A release build has no
devtools, and `tauri dev` serves the app from Vite, so bugs in the
bundled app can't be seen that way. Instead, launch the built exe with
WebView2's remote debugging on, and attach Chrome or Playwright:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
& desktop\src-tauri\target\release\app.exe
# then open http://127.0.0.1:9333/json/list, or
# chromium.connectOverCDP('http://127.0.0.1:9333') from a Playwright script
```

That's how v0.3.0's empty desktop maps were found: the console showed
pmtiles failing. **The gotcha:** Tauri's `http://tauri.localhost`
protocol ignores HTTP Range requests. It answers with a plain 200 and no
Content-Length, so pmtiles' range reads fail. `geoclickMap.ts` loads each
map's tile archive whole in both native shells (`isNativeShell()`) for
exactly that reason. Don't "simplify" that back to range requests without
re-testing the built desktop app this way.

## App icons and splash screens (FT-05)

Every icon comes from one file, `design/logo/geoclick-logo.svg`. Don't
edit the generated PNGs by hand. After changing the SVG, run:

```bash
node design/logo/generate-icons.mjs
```

It regenerates:
- the desktop set in `desktop/src-tauri/icons/`, via `tauri icon`;
- Android's launcher icons: the adaptive foreground and background layers,
  plus legacy square and round icons, at every density;
- Android's splash screens, and the web favicon.

It renders with the Playwright Chromium the tests already use, so there's
no image tool to install. Two details are easy to undo by accident:
- **The Android adaptive icon is two layers:** just the pin in the
  foreground, the green with the faint map shapes in the background.
  Launchers animate into the icon's outer edge, so a texture in the
  foreground would show where it stops.
- **Android 12+ ignores the splash PNGs** and draws its own launch screen
  from the theme. `values/styles.xml` points it at the logo green and the
  pin-only foreground.

## Running the Android build (Iteration 8+, in progress)

Needs [Android Studio](https://developer.android.com/studio) (bundles the
JDK Gradle needs) with an AVD set up, or a real device with USB debugging
on. Nothing here runs without it - there's no CLI-only path, unlike
`desktop`'s `tauri dev`.

**Gradle JDK gotcha:** a fresh Android Studio install's bundled JDK can be
newer than this project's Gradle wrapper (8.14.3) supports - hit directly
as `BUG! ... Unsupported class file major version 69` (JDK 25; Gradle
8.14.3 only supports up to 24, and 9.1+ would be needed for 25, which
would also force an Android Gradle Plugin bump not worth chasing for this
POC). Fix: in Android Studio, `Settings → Build, Execution, Deployment →
Build Tools → Gradle → Gradle JDK`, pick a JDK ≤ 24 from the dropdown (a
"Download JDK..." option is usually there if none is already listed) -
Android Studio manages this separately from whatever JDK it uses to run
itself.

```bash
npm run build --workspace=app   # build app/build first, the web assets the app wraps
cd mobile
npm run sync                    # copies app/build + native plugins into android/
npm run open                    # opens the project in Android Studio - press Run from there
```

**Headless debug-APK build, no Android Studio GUI needed** (useful when
you just want an installable APK, e.g. to `adb install` onto a device):
the same JDK gotcha above applies to a direct `gradlew` invocation too,
and the system `java`/`JAVA_HOME` may not even be set - but Android
Studio itself ships a compatible JDK 21 under IntelliJ's own JDK cache,
not just its bundled (often JDK 25) `jbr`:

```bash
cd mobile/android
JAVA_HOME="C:/Users/<you>/.jdks/jbr-21.0.11" ./gradlew assembleDebug
# output: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Find the exact `.jdks/jbr-*` directory name on your machine first (`ls
~/.jdks`) rather than assuming this version. Install with `adb install
-r app-debug.apk` once a device is connected (`adb devices` to confirm) —
needs a real device with USB debugging on, or a running emulator.
Confirmed working end-to-end 2026-09-13, rebuilding after the
eight-country/i18n/visual-refresh batch (44 map folders synced
correctly, real-sized `.pmtiles`, not the corrupted-symlink failure mode
from the Gotchas section below).

**The hardware back button (FT-14)** goes up the app's hierarchy: map
screens go to the overview, the overview goes to the map list, and the
list exits the app. It uses `@capacitor/app`, and one
`App.addListener('backButton')` in `app/src/routes/+layout.svelte`
registers only inside the Android app. `parentRoute()` in
`app/src/lib/backNavigation.ts` decides the destination and is
unit-tested. Registering the listener switches off Capacitor's default
(history back, then exit), so add any new screen to `parentRoute`. To
check it on the emulator, run `adb shell input keyevent KEYCODE_BACK`.
`adb shell uiautomator dump /sdcard/ui.xml` lists the WebView's visible
texts with their screen bounds, which is enough to tap tabs by name. In
Git Bash, set `MSYS_NO_PATHCONV=1` first, or `/sdcard` gets rewritten
into a Windows path.

**Release (signed) APK (FT-06).** Anything handed to players must be a
release APK signed with Geoclick's own key, not the per-machine debug key.
Android only accepts an update signed by the same key as the installed
app, so **if this key is lost, nobody's installed copy can ever be
updated.** Keep the keystore and its passwords backed up outside the
repo. Create the key once, with the JDK's `keytool`. It asks for the
passwords and a name:

```bash
"C:/Users/<you>/.jdks/jbr-21.0.11/bin/keytool.exe" -genkeypair -v \
  -keystore C:/Users/<you>/projects/geoclick-release.jks \
  -alias geoclick -keyalg RSA -keysize 4096 -validity 10000
```

Then copy `mobile/android/keystore.properties.example` to
`keystore.properties` in the same folder and fill it in. The real file
and any `*.jks` are gitignored, so never force-add them. A machine without
that file can set `GEOCLICK_KEYSTORE_FILE`, `GEOCLICK_KEYSTORE_PASSWORD`,
`GEOCLICK_KEY_ALIAS` and `GEOCLICK_KEY_PASSWORD` instead. Build and check:

```bash
cd mobile/android
JAVA_HOME="C:/Users/<you>/.jdks/jbr-21.0.11" ./gradlew assembleRelease
# signed: app/build/outputs/apk/release/app-release.apk
"$LOCALAPPDATA/Android/Sdk/build-tools/<version>/apksigner.bat" verify --print-certs app/build/outputs/apk/release/app-release.apk
```

Without any key configured, `assembleRelease` still succeeds but produces
`app-release-unsigned.apk`, which no phone will install. That's the sign
the key setup is missing.

Same persistence pattern as desktop: `createProgressRepository()` picks
`capacitorProgressRepository.ts` (via `@capacitor-community/sqlite`) when
`Capacitor.isNativePlatform()` is true, same `ProgressRepository`
interface and the same table schema as the Tauri implementation.

**Schema changes go in two places, and a test holds you to it.** Both
SQLite backends now have a versioned migration list: desktop's
`migrations()` in `desktop/src-tauri/src/lib.rs` (tauri-plugin-sql), and
Android's `MIGRATIONS` array in `app/src/lib/capacitorMigrations.ts`
(driven by SQLite's `PRAGMA user_version`, GC-040 — before that Android
just ran `CREATE TABLE IF NOT EXISTS` on every open with no version at
all). To change the schema, append a migration to **both**: Tauri's
version N is Android's `MIGRATIONS[N-1]`. Never edit or reorder a
migration that has shipped. `capacitorMigrations.test.ts` runs both
against a real SQLite (Node's built-in `node:sqlite`) and fails if the
resulting schemas differ or the two lists have different lengths — it
also covers the tricky upgrade path (a device from before GC-040 has the
tables but `user_version = 0`, which is why migration 0 alone must stay
`IF NOT EXISTS`). What no test here can reach is the plugin's native
bridge; anything touching that still needs a real device.

There's no `dev`-mode live-reload yet - re-run `npm run sync` and
relaunch from Android Studio after any app change.

## Adding or editing a tutorial step (FT-11/FT-12)

The tutorial walks a new player through Italy — Regions on the real
screens. Its script is `docs/TUTORIAL.md`; change that first, since the
product owner reviews tutorial copy there. Then:

1. **The step itself** lives in `STEPS` in
   `app/src/lib/tutorialMachine.ts`: which screens it belongs on (the
   first is where Back and Resume go), what moves it on (`advance`:
   Start, Next, a route change, a map gesture, a name shown in Explore, a
   right or wrong drop, Finish), its copy keys, and what it highlights on
   each screen.
2. **The copy** goes in `app/src/lib/i18n.svelte.ts`, in English, German
   and Italian; the `TranslationKey` union makes a missing language a
   type error. Keep TUTORIAL.md's copy table and the app in step: FT-11
   generated the strings from that table. Bold is `**word**`.
3. **The highlighted element** needs a `data-tutorial="..."` attribute
   (see TUTORIAL.md, "Anchors"). A missing one isn't an error: the card
   then shows without a spotlight.
4. **A new kind of action** needs a hook in the view where it happens,
   like `tutorialDrop` in QuizView, plus an `Advance` kind and a case in
   `transition()`. Hooks must do nothing when no tutorial is running.
5. **Tests:** `tutorialMachine.test.ts` walks the whole script, so a new
   step shows up there first. Then walk it in a real browser at 360px in
   German, the longest language: each numbered step's text must fit in
   four lines (TUTORIAL.md, "Layout").

Progress during the tutorial goes to the sandbox (`tutorialSandbox.svelte.ts`),
so a step can use the real quiz freely. The home page's "New here?" nudge
(`TutorialNudge.svelte`) stops showing once the tutorial has been started
or dismissed; to see it again, delete `geoclick:tutorial-seen:v1` from
localStorage.

## Building a new map, on Windows (added when France/Spain/GB/Poland/
Ukraine/Sweden were added, 2026-09-12)

`data/scripts/build-map.ts`/`build-points-map.ts` need `ogr2ogr`
(GDAL), `tippecanoe`, and the `pmtiles` CLI - none of which have a
Windows-native build (`tippecanoe` has no Windows build at all). On a
Windows machine, run the map-build step from WSL2 with these installed
the same way ONBOARDING originally set them up on Linux (`apt install
gdal-bin tippecanoe`, the `pmtiles` CLI's Linux binary release into
`~/.local/bin`) - see MAPS.md's "Environment note" for the full detail
and why this session used a *separate* WSL-native clone rather than
running WSL against the same checkout Windows uses.

**Do not run `npm install` from WSL against the Windows checkout's
`node_modules`.** Native binaries (esbuild, rolldown, better-sqlite3,
...) are platform-specific, and npm's optional-dependency resolution
will swap the Windows ones out for Linux ones - breaking the Windows
app/dev-server toolchain (`Cannot find module
'@rolldown/binding-win32-x64-msvc'`) until `npm install` is re-run from
Windows to restore it. Keep a separate, Linux-native clone (or
`node_modules`) for WSL-side work instead - copy or `--out` the
resulting `data/maps/<id>/` directory into the Windows checkout once
built.

## How work is expected to flow here

This project is run with a PM/Developer split (see CLAUDE.md) — whoever's
driving development doesn't just implement silently, they report back
with concrete steps to verify a change before it's considered done. Carry
that same discipline into any task you pick up:

1. **Branch for anything beyond a trivial doc fix.** Don't commit directly
   to `main` for feature work or bug fixes — `main` is what deploys.
2. **Test locally before asking anyone to review.** Run the app, actually
   click/drag through the thing you changed — don't rely on type-checking
   alone for UI behavior. If there's an automated way to verify it (unit
   tests, an existing Playwright-style script), run that too.
3. **State "tested locally" explicitly** when you report the change is
   ready, separately from any deployment concern — don't conflate "does
   the feature work" with "did it deploy," they're different questions
   with different failure modes (this bit the project once already — the
   story is in DECISIONS.md, "Two labelled test steps, not one").
4. **Get it reviewed/approved before merging to `main`.** This is a
   review gate, not a cost one: nothing lands on `main` without the
   product owner having had a chance to try it. Build cost stopped being
   a constraint on 2026-09-13 (DECISIONS.md, "Netlify build cost"), but
   "just see if it deploys" is still not a reason to merge — verify the
   build locally first.
5. **Update ROADMAP.md** (check off what landed, note what changed if
   scope shifted) **and ARCHITECTURE.md** (if you changed how something is
   structured, not just a bug fix) as part of finishing the task, not as
   an afterthought.

## AI assistant scope

Most of the development here is done by Claude, and `CLAUDE.md` is the
brief it works from. Two things about that file are worth knowing before
you edit it:

- **It is loaded in full at the start of every session**, before anything
  is read or asked. Anything in it is paid for on every single task,
  whether or not the task touches it. That is why it is kept rule-only
  and short — see its own §0, which sets the budget and names the
  canonical source for each kind of file.
- **Reasoning does not belong in it.** When a rule was learned the hard
  way, the rule stays in `CLAUDE.md` and the story moves to
  [DECISIONS.md](DECISIONS.md) under its own heading, which `CLAUDE.md`
  names. Three such entries were moved out on 2026-09-20 — "Two labelled
  test steps, not one", "Hand a dashboard problem back" and "Netlify
  build cost". If you find yourself adding a paragraph of justification
  to `CLAUDE.md`, that is the signal: write it here or in DECISIONS.md
  and leave a pointer.

Everything else — how the build works, where data comes from, why the
product behaves as it does — lives in the files listed at the top of
this one, and is read on demand rather than up front.

## Conventions worth knowing before you write code

- **Svelte 5 runes only** — `$state`, `$derived`, `$props`, `$effect`.
  Don't use Svelte 4 patterns (`export let`, `$:`) in new code.
- **Pure logic lives outside Svelte components when it can.**
  `packages/quiz-engine` has zero DOM/Svelte dependency and is unit-tested
  directly — that's deliberate, it's much easier to test and reason about
  than logic embedded in a `.svelte` file's script block. If you're adding
  non-trivial game logic, ask whether it belongs in a package like this
  rather than inline in the component.
- **MapLibre feature-state, not per-feature layers**, drives all the
  visual states on the map (hover, correct, wrong, revealed, etc.) — see
  `data/styles/base.json`'s `fill-color` case expression and grep the
  codebase for `setFeatureState` to see the pattern. Add new visual states
  the same way rather than inventing a new mechanism.
- **Persistent on-map labels are DOM `maplibregl.Popup`s, not MapLibre
  symbol layers.** A symbol-layer approach was tried and abandoned — see
  ARCHITECTURE.md and ROADMAP.md's Iteration 4 section for why (MapLibre's
  collision/placement system unpredictably hid labels even with overlap
  disabled), and DECISIONS.md's "Names never overlap" for why a symbol
  layer stayed rejected in v0.6.0 (it would need glyph fonts shipped in
  the app, and could not magnify a single label). Follow the popup pattern
  already in `QuizView.svelte` for anything similar. Two rules (GC-022):
  - Fill a popup with `setText(name)`, never `setHTML`. Names are data,
    and a future user-made or OSM map could put markup in one.
  - Popup styles live once, globally, in `app/src/app.css`. A component's
    scoped `<style>` can't reach them, because MapLibre mounts popups
    outside the component. Reuse `geoclick-popup` or
    `geoclick-solved-popup` rather than adding another copy.
  - Recent and favourite maps (FT-15/FT-16) live in
    `app/src/lib/mapPrefs.svelte.ts`: localStorage, device-only, like the
    language setting. Anything that reads it on the prerendered home page
    must wait until after mount, or the first render won't match the
    prerendered HTML.
  - The tutorial's sandbox (FT-10, `tutorialSandbox.svelte.ts`) keeps
    Italy — Regions' progress in memory while the tutorial runs. Views
    get it through `createProgressRepository()` as usual, so a new view
    that reads progress is sandboxed for free, as long as it calls that
    factory rather than building a repository itself.
  - "Failed to fetch dynamically imported module …/deps/…" in a browser
    test, right after adding an import: Vite found a dependency its cache
    didn't know and re-bundled mid-run. Run the tests again; a fresh
    clone never hits it.
  - Labels magnify on demand (FT-02/FT-03), and take **no pointer
    input** (`pointer-events: none`, FT-18): drags, pinches and clicks that
    start on a name go to the map. So `labelMagnify.ts`, one listener that
    `createMap` installs, finds the label under the pointer by position:
    the mouse over it sets `.is-hovered`, a tap (down and up within 10px)
    toggles `.is-magnified`. A `:hover` rule on a label would never fire.
    Both classes share one look in `app.css`, so change them together.
  - Names never overlap (FT-23/FT-24, `labelCollision.ts`, installed by
    `createMap` as well): after every map move it measures each label,
    puts each one in the best free spot it has, and hides the ones with
    nowhere left to go, using `.is-crowded` (`visibility: hidden`, so the
    label keeps a size the next pass can measure). A view that draws a
    name does two things: create the popup with `anchor: 'center'` (the
    pass moves labels with `setOffset`, which only means "this far from
    the place" if the popup is centred on it), then call
    `registerLabel(popup, { priority, beside })` right after
    `addTo(map)`. `priority`: bigger wins a contested spot, and
    `areaShares()` gives the usual "the bigger region keeps its name"
    ranking. `beside`: `DOT_CLEARANCE_PX` for a point target (type
    `'city'`), so the name sits beside the dot instead of on it; leave it
    out for a region. Forget the call and the label still works - it just
    ranks 0 and never moves.
  - A view's own furniture marks itself with `data-map-overlay="top"` or
    `"bottom"` (FT-25). `mapFit.ts` measures those elements and the
    opening fit keeps the whole map clear of them, so a new overlay - a
    banner, a second bar - only has to say where it is. The quiz passes
    its tray's height in as well, because it sets that height and fits in
    the same tick, before the DOM has it.
  - **The fact card is responsive on its own** (FT-42). Views pass it the
    same props whatever the screen; it reads `matchMedia` itself and, on a
    small viewport, shows one of its two lines at a time and rotates them.
    The rule lives in `cardLines.ts`, not in the component and not in a
    media query in CSS, because it also has to drive a timer — so it is a
    pure function with unit tests. If you are adding a screen that uses
    the card, you do not have to do anything for phones. **Small means
    either edge ≤ 700 px**, not width alone: that is deliberate, so a
    phone held sideways counts, and it is the one breakpoint in the app
    that does not follow the usual width-only rule.
  - `window.__map` is the real MapLibre map of whichever map view is
    open, on the dev server only (`createMap`). Browser checks use it for
    `map.project(lngLat)` - the screen position of a place - which is how
    the label and framing checks in v0.6.0 were written.
- **Commit messages end with** `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>` when Claude made the change — see CLAUDE.md.

## Gotchas that have already cost real time

- **`app/static/maps` and `app/static/styles` are symlinks** into
  `data/`. A normal local build (`npm run build`) or a git-based CI build
  resolves these fine. Any deploy path that zips/archives the source
  instead of doing a git clone (e.g. a manual "upload source and build
  remotely" flow) can silently drop symlinks, producing a build that's
  missing all map data. If map assets 404 on a deploy but work locally,
  check this first. **Git for Windows hits the same failure mode a
  different way**: it doesn't create real symlinks by default, so a
  fresh Windows clone can turn these into tiny text files containing the
  literal target path instead of real directories - confirmed directly
  (a packaged Windows build 404'd on every map's `map.json`). Fix:
  enable Windows Developer Mode, `git config --global core.symlinks
  true`, then re-clone (an existing checkout won't self-heal).
- **`.pmtiles`/icon binary files need `.gitattributes`, or a Windows
  checkout can silently corrupt them.** Without an explicit `binary`
  declaration, Git falls back to content-sniffing to decide text vs.
  binary - unreliable for a custom format like PMTiles - and Git for
  Windows' common `core.autocrlf=true` default then rewrites line-ending
  bytes inside a misdetected file, corrupting the tile archive. Found
  directly on real Windows hardware: the app loaded and `map.json`-driven
  content (DOM popups, which don't touch the tiles) rendered fine, but
  every polygon fill/outline/lake layer was silently blank - MapLibre's
  WebGL context itself worked (the flat `background` layer, which needs
  no tile source, rendered correctly), only the PMTiles-sourced layers
  didn't. Fixed by adding `.gitattributes` (`*.pmtiles binary`, plus the
  Tauri icon formats) - existing checkouts still need a fresh clone or
  `git add --renormalize .` to actually pick it up. Same class of risk
  applies to `mobile/android/gradle/wrapper/gradle-wrapper.jar` (Iteration
  8+) - added `*.jar binary` to `.gitattributes` when that file was first
  committed, before it ever hit a Windows checkout, rather than waiting to
  reproduce the bug a second time.
- **A fourth variant of the same class of bug: shell scripts checked out
  with CRLF actually break when run**, not just look wrong. Found running
  `data/scripts/fetch-natural-earth.sh` from WSL against this same
  Windows checkout: `set -euo pipefail` failed with `pipefail: invalid
  option name` because the trailing `\r` attached itself to the option
  name. `mobile/android/gradlew` had the identical corruption (a POSIX
  shell script despite no `.sh` extension), just not yet exercised by a
  Linux/WSL-side Gradle invocation. Fixed the same way: `.gitattributes`
  (`*.sh text eol=lf`, `gradlew text eol=lf`). Same renormalize gotcha as
  the `.pmtiles` case, with one extra wrinkle found here: `git checkout
  HEAD -- <path>` alone did **not** rewrite the already-corrupted working
  copy (git's mtime/size shortcut skipped it as "unchanged") - deleting
  the file first, then checking out, forced git to actually rematerialize
  it under the new attribute.
- **The fifth variant, and the one that finally got generalized: every
  `.ts`/`.svelte`/`.json` file was CRLF on disk, so `npm run lint` had
  been silently failing for weeks** (GC-001, 2026-09-13). Prettier's
  default `endOfLine: "lf"` flagged all 39 files, and because the script
  is `prettier --check . && eslint .`, the `&&` meant **ESLint never ran
  at all** - three genuinely unformatted files reached `main` unnoticed
  behind it. Fixed with a catch-all `* text=auto eol=lf` at the **top**
  of `.gitattributes` instead of adding a sixth narrow per-extension
  rule. Two things worth knowing: (1) **order matters** - the last
  matching `.gitattributes` line wins, so the catch-all must come before
  the `binary` lines or it overrides them and re-opens the `.pmtiles`
  corruption bug above; verify with `git check-attr text -- <file>`
  (binaries must say `unset`). (2) `git add --renormalize .` changed no
  blobs - autocrlf had already stored everything as LF; only the
  working tree was wrong, and the delete-then-checkout trick above is
  what actually fixes an existing checkout. If Prettier ever flags
  every file at once again, check line endings before anything else.
- **A map opening on Android with labels but no polygon fills/outlines/
  lakes looks identical to the Windows `.gitattributes` bug above, but on
  a real device it's a completely different cause** (Iteration 8+): the
  Capacitor Android WebView's local asset server doesn't support HTTP
  `206 Partial Content` responses for arbitrary file extensions - a known
  upstream limitation, [ionic-team/capacitor#7664](https://github.com/ionic-team/capacitor/issues/7664)
  - so pmtiles' range-request-based `FetchSource` never gets real tile
  bytes back, even though the identical bundled `.pmtiles` file works
  fine in the browser/Tauri builds. Confirmed via `adb logcat --pid
  <pid>`, not assumed - repeating console errors landed in lockstep with
  every `tiles.pmtiles` request. Fixed in `app/src/lib/geoclickMap.ts`:
  since demo maps are all under 1MB, fetch the whole archive once as an
  ordinary full `GET` and serve pmtiles' byte-range reads out of an
  in-memory buffer instead, only on native Capacitor - see DECISIONS.md's
  "PMTiles on Android" entry for the full reasoning. If you add a much
  larger map later and Android quiz/tour on it feels slow or memory-heavy,
  this is why, and it may need revisiting.
- **When a Capacitor Android console error is unhelpful ("[object
  Object]"), don't trust it - go straight to `adb logcat --pid <pid>`
  filtered to your app's own process.** Capacitor's WebView console
  bridge doesn't serialize `Error`/object values meaningfully, but the
  surrounding log lines (`D Capacitor: Handling local request: ...`, plus
  the timing/repetition pattern of the errors) are usually enough to
  pinpoint the failing request without needing `chrome://inspect`'s
  separate devtools window at all.
- **MapLibre needs a worker script that Vite can't statically discover**
  (its URL is built at runtime inside the library). `app/scripts/
  copy-maplibre-worker.mjs` runs as a `postbuild` step to copy it into
  the built output by hand. If maps fail to render only in a production
  build (not `npm run dev`), check that this script actually ran.
- **Small map regions need drop-tolerance, not just exact hit-testing** —
  see `DROP_TOLERANCE_PX` in `QuizView.svelte` and the "UX refinements"
  section of ROADMAP.md's Iteration 4. If you're touching hit-testing
  logic, re-run (or write) a Playwright check against an actually-small
  region (Bremen on the Germany map is the known worst case), not just a
  big one like Texas — a fix that works for large regions can still fail
  for small ones.
- **Netlify builds cost credits.** Don't trigger manual deploys to check
  something; push to a branch, test locally, and let the user/reviewer
  decide when something actually merges to `main` (which auto-deploys).
- **`npm run dev` can fail to render any map when run from a worktree
  nested under the main repo** (e.g. `.claude/worktrees/<name>/app`,
  Claude Code's own background-work layout) **if that worktree has no
  `node_modules` of its own.** Node's resolution then walks up to the
  outer repo's `node_modules`, which sits outside Vite dev's default
  `server.fs.allow` root — `maplibre-gl-worker.mjs` silently never loads
  (logged as "outside of Vite serving allow list" in the dev server's own
  output, easy to miss), so tiles fetch fine but nothing ever renders,
  same symptom as the pre-existing "worker not pre-bundled" issue above
  but a different cause. Confirmed directly (Iteration 8+, i18n work):
  `npm install` inside the worktree so it has a local `node_modules`
  fixes it; failing that, a production build served locally (see next
  point) sidesteps the dev server entirely.
- **`vite preview` doesn't serve files added by the `postbuild` script**
  (`copy-maplibre-worker.mjs`'s copy into `build/_app/immutable/chunks/`
  happens after `vite build`'s own asset manifest is generated, so `vite
  preview` 404s on `maplibre-gl-worker.mjs` even though the file is
  physically present in `build/`) — confirmed directly by diffing a
  `curl` against the file path, not assumed. A plain static file server
  (`npx serve build`, what Netlify itself effectively does) serves it
  correctly. If you need to smoke-test a production build's map
  rendering locally, use `serve`, not `vite preview` — and since `serve`
  doesn't know this app's SPA fallback convention, add a `build/
  serve.json` with a `{"rewrites":[{"source":"/map/**","destination":
  "/200.html"}]}` rule (gitignored along with the rest of `build/`, so
  it's a disposable local-testing file, not something to commit).

## If you're stuck

- Check ROADMAP.md's Status section and the specific iteration's notes —
  a lot of "why is it built this way" questions are already answered
  there, including dead ends that were tried and abandoned (e.g. the
  Cloudflare Pages hosting attempt, fully documented rather than just
  deleted).
- If something in this doc turns out to be wrong, fix it — that's the
  point of it being "running" documentation rather than a one-time
  writeup.
