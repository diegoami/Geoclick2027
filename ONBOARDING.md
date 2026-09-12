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
   any contributor, human or not.
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
    MapView.svelte       plain map viewer
    TourView.svelte      guided tour mode
    QuizView.svelte      drag-and-drop quiz mode (the most complex view)
    geoclickMap.ts        shared map-loading helpers used by all three views
    mapDefinition.ts, tour.ts   data-shape types + tour logic
    progressRepository.ts, sqliteProgressRepository.ts,
    capacitorProgressRepository.ts   local-first storage backends (see
                                       ARCHITECTURE.md's Storage section)
    supabaseClient.ts, supabaseProgressRepository.ts, authStore.svelte.ts,
    progressSync.ts, AccountStatus.svelte   optional cross-device sync
                                              (Iteration 8+) - see this
                                              file's "Enabling cross-device
                                              sync (Supabase)" section
  src/routes/            SvelteKit file-based routing
  static/maps -> ../../data/maps       symlink, see "Gotchas" below
  static/styles -> ../../data/styles   symlink, same gotcha
  scripts/copy-maplibre-worker.mjs     postbuild step, see "Gotchas"
  .env.example            the two optional PUBLIC_SUPABASE_* vars - copy to
                            .env locally to turn sign-in on, see below

packages/
  quiz-engine/            pure quiz session logic (no DOM/Svelte) - the
                           part most worth reading to understand the quiz
                           domain model without wading through UI code
  srs/                    pure SM-2 scheduler (rate/isDue) - no DOM,
                           storage, or quiz-UI dependency, same style as
                           quiz-engine

data/
  maps/<map-id>/          generated per-map assets: map.json, tiles.pmtiles,
                           tour.json - committed to git, not hand-edited
  styles/base.json         shared MapLibre style, used by all maps
  source/                  raw Natural Earth downloads
  scripts/build-map.ts     the pipeline that turns source data into a map/
  supabase/schema.sql      optional cross-device sync DB schema + RLS
                            policies (Iteration 8+) - run once in a real
                            Supabase project's SQL Editor, see this file's
                            "Enabling cross-device sync (Supabase)" section

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

## Getting it running locally

```bash
git clone git@github.com:diegoami/Geoclick2027.git
cd Geoclick2027
npm install
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
npm run check    # svelte-check / type-check
npm run lint      # prettier + eslint on the app
```

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

Same persistence pattern as desktop: `createProgressRepository()` picks
`capacitorProgressRepository.ts` (via `@capacitor-community/sqlite`) when
`Capacitor.isNativePlatform()` is true, same `ProgressRepository`
interface and the same table schema as the Tauri implementation - hand-
mirrored, not shared code, since Capacitor has no equivalent of Tauri's
single `migrations()` function to keep both in sync automatically. If you
change one schema, change the other.

There's no `dev`-mode live-reload yet - re-run `npm run sync` and
relaunch from Android Studio after any app change.

## Enabling cross-device sync (Supabase) (Iteration 8+, added 2026-09-12)

Sign-in and cross-device score sync are **optional** — the app plays
exactly as before with no setup at all, for every existing user. This
section is only for turning the feature *on*, which nobody but the
project owner can do (Claude cannot create third-party accounts on
anyone's behalf — see DECISIONS.md's "Cross-device sync (Supabase)"
entry). Everything below is a one-time setup a human does in a browser.

1. **Create a Supabase project.** [supabase.com](https://supabase.com) →
   New project. Any name/region/plan works for this; the free tier is
   enough for a portfolio project's traffic.
2. **Run the schema.** In the project's dashboard: **SQL Editor → New
   query**, paste the entire contents of `data/supabase/schema.sql`, and
   run it. Creates `card_states`/`session_summaries` (mirroring the Tauri/
   Capacitor SQLite schemas plus a `user_id` column) with row-level
   security policies already applied — nothing else to configure on the
   database side. Safe to re-run if needed (every statement is
   idempotent).
3. **Enable the Google OAuth provider.** Dashboard → **Authentication →
   Providers → Google** → toggle it on. This needs a Google OAuth Client
   ID/Secret from the [Google Cloud
   Console](https://console.cloud.google.com/apis/credentials) (OAuth
   consent screen + an "OAuth client ID" of type "Web application") —
   Supabase's own provider setup page links directly to the right Google
   Cloud screens and shows the exact redirect URI Google needs, which is
   generated per-project (`https://<your-project-ref>.supabase.co/auth/v1/callback`).
   Paste that into Google Cloud's "Authorized redirect URIs", then paste
   the Client ID/Secret Google gives back into Supabase's Google provider
   settings.
4. **Set the auth redirect URL(s).** Dashboard → **Authentication → URL
   Configuration → Redirect URLs**. Add both:
   - `http://localhost:5173/**` (or whatever port `npm run dev` actually
     prints) for local testing
   - your production Netlify URL, e.g. `https://<your-site>.netlify.app/**`
     for the live deploy
   The app itself passes `redirectTo: window.location.origin` when
   starting the OAuth flow (`app/src/lib/authStore.svelte.ts`), so it
   always redirects back to wherever it was opened from — these two
   entries just need to be on Supabase's allow-list.
5. **Get the two values the app needs.** Dashboard → **Project Settings →
   Data API** → the **Project URL** and the **anon / public** API key
   (not the `service_role` key — that one must never end up in client-side
   code or an env var this app reads).
6. **Set the env vars, in both places:**
   - **Locally**: copy `app/.env.example` to `app/.env` and fill in
     `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` with the values from
     step 5, then restart `npm run dev --workspace=app`.
   - **Netlify**: Site configuration → **Environment variables** → add the
     same two keys/values, then trigger a new deploy (env var changes
     don't apply to already-built output) — per CLAUDE.md, let a normal
     git-triggered build pick this up rather than manually triggering one
     just to check.
7. **Test it.** With the env vars set locally, `npm run dev --workspace=app`
   and open the home page — the "Cross-device sync isn't set up" line
   should be replaced by a "Sign in with Google" button. Sign in, play a
   map, check the Supabase dashboard's **Table Editor** for a row in
   `card_states`/`session_summaries` under your account, then open the app
   on a second device/browser and sign in with the same Google account to
   confirm the progress follows you.

Until these steps are done, `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY`
stay unset and the app behaves exactly as it always has — no error, no
broken button, just the local-only experience every existing user already
has.

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
   with different failure modes (this bit the project once already, see
   CLAUDE.md).
4. **Get it reviewed/approved before merging to `main`.** Every push to
   `main` triggers a real Netlify build, which costs build credits on the
   plan in use — don't merge speculatively or as a way to "just see if it
   deploys."
5. **Update ROADMAP.md** (check off what landed, note what changed if
   scope shifted) **and ARCHITECTURE.md** (if you changed how something is
   structured, not just a bug fix) as part of finishing the task, not as
   an afterthought.

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
  disabled). Follow the popup pattern already in `QuizView.svelte` for
  anything similar.
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

## If you're stuck

- Check ROADMAP.md's Status section and the specific iteration's notes —
  a lot of "why is it built this way" questions are already answered
  there, including dead ends that were tried and abandoned (e.g. the
  Cloudflare Pages hosting attempt, fully documented rather than just
  deleted).
- If something in this doc turns out to be wrong, fix it — that's the
  point of it being "running" documentation rather than a one-time
  writeup.
