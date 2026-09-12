# Geoclick

A geography-learning game: pick a map, take a guided tour, then quiz
yourself with drag-and-drop matching and spaced repetition. Portfolio
project — see [ARCHITECTURE.md](ARCHITECTURE.md) for the full pitch.

## Quick start (browser)

```bash
git clone git@github.com:diegoami/Geoclick2027.git
cd Geoclick2027
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

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

## More docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design and stack choices
- [ROADMAP.md](ROADMAP.md) — what's built, what's next
- [ONBOARDING.md](ONBOARDING.md) — day-to-day workflow, repo layout, gotchas
- [DECISIONS.md](DECISIONS.md) — the *why* behind product/design choices
- [MAPS.md](MAPS.md) — how demo maps are built
