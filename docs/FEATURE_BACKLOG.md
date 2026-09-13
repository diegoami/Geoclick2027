# Geoclick — Feature backlog (raised 2026-09-13)

Three feature requests captured for a **future planning pass**, separate
from and after the [remediation programme](REMEDIATION_PLAN.md) (which is
about fixing what the 2026-09-13 review found, not adding anything new).
This document is written for whoever runs that next planning session — the
"orchestrator" role, same pattern used to turn `CODE_REVIEW_2026-09-13.md`
into `tasks.yaml` — to read, ask clarifying questions where flagged, and
turn into a concrete, estimated task list of its own. **Nothing here is
scoped for implementation yet.** Where a real product decision is needed
(not an implementation detail), it's called out explicitly rather than
guessed at.

---

## 1. Public distribution: GitHub Releases, binaries, and the private-repo problem

**Ask:** publish the desktop installer and the Android APK as downloadable
artifacts on GitHub, plus make sure the live web app's link
([zesty-centaur-40e7c5.netlify.app](https://zesty-centaur-40e7c5.netlify.app/))
is easy to find. Question raised: the repo
([github.com/diegoami/Geoclick2027](https://github.com/diegoami/Geoclick2027))
is **private** — confirmed directly via `gh repo view` — can binaries even
be published from it?

### The actual constraint

Yes, GitHub Releases can be created on a private repo and files can be
attached to them — but **release assets on a private repo inherit the
repo's own access control**. Anyone downloading one needs to be signed in
to GitHub *and* have at least read access to the repo. An anonymous
visitor clicking a release-asset link gets a login wall, not a download.
So "publish a release" alone does not solve "let anyone install this" as
long as the repo stays private.

### Options, roughly cheapest to most involved

1. **Make the repo public.** Solves it outright — public-repo release
   assets download with no auth, for anyone. This is a real product
   decision, not a technical one: `ONBOARDING.md` already describes
   Geoclick as "Portfolio project, not commercial," and `DECISIONS.md`'s
   SSO-deferral entry already reserves `1.0.0` for "the real public-launch
   milestone." Going public is arguably *part of* that milestone, not a
   side effect of wanting downloadable installers — worth deciding
   together with that bigger question rather than as a side effect of
   this one.
2. **Host binaries somewhere already public, keep the repo private.** The
   Netlify site is already public — the simplest version of this is
   publishing the `.msi`/`.exe`/`.apk` as static files alongside the web
   build (e.g. `app/static/downloads/`) and linking to them from the home
   page or a small "Download" page. No new service, no new account, and
   it reuses infrastructure that already exists. Netlify's free-tier
   bandwidth/storage limits are worth checking once file sizes are known
   (a Tauri `.msi` is typically tens of MB; an APK similar).
3. **A separate, public "releases-only" repo.** Common pattern for
   private-source/public-binary projects: a second, empty public repo
   whose only job is holding tagged Releases; a step in the build process
   (manual today, could be a GitHub Action later) pushes built artifacts
   to it. More moving parts than option 2 for not much extra benefit at
   this project's current size.
4. **A third-party host.** `ROADMAP.md` already flags **itch.io** as a
   "later, once polished enough" idea for exactly this kind of
   distribution — worth revisiting now that there's something to show.
   Google Drive / a plain S3-style bucket work too but have none of
   itch.io's built-in "here's a game page" framing.

**My read:** option 2 (static files on the existing Netlify site) is the
least-new-infrastructure way to get "anyone can download the installer"
working today, independent of the public/private repo question. Making
the repo public (option 1) is a bigger, separate decision worth making
deliberately alongside the 1.0.0/public-launch milestone rather than
backed into now. Recommend starting with option 2, revisiting whether the
repo goes public when that bigger milestone is actually being planned.

### Also needed, regardless of which option

- **Desktop and Android builds are currently manual, local-machine steps**
  (see `ONBOARDING.md`'s desktop/Android build sections) — Tauri needs
  Rust, Android needs the SDK/a specific JDK. Publishing a release today
  means building both by hand and uploading the result somewhere.
  Automating that (e.g. a GitHub Action matrix building all three shells
  on tag push) is a real, separate task with its own cost — worth
  scoping once the distribution *channel* is decided, not before.
- A visible, permanent link to the live web app belongs somewhere
  obvious regardless of the above — `README.md` doesn't currently link
  to it at all. Cheap, do it either way.

---

## 2. App logos (desktop + mobile)

**Current state, checked directly:** neither shell has a real logo.
`desktop/src-tauri/icons/` holds Tauri's own scaffold-generated icon set
(the default template art, produced by `tauri icon` from whatever seed
image the project was initialized with), and `mobile/android/app/src/main/res/mipmap-*/`
holds Capacitor/Android's default launcher icon. Neither reflects an
actual Geoclick brand identity. The web favicon
(`app/src/lib/assets/favicon.svg`) is a small hand-drawn placeholder mark,
not necessarily meant to double as an app icon.

### What "done" looks like

- **One master icon design** (square, high resolution, simple enough to
  read at 16×16) that says "Geoclick" — likely something map/pin/quiz
  themed given the product. This is the actual open question: **who
  designs it.**
- From that master image, generate:
  - **Tauri**: `tauri icon <source.png>` produces the full Windows/macOS/
    Linux icon set (`.ico`, `.icns`, the `Square*Logo.png` Windows Store
    tiles, etc.) in one command — mechanical once a source image exists.
  - **Android**: an adaptive icon (foreground + background layers, or a
    single flattened PNG at minimum) across all `mipmap-*` densities —
    either Android Studio's Image Asset Studio, or a CLI icon-generator
    equivalent, from the same source image.
  - **Web favicon**: worth deciding whether it stays its current
    hand-drawn mark or switches to a cropped version of the new app icon
    for consistency across all three shells.

### Open question for the next planning pass

Design work like this isn't really a coding task — it needs an actual
visual design step first. Two ways to get there: I can draft a candidate
icon design (Claude has design/artifact tooling that can produce a simple
mark to react to, not production-ready assets by itself) for the product
owner to approve or redirect, or the product owner sources/commissions
one externally and hands off a source file. Either way, the *generation*
into all the platform-specific formats above is mechanical once a source
image is approved — that part can be scoped as a normal task.

---

## 3. Interactive, multi-language in-app tutorial

**Ask, verbatim structure:** a "Tutorial" button near the top of the app
that interactively walks a new user through the product — not a
slideshow or a video, but something that prompts the user to actually
click the real buttons and perform the real actions, in this order:

1. Select a map
2. Switch to the overview (**note:** the request said "preview" — the
   existing feature with this role is called **Overview**,
   `/map/[mapId]/overview`, per `app/src/lib/mapCatalog.ts`/`MapNav.svelte`;
   assuming that's the intended target rather than a new view. Flag this
   in the planning pass if "preview" meant something else.)
3. Switch to Quiz
4. Drag a name slip onto its target region/city
5. Deliberately make a mistake, so the user sees the wrong-drop feedback
   (the shake/red-flash behavior — see `DECISIONS.md`'s Quiz mechanic
   section)
6. Switch back to Overview to check a region if unsure of the answer
7. Return to Quiz and confirm the regions already solved are still marked
   solved (demonstrating that progress persists within a session)
8. Explain spaced repetition — why review scheduling exists, tying into
   the due/not-due behavior on the home page
9. Showcase Tour mode

**Must work in all three shipped UI languages** (English/German/Italian)
— i18n is already a core, tested part of this product
(`app/src/lib/i18n.svelte.ts`), and a tutorial that only exists in English
would be a visible regression against that.

### Design considerations worth flagging now, before this becomes tasks

- **This is meaningfully bigger than the other two items.** It's a new
  interaction pattern (spotlight/coach-mark UI that highlights a specific
  real element and waits for the real action before advancing, not a
  canned animation) that touches the home page, `MapNav`, `QuizView`,
  `OverviewView`, and `TourView` — five files that otherwise don't share
  a cross-cutting UI concern today.
- **Must not corrupt real progress data.** Step 7 explicitly wants the
  user to see solved regions persist — if the tutorial runs against a
  real map using the real quiz session/repository, a completed "tutorial
  quiz" would write real SRS card state and a real last-session summary
  for whatever map was used, polluting the user's actual progress the
  first time they ever open the app. `DECISIONS.md` already has precedent
  for "this mode must not touch real state" (Practice mode never writes
  back to SRS state) — the tutorial likely needs the same treatment, or
  a dedicated sandboxed map/session, decided explicitly rather than
  discovered as a bug later.
- **New i18n surface area.** Every tutorial prompt is new copy, times
  three languages — a `tutorial.*` namespace in `i18n.svelte.ts`, sized
  roughly to the nine steps above plus any framing/skip/replay copy.
- **Trigger and repeatability**: a persistent nav button (as requested)
  implies it should be re-runnable anytime, not just a first-launch
  modal — worth deciding whether first-time users also get it
  automatically, or only ever via the button.
- **Scope boundary worth setting explicitly**: does the tutorial need to
  work identically on the point-target (towns/cities) map style too, or
  is one polygon-region map (e.g. `italy-regions`) sufficient to
  demonstrate all nine steps? Picking one canonical demo map up front
  avoids re-deriving this per task.

This is the item most likely to need its own short design/discussion pass
before a task breakdown makes sense, rather than going straight from this
paragraph to `tasks.yaml`-style specs the way the other two can.

---

## How to use this document

Same shape as the remediation programme's own origin story: a fresh
planning session reads this file (and asks the product owner directly
wherever something above is flagged as an open question, rather than
guessing), then produces its own dated plan — most likely its own
`docs/`-based programme, parallel to but separate from
`REMEDIATION_PLAN.md`, since this is new feature work, not a fix to
existing findings. Update this file in place if scope changes before
that planning pass happens; it's a backlog, not a snapshot.
