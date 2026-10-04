# Geoclick

A geography-learning game: pick a map, take a guided tour, then quiz
yourself by dragging each name onto the place it belongs. The better you
know a map, the fewer names it offers you at a time — so a map you have
learned keeps being worth playing. 164 maps across 57 countries (and the six continents), in
English, German and Italian. Portfolio project — see
[ARCHITECTURE.md](ARCHITECTURE.md) for the full pitch.

Created by Diego Amicabile.

**Play it:** <https://geoclick.netlify.app/> — the live web
app, built from `main`. No install or account needed; progress is kept
in your browser.

**Windows or Android app:** installers are on the public
[releases page](https://github.com/diegoami/geoclick-releases/releases/latest)
(repository: [geoclick-releases](https://github.com/diegoami/geoclick-releases)). How they're built and published:
[docs/RELEASES.md](docs/RELEASES.md).

**How it works, screen by screen:** the [user manual](docs/USER_MANUAL.md)
explains every screen and button with screenshots, for readers who won't
run it.

## Quick start (browser)

```bash
git clone git@github.com:diegoami/Geoclick2027.git
cd Geoclick2027
npm install
npm run setup-hooks              # once per clone: pre-push runs the quality gates
npx playwright install chromium  # once per machine: component tests run in it
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

`npm run setup-hooks` points git at the committed `.githooks/`, whose
`pre-push` runs the four quality gates (`check`, `test`, `lint`, `build`)
and rejects the push if one fails. Run them by hand with `npm run gates`
(add `-- --quiet` for PASS/FAIL lines only);
skip the hook for a single push with `git push --no-verify`.

## Quick start (desktop app)

Needs Rust (via [rustup](https://rustup.rs)) and a C++ toolchain
installed first — see [ONBOARDING.md](ONBOARDING.md#running-the-desktop-build-iteration-7)
for platform-specific setup (Windows needs VS Build Tools' C++ workload;
Linux needs webkit2gtk + friends). Once those are in place:

```bash
npm install               # from the repo root, once
npm run dev --workspace=app    # terminal 1: starts the dev server
```

```bash
cd desktop
npm run dev                # terminal 2: opens the app in a native window
```

To build an actual installer instead of running in dev mode:

```bash
cd desktop
npm run build
```

Installers land under `desktop/src-tauri/target/release/bundle/`
(`.msi`/`.exe` on Windows, `.deb`/`.rpm`/`.AppImage` on Linux).

## Quick start (Android)

Needs [Android Studio](https://developer.android.com/studio) (bundles the
JDK Gradle needs) with an emulator (AVD) set up, or a real device with USB
debugging enabled. Once that's in place:

```bash
npm install                    # from the repo root, once
npm run build --workspace=app  # builds app/build, the web assets the app wraps
cd mobile
npm run sync                   # copies app/build + native plugins into android/
npm run open                   # opens the project in Android Studio
```

From Android Studio, press Run to build and launch on the selected
emulator/device. There's no `dev`-mode live-reload script yet (unlike
desktop) — re-run `npm run sync` after any app change and re-launch from
Android Studio to see it.

## More docs

- [docs/USER_MANUAL.md](docs/USER_MANUAL.md) — the player's manual, with screenshots
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design and stack choices
- [ROADMAP.md](ROADMAP.md) — what's built, what's next
- [ONBOARDING.md](ONBOARDING.md) — day-to-day workflow, repo layout, gotchas
- [DECISIONS.md](DECISIONS.md) — the *why* behind product/design choices
- [MAPS.md](MAPS.md) — how demo maps are built
