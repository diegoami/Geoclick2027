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
  src/routes/            SvelteKit file-based routing
  static/maps -> ../../data/maps       symlink, see "Gotchas" below
  static/styles -> ../../data/styles   symlink, same gotcha
  scripts/copy-maplibre-worker.mjs     postbuild step, see "Gotchas"

packages/
  quiz-engine/            pure quiz session logic (no DOM/Svelte) - the
                           part most worth reading to understand the quiz
                           domain model without wading through UI code
  srs/                    placeholder only - spaced-repetition logic,
                           not implemented yet (Iteration 6)

data/
  maps/<map-id>/          generated per-map assets: map.json, tiles.pmtiles,
                           tour.json - committed to git, not hand-edited
  styles/base.json         shared MapLibre style, used by all maps
  source/                  raw Natural Earth downloads
  scripts/build-map.ts     the pipeline that turns source data into a map/
```

If you're fixing a UI bug in the quiz, you'll spend most of your time in
`app/src/lib/QuizView.svelte` and possibly `packages/quiz-engine/src/index.ts`
(the pure session state machine it calls into). If you're adding a new
demo map, you'll spend it in `data/scripts/build-map.ts` and
`data/maps/`. ARCHITECTURE.md has a per-area breakdown if you need more.

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
  check this first.
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
