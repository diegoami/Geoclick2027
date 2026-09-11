# Geoclick — Roadmap

Self-contained iterations toward the desktop POC described in
[ARCHITECTURE.md](ARCHITECTURE.md). Each iteration should leave the repo in
a working, demo-able state so work can resume cleanly from any point.
Check items off as they land; update "Status" as iterations complete.

## Status

- **Done**: architecture proposal (`ARCHITECTURE.md`); Iteration 0 (repo &
  tooling scaffolding); Iteration 1 (demo map data pipeline); Iteration 2
  (core map viewer); Iteration 3 (tour mode); Iteration 3.5 (public
  deploy — live on Netlify); Iteration 4 (quiz engine — drag-to-match).
- **Not started**: everything else below.
- **Next up**: Iteration 5 (spaced repetition).

## Process notes (not tied to a specific iteration)

- [ ] **Dependabot** — `.github/dependabot.yml` watching the npm
      ecosystem at the repo root (covers `app/` + `packages/*` through
      the one workspace lockfile). Weekly schedule, version + security
      updates. Review each PR (lint/check/test/build + the Playwright
      smoke pass for anything UI-facing) rather than auto-merging —
      precedent for this: a MapLibre version bump previously changed
      behavior in a way that needed investigation, not a rubber stamp.
- [ ] **Periodic `/code-review`** — run it as a checkpoint at the end of
      each iteration rather than only on request, so drift gets caught
      close to when it's introduced. No new subagent/role needed for
      this, it's an existing skill.
- [ ] **Keep `ARCHITECTURE.md` current as a real map of the code**, not
      just the original design doc it started as — the practical way the
      user (who isn't reading the code directly) keeps a grasp of how
      it's organized as it grows. Update it as part of finishing each
      iteration, alongside the existing ROADMAP.md deliverable notes.

---

## Iteration 0 — Repo & tooling scaffolding

**Deliverable:** A working, empty SvelteKit app that builds and runs
locally. Proves the toolchain (monorepo, TypeScript, lint) is sound before
any game logic exists. Nothing user-facing yet — internal milestone only.

- [x] Init SvelteKit app in `/app`
- [x] TypeScript + ESLint/Prettier baseline
- [x] Set up npm/pnpm workspaces across `/app`, `/packages/quiz-engine`,
      `/packages/srs`
- [x] Local build/test scripts wired up (`build`, `test`, `dev`)
- [x] `.gitignore` covering `node_modules`, `/data/source`, build output

## Iteration 1 — Demo map data pipeline

**Deliverable:** Three ready-to-use map packages — Italy regions, Germany
states, USA states — each a self-contained tileset plus a curated target
list, loadable by any future UI. Reviewable by inspecting the raw
`map.json`/`tiles.pmtiles` output; no app needed yet.

- [x] `data/scripts/fetch-natural-earth.sh` — download + cache
      `ne_10m_admin_1_states_provinces`
- [x] `data/scripts/build-map.ts` — filter by country (ogr2ogr/mapshaper),
      simplify geometry
- [x] `tippecanoe` integration producing `tiles.pmtiles` per map
- [x] Derive draft `Target[]` JSON from filtered GeoJSON (id/name/type/
      geometry) + default tour order sorted by centroid
- [x] Shared `data/styles/base.json` MapLibre style
- [x] Run the pipeline for `italy-regions`, `germany-states`, `usa-states`
- [x] Manually curate each `map.json`: fixed Italy's two English region
      names (Apulia → Puglia, Sicily → Sicilia, English kept as alias).
      Tour order left as the default north-to-south sweep — already a
      sensible narrative order. Deeper alias/tier curation deferred to
      Iteration 4, once the quiz engine exists to actually consume it.
- [x] Alaska/Hawaii framing decision for `usa-states`: keep real geographic
      position, no inset — revisit only if it looks bad once rendered in
      Iteration 2. Also fixed an antimeridian-wraparound bug in
      `build-map.ts` that gave Alaska a nonsense centroid (~0°E) before
      this — its bbox now correctly signals wraparound (west 172.64° >
      east -129.99°).

**Setup notes:** Node.js wasn't installed on this machine — installed via
nvm (LTS, v24). GDAL (`ogr2ogr`) and `tippecanoe` installed via apt. The
`pmtiles` CLI (mbtiles → PMTiles conversion) isn't packaged for apt —
installed the prebuilt Linux binary from
[protomaps/go-pmtiles](https://github.com/protomaps/go-pmtiles) releases
into `~/.local/bin`. None of this is repo-tracked; a fresh machine will
need the same one-time setup.

## Iteration 2 — Core map viewer

**Deliverable:** Opening the app shows one of the three demo maps rendered
beautifully — pan, zoom, and click a region to see it highlight. The first
moment the project "looks like the product" rather than a tech spike.

- [x] SvelteKit route loading a Map Definition + PMTiles via MapLibre
      (`/map/[mapId]`, `MapView.svelte`)
- [x] Render base style + target layer, styled distinctly. Scoped to
      polygons only — all three demo maps are region/state polygons, no
      point/line target exists yet to justify styling for those geometry
      types; add when a map actually needs them (e.g. rivers, capitals).
- [x] Click hit-testing (`queryRenderedFeatures` + `setFeatureState`,
      orange highlight on click). Tap wasn't separately tested — no
      touch-device testing available in this environment; MapLibre treats
      tap as click by default, so likely fine, but genuinely unverified.
- [x] Zoom/pan controls (`NavigationControl`), fit-to-bounds on load (from
      target centroids — see `overallBounds` in `mapDefinition.ts`)
- [x] Manual smoke test against all three demo maps (Playwright,
      screenshots + console/network assertions, not just eyeballing)

**Two real bugs found via the smoke test, not just polish:**
- MapLibre's tile-parsing worker (`maplibre-gl-worker.mjs`) silently failed
  to load under Vite's dev pre-bundling — tiles fetched fine (206 partial
  responses) but nothing rendered, no error surfaced in the UI. Fixed with
  `optimizeDeps.exclude: ['maplibre-gl']` in `vite.config.ts`.
- `base.json`'s click-highlight layer used `feature-state` inside a layer
  `filter`, which MapLibre doesn't support (feature-state only works in
  paint/layout expressions) — threw at style load. Fixed by folding the
  highlight into `targets-fill`'s `fill-color` as a `case` expression
  instead of a separate filtered layer.

**One data-pipeline bug found while actually looking at the render:**
default polygon-label placement duplicated labels wherever a region's
polygon crossed a tile boundary (visible on Italy at low zoom — Toscana,
Sardegna, etc. each labeled 2-3 times). Fixed in `build-map.ts` by
generating a separate `labels` point layer (one point per target, at its
precomputed centroid) instead of relying on MapLibre's per-tile polygon
label placement. Also moved the Apulia/Sicily → Puglia/Sicilia name fix
(originally patched directly into `map.json` in Iteration 1) upstream into
`build-map.ts` itself, so `map.json` and the tiles agree by construction
instead of by a manual patch that only touched one of the two.

**Setup notes:** the smoke test used Playwright + Chromium headless (not
just HTTP status checks) to actually catch the two rendering bugs above —
`npx playwright install chromium` plus one more apt package
(`libasound2t64`) were needed on this machine, not repo-tracked.

**Follow-up round, from using the actual viewer:**

- [x] Removed the always-on region-name label layer from `base.json` — a
      place-recognition game shouldn't show the answer on the map by
      default. Names now appear on demand: a popup at the clicked location.
- [x] Excluded Alaska/Hawaii from `usa-states` entirely (new
      `build-map.ts --exclude` option), rather than including them and
      accepting the dead space — decided once actually looking at the
      rendered map. 49 targets now (48 contiguous states + DC).
- [x] Fixed the zoom controls (top-right) overlapping the back button —
      consolidated back-link + map-name into one MapView-owned corner
      cluster (top-left), leaving top-right to MapLibre's own
      `NavigationControl` exclusively.
- [x] Replaced the small corner "selected: X" text with a `maplibregl.Popup`
      anchored at the click location, larger text, closer to the region —
      directly requested, and also a more natural fit now that permanent
      labels are gone.

## Iteration 3 — Tour mode

**Deliverable:** Press play on a demo map and watch a guided flythrough of
its regions in order, names revealing one by one. The core "gorgeous guided
tour" pitch is demonstrable end-to-end for the first time.

- [x] `TourStep` data structure (`app/src/lib/tour.ts`) + `tour.json` per
      demo map, generated by `build-map.ts` from the already-curated
      `tourOrder` (north-to-south sweep) with a default 3s dwell per step.
      Narration text is supported by the type but left empty — same
      "curate when something actually consumes it" call as aliases/tiers
      in Iteration 1; it's not worth hand-writing flavor text for ~85
      targets across 3 maps before the quiz loop (Iteration 4-5) proves
      the core mechanic is worth polishing.
- [x] Tour Player (`TourView.svelte`): sequential `fitBounds` to each
      target's bbox (1.2s flight), highlight via the same feature-state
      mechanism as click-to-explore, popup reveal at the target's centroid,
      dwell timer before auto-advancing.
- [x] Play / pause / prev / next controls, step progress ("i / N"),
      replay on completion. No narration text display yet since none is
      authored (see above) — the UI supports it trivially once it exists.
- [x] Speed control (0.5×/1×/1.5×/2×/3×, requested after first trying the
      tour) — scales both the dwell timer and the camera flight duration,
      so a faster tour also *feels* faster rather than just cutting the
      pause short. Changing speed mid-step restarts that step's countdown
      at the new speed rather than preserving exact elapsed progress —
      simple, and the only visible effect is timing (no re-flying or
      re-popup).
- [x] Manual test: full tour watched end-to-end for all three demo maps
      (Playwright: autoplay, dwell-based auto-advance, pause actually
      halting the timer, manual prev/next, speed control actually changing
      advance timing, zero console errors)

**Refactor along the way:** extracted the map-bootstrapping logic shared
between free-explore (`MapView.svelte`) and tour (`TourView.svelte`) into
`app/src/lib/geoclickMap.ts` — both need the same fetch-style-and-pmtiles,
create-map, add-nav-control sequence, only the interaction model differs.
Also added `promoteId: "name"` to `base.json`'s `targets` source, so both
views can highlight a feature by its target name directly
(`setFeatureState(..., id: target.name)`) instead of needing to query the
source for a feature first — simpler and works even for a target that
hasn't been clicked (which the tour needs, since it drives highlighting
from script data, not a click event).

## Iteration 3.5 — Public deploy (optional, deferred)

**Deliverable:** a shareable URL anyone can open in a browser — no clone,
no install — showing whatever the app can do at the time (tour mode at
minimum, quiz mode once Iteration 4 lands). **Done:**
[zesty-centaur-40e7c5.netlify.app](https://zesty-centaur-40e7c5.netlify.app/).

Not part of the linear build order — pick this up whenever there's
something worth showing off, no earlier than Iteration 3. See
ARCHITECTURE.md's "Hosting / deployment" section for the reasoning.

- [x] Swap `adapter-auto` for `@sveltejs/adapter-static` in `app/`, with a
      `200.html` SPA fallback (the filename several static hosts look for)
      for the two dynamic `/map/[mapId]` routes, since map ids aren't
      enumerated at build time. Home page prerenders normally
      (`+layout.ts`: `prerender = true` by default, opted out per-route).
- [x] ~~Connect the repo to Cloudflare Pages~~ — tried, abandoned after
      two live incidents and an unresolvable account-side bug. See
      "Cloudflare Pages (abandoned)" below for the full story, and
      "Testing alternatives" for what's next.
- [x] Get one of Netlify / Vercel / GitHub Pages actually serving the app,
      tested in its own branch (see "Testing alternatives" below) —
      **Netlify won**, live and verified (see "Netlify — chosen" below)
- [ ] (Optional, later) list a build on itch.io once it's polished enough
      to show

### Cloudflare Pages (abandoned)

**Cloudflare dashboard settings** (their newer unified Workers-and-Pages
Git integration asks for a *Deploy command*, not a build-output-directory
field — different from the classic Pages onboarding flow):

- Framework preset: **None** (don't let it auto-detect SvelteKit — that
  assumes Cloudflare's own adapter, not `adapter-static`)
- Root directory: `/` (repo root — not `app/`; `npm install` needs to run
  at the root for the npm workspace to link `app` + `packages/*` correctly)
- Build command: `npm run build --workspace=app`
- Deploy command: `npx wrangler pages deploy app/build --project-name=<name>`

Verified locally as far as possible without real credentials: `npx
wrangler deploy` (the generic Workers command, and what a
`pages_build_output_dir` key in `wrangler.jsonc` is meant to pair with)
flatly refuses to run from an npm-workspaces root at all — a real
constraint, not a guess. `npx wrangler pages deploy app/build
--project-name=...` (the Pages-specific command, used above) has no such
problem: run from repo root, it got all the way to Cloudflare's own auth
check, meaning the command and paths are correct.

Two account-side snags hit getting an actual deploy to succeed, both fixed
in the Cloudflare dashboard rather than in this repo:

- The token Cloudflare auto-injects as `CLOUDFLARE_API_TOKEN` for this
  build flow defaults to Workers-only scope, not Cloudflare Pages — so
  `wrangler pages deploy` (a Pages API call) got a permissions error even
  though the account itself is Super Administrator. Fixed by creating a
  custom API token with **Account → Cloudflare Pages → Edit** permission
  and setting it as a `CLOUDFLARE_API_TOKEN` build variable on the
  project, overriding the auto-injected one.
- Separately, the token that authenticates the *build step itself*
  (cloning/initializing, distinct from the deploy-step token above) had
  belonged to an org member who'd since left — Cloudflare's own error
  named the fix: Settings → Builds → API token → select or create a new
  one. This one didn't actually resolve on retry even after regenerating
  the token, and turned out to be a known, acknowledged bug in Cloudflare's
  Workers Builds product (matching community reports of the exact same
  error persisting across token regeneration) rather than anything
  specific to this repo.

**Pivoted to GitHub Actions instead of Cloudflare's Git integration**
(`.github/workflows/deploy.yml`) once the build-token bug above didn't
resolve — triggered by GitHub's CI instead of Cloudflare's own, sidestepping
their Workers-Builds token-management bug entirely. Needs two GitHub
Actions repository secrets (Settings → Secrets and variables → Actions):
`CLOUDFLARE_API_TOKEN` (the Pages:Edit-scoped token from above) and
`CLOUDFLARE_ACCOUNT_ID`.

**First real Actions run surfaced one more thing**: `wrangler pages deploy`
failed with `The Pages project "geoclick2027" does not exist` — the
dashboard had actually created "geoclick2027" as a **Worker** (Cloudflare's
newer unified Workers+Pages model), not a classic Pages project, despite
every setting screen along the way looking Pages-shaped. Switched to
`wrangler deploy` with static assets instead (`app/wrangler.jsonc`,
`assets.directory: "./build"`), which matches what the dashboard actually
created. Run from `app/`, not repo root — plain `wrangler deploy` (unlike
`wrangler pages deploy`) refuses to run at all from an npm-workspaces root.
SPA fallback for the two dynamic routes now goes through an `app/static/
_redirects` file (`/* /200.html 200`) rather than `not_found_handling:
"single-page-application"`, since that mode serves plain `index.html` —
built for the home route specifically, with the wrong embedded hydration
data — for every unmatched path instead of our `200.html` fallback.
Verified `_redirects`-file support for Workers static assets against
Cloudflare's own docs before relying on it, rather than assuming.

**Live incident right after the first successful deploy: infinite redirect
loop on every route** (`/` included). `assets.html_handling` defaults to
`"auto-trailing-slash"`, which redirects `/200.html` → `/200` (stripping
the extension). `/200` isn't a real file, so that fell through to the
`_redirects` catch-all again, which points straight back at `/200.html` —
looping forever. Not caught locally beforehand (my `serve`-based
simulation doesn't replicate Workers' own html-handling layer at all).
Fixed with `html_handling: "none"` in `wrangler.jsonc`, plus an explicit
`/ → /index.html` rule in `_redirects` (ahead of the catch-all) so the
home page doesn't depend on implicit index-file resolution either, which
"none" mode's docs left ambiguous. Re-verified with `wrangler dev` this
time instead of the `serve` simulation — it runs the actual Workers
assets/redirects engine locally, and would have caught this before the
first deploy had I used it from the start.

**Second live incident, same deploy fixing the first one: `_redirects`
swallowed every real static asset**, not just the dynamic routes. Tiles,
`map.json`, everything under `/maps/` and `/styles/` came back as the
`200.html` shell (`content-type: text/html`) instead of themselves.
Cloudflare's own docs, once actually checked: for Workers static assets,
"redirects are always followed, regardless of whether an asset matches
the incoming request" — the opposite of what I'd assumed from classic
Pages' documented behavior (existing files take priority, `_redirects`
only applies to unmatched paths). My catch-all `/* → /200.html` rule was
intercepting literally everything. Fixed by scoping it to `/map/*`
instead of `/*` — matches only the two dynamic SvelteKit routes, and
never collides with `/maps/...` (plural, our static data directory)
since they're different path prefixes. This time checked `Content-Type`
and actual body content with `wrangler dev` for every critical path
(`/`, `/map/[id]`, `/maps/[id]/map.json`, `/maps/[id]/tiles.pmtiles`,
`/styles/base.json`) before redeploying, not just HTTP status codes —
status 200 was what hid this bug the first time around.

**Two real bugs found by testing the actual built output, not just
`vite build` succeeding:**

- **Relative asset paths broke the SPA fallback.** The default SvelteKit
  build emits asset links like `./_app/...`, correct only when the HTML is
  served at the path it was built for. When `200.html` gets served for an
  arbitrary nested URL (e.g. `/map/italy-regions`), the browser resolves
  `./_app/...` against *that* URL, not the site root — producing a broken
  `/map/_app/...` and a hard "expected a JS module, got text/html" failure.
  Fixed with `paths: { relative: false }` in `vite.config.ts`, forcing
  absolute (`/_app/...`) paths everywhere.
- **maplibre-gl's worker never made it into the production build.**
  maplibre-gl computes its worker's URL at runtime as
  `` new URL(`./${t}`, import.meta.url) `` (a template literal, picking
  dev vs. prod filename) - Vite's static asset analysis can't follow a
  dynamic path like that, so `maplibre-gl-worker.mjs` (and the
  `maplibre-gl-shared.mjs` it itself imports) never got emitted anywhere in
  `vite build`'s output. Silent failure: the main page fetched tiles fine
  (206 Partial Content) and threw no errors anywhere a page-level listener
  could see, because the failure happened *inside the worker's own
  context* when it tried to import a file that didn't exist. Fixed with a
  `postbuild` npm script (`app/scripts/copy-maplibre-worker.mjs`) that
  copies both files from `node_modules/maplibre-gl/dist/` into
  `build/_app/immutable/chunks/` - the one directory every chunk in the
  build lives in, so the relative import resolves regardless of which
  specific chunk maplibre-gl's code ends up bundled into.

Neither bug showed up in `npm run dev` (confirmed unaffected by any of
this - still works exactly as before) or in `vite build`'s own output/exit
code. Both only surfaced by actually serving the built `build/` directory
and hard-loading a deep-linked route in a real browser - `curl` checks and
a successful build were not enough.

### Testing alternatives

**Plan:** one branch per candidate, each with just the config that
candidate needs on top of the working static build (`app/build`), pushed
so the platform's own dashboard can connect to it directly. Whichever
actually serves the app correctly with the least fighting wins; the
others get deleted.

- [x] `deploy/netlify` — `netlify.toml` at repo root: build command
  `npm run build --workspace=app`, publish directory `app/build`. No
  adapter change needed. Netlify's `_redirects` handling matches what was
  originally assumed for Cloudflare (existing files win, redirects only
  apply to unmatched paths) — so the existing `app/static/_redirects`
  works as-is, no `/map/*`-scoping workaround required there (left scoped
  anyway — costs nothing, works under either semantics).
- [x] `deploy/vercel` — `vercel.json` with explicit `buildCommand` +
  `outputDirectory`, `framework: null` (skips Vercel's SvelteKit
  auto-detection, which assumes `adapter-vercel`). Vercel doesn't read a
  `_redirects` file, so the `/map/*` SPA fallback is a `rewrites` entry in
  `vercel.json` instead.
- [x] `deploy/github-pages` — `.github/workflows/deploy-pages.yml` (the
  official `actions/deploy-pages` flow, not a `gh-pages` branch push).
  One wrinkle none of the other candidates have: project repos serve from
  a **subpath** (`user.github.io/repo-name/`), not the domain root — added
  a `BASE_PATH`-driven `paths.base` in `vite.config.ts` (empty everywhere
  else, so it's a no-op off this branch) and fixed two places
  (`geoclickMap.ts`, `tour.ts`) where the app built absolute fetch URLs by
  hand without going through `$app/paths`, which would've silently 404'd
  under a subpath deploy. Still needs, before this branch can actually be
  tested: the repo made **public** (pre-approved by the user, but only
  once this branch is confirmed as the one being kept — not before) and
  Pages enabled with source "GitHub Actions" in repo settings.
- Replit and itch.io stay out of the branch trial for now — no confirmed
  Replit account, and itch.io isn't a comparable git-integrated CD target
  anyway (see ARCHITECTURE.md).

All three branches build and pass a full local verification (type-check,
lint, and a real browser pass — click-to-highlight popup, tour controls,
zero console errors) before being pushed.

### Netlify — chosen

Live: **[zesty-centaur-40e7c5.netlify.app](https://zesty-centaur-40e7c5.netlify.app/)**.
`netlify.toml` merged from `deploy/netlify` into `main`; `deploy/vercel`
and `deploy/github-pages` left as-is (their prep work stays valid if
ever needed later, e.g. if Netlify's free tier stops fitting).

Two setup snags, both ordinary dashboard configuration, not platform bugs
like Cloudflare's:

- **Every request 401'd**, redirecting to a Netlify login page. Not a
  password on the site — a team-wide "private by default" **visitor
  access** setting (`requiresSSOTeamLogin`) applied to all projects on
  the team. Once the user connected Claude to Netlify directly (their own
  MCP integration), found and fixed in one call:
  `netlify-project-services-updater` → `update-visitor-access-controls`
  with `requireSSOTeamLogin: false`. Far faster than hunting through
  dashboard settings by screenshot, the way the Cloudflare fixes had to
  happen.
- **After that, everything 404'd** — the site's production branch was
  `main` (no `netlify.toml` there), not `deploy/netlify`. Build
  command/publish directory showed as "Not set" in Site configuration →
  Build & deploy, confirming `netlify.toml` was never being read. Fixed
  by setting Production branch to `deploy/netlify` directly (more
  reliable than depending on auto-discovery from the right branch).

After both fixes: build log showed `netlify.toml` correctly detected,
`npm run build --workspace=app` and the `postbuild` worker-copy script
both ran, "Site is live". Verified against the live URL, not just the
build log: all three demo maps render, click-to-highlight and tour mode
both work with zero console errors, and — the thing that actually broke
Cloudflare — `.pmtiles` requests return real `206 Partial Content` with a
correct `Content-Range` header.

## Iteration 4 — Quiz engine (`packages/quiz-engine`)

**Deliverable:** After watching a tour, you can quiz yourself on it — drag
each region's name from a tray onto the region itself; it highlights while
the slip is over it, sticks (turns green) on a correct drop, and bounces
back with a shake if wrong (an error gets recorded, try again). Once every
slip is placed, a score panel shows how many were placed correctly on the
first try and the total mistake count.

Redesigned from the original flashcard-style plan (recognition:
highlight → guess name; recall: show name → click location) into a single
drag-to-match game instead — reuses the same click/highlight
infrastructure from Iterations 2-3, just triggered by drag-hover instead
of click, and reads as more of an actual *game* than a quiz form. The
original two-direction flashcard idea isn't gone, just deferred — nothing
here blocks adding it later as a second quiz mode.

- [x] `packages/quiz-engine`: pure session/scoring logic, no UI or map
      dependency — `createQuizSession`, `attemptMatch` (records a drag
      attempt: correct match, wrong drop, or dropped outside any region —
      all three recorded as an error except the match), `isSessionComplete`,
      `scoreSession` (`{ total, perfect, totalErrors }`, where "perfect"
      means placed with zero prior errors). 10 unit tests.
- [x] `QuizView.svelte` + `/map/[mapId]/quiz` route: Pointer Events (not
      HTML5 drag-and-drop — better touch support later, and lets the drag
      continuously hit-test the map via `queryRenderedFeatures` for the
      hover highlight) drive the whole interaction. Pointer capture is set
      on the slip element at `pointerdown` and never released mid-drag —
      the slip stays the *same* DOM node throughout (repositioned via CSS
      `position: fixed`, not swapped for a separate floating element),
      since removing/replacing the captured element mid-drag silently
      drops pointer capture.
- [x] Two new map feature-states in `base.json`, alongside the existing
      `highlighted` (explore/tour): `quizHover` (neutral blue — the region
      currently under a dragged slip; deliberately not colored by
      correct/incorrect, so hovering doesn't leak the answer) and
      `quizCorrect` (green, permanent once solved — takes priority over
      the other two).
- [x] "Start quiz" link from `MapView.svelte`, alongside "Start tour".
- [x] Manual test: full drag-and-drop flow verified with Playwright
      (`page.mouse` down/move/up sequences, not just clicks) — a correct
      drag placing a target and updating the counter, a wrong drag leaving
      the count unchanged and returning the slip to the tray, and a full
      16-target run on the Germany map ending with the score panel
      showing the right numbers.

### UX refinements found by actually playing it

Four friction points reported after real play, not caught by automated
testing (drag-and-drop mechanics pass/fail correctness, they don't
surface "this feels annoying"). Registered here before implementing, per
the user's request — design decisions, not just a task list:

- [x] **Slips shuffle randomly; alphabetical is easier to scan.**
      `createQuizSession` sorts by name instead of shuffling. Verified:
      first three slips on the Italy map are Abruzzo, Basilicata, Calabria.
- [x] **Small regions are hard or impossible to drop onto.** The drop
      hit-test currently requires the exact pixel to land inside the
      polygon — fine for Texas, unreasonable for Bremen. Fix: keep
      *hover* exact (precision while exploring where you are), but give
      the final *drop* a small tolerance — if the exact point misses but
      the correct region is within `DROP_TOLERANCE_PX` of it, count it as
      a hit anyway. Only applied in favor of the *correct* target, not as
      general slop for wrong ones. The 14px first guess turned out too
      tight — Bremen's own precomputed centroid (the same point used as
      the label anchor) is ~15-20px from its own simplified polygon at
      this zoom, confirmed directly via `queryRenderedFeatures` at
      increasing radii. Retuned to 24px, which covers it with margin.
- [x] **Wrong-drop feedback is weak, and finding the slip again is
      annoying.** Two changes: (1) stronger, longer shake on the slip
      itself (bigger amplitude, 450ms → 700ms, filled red background not
      just a border), plus a brief red flash on whichever region was
      actually (wrongly) dropped on, so the mistake reads clearly in two
      places at once; (2) the slip is never disabled while this plays out
      — the pause is purely visual pacing, not a retry lockout. Explicitly
      not implementing "pin the slip somewhere easy to find" — alphabetical
      ordering (above) already gives it a fixed, predictable position, and
      that's simpler than adding a second UI concept for the same problem.
- [x] **No way out of a slip you keep failing.** New quiz-engine concept:
      a third item status, `'revealed'` (alongside `'pending'`/`'correct'`),
      reached after `MAX_ATTEMPTS_BEFORE_REVEAL` (3) wrong drops on the
      same slip. It auto-solves — name shown, region colored a distinct
      muted gold rather than success-green, slip removed from the tray —
      and `scoreSession`'s `perfect` count correctly excludes it.
      `isSessionComplete` treats `'revealed'` the same as `'correct'` for
      completion purposes — a session can finish with some targets given
      up on, not just perfectly solved ones. The score panel names the
      count of revealed targets when there are any.

Threshold values (3 attempts, 24px tolerance, 700ms pause) came from one
round of hands-on testing, not rigorous tuning — still expect to revisit
if they feel off in practice.

**Follow-up fix (found after the above shipped):** dropping a slip outside
the map was being scored as a wrong attempt, since the hit-test simply
found no region under the pointer and treated "no region" the same as
"wrong region." First fix: skip `attemptMatch` entirely when the drop
point is outside the map container — no error, no wrong-flash, slip
returns to the tray untouched.

That first fix missed the actual common case, though: the tray is
`position: absolute; bottom: 0`, sitting *on top of* the bottom strip of
the map container, not below it — so dragging a slip back down onto the
tray (the natural "changed my mind" gesture) still counted as a drop
*inside* the map, and still scored as wrong. Second fix: also treat a
drop point over the tray's own bounding rect as a cancel, checked
separately from the map-container check. Verified via Playwright with a
drag that goes up into the map and back down onto the tray (not just off
the page): slip returns to the tray, no error, no wrong-flash.

Third fix, same underlying issue in a different spot: dropping anywhere
*inside* the map that isn't on or near a region — open sea, gaps between
regions, map padding — was still scored as wrong, because the drop
handler called `attemptMatch` whenever the exact/tolerance hit-test
didn't find the *correct* region, without checking whether it found *any*
region. Now a drop only counts as an attempt at all if the hit-test finds
some region (exact point or within `DROP_TOLERANCE_PX`) — otherwise it's
treated the same as the tray/outside-map cancel case: no error, slip back
to the tray. A drop that actually lands on a different (wrong) region
still counts, unchanged. Verified via Playwright: a drop confirmed via
`queryRenderedFeatures` to have no region within tolerance leaves the
placed count and tray untouched; the existing reveal-after-3-wrong-drops
test (which drops on an actual wrong region) still passes, confirming
genuine wrong guesses still count.

**Verified:** quiz-engine's 14 unit tests (including the new `'revealed'`
transition and its interaction with `scoreSession`/`isSessionComplete`),
plus Playwright against the actual drag interaction: alphabetical order
confirmed on the Italy map, Bremen's own centroid now lands successfully
(previously missed pre-fix — the exact regression this was meant to fix),
and 3 wrong drops on the same slip auto-reveal it with the muted styling
and correct tray/counter bookkeeping.

**Deliverable:** Quiz sessions now prioritize what you're about to forget
instead of a random shuffle — mistakes resurface sooner, correct answers
space out further. This is the Anki-style hook that differentiates Geoclick
from a one-off quiz.

- [ ] SM-2 scheduler implementation + unit tests
- [ ] `rate(cardId, grade) -> nextDueDate` interface
- [ ] Session composer upgrade: mix due cards + new cards (Anki-style)

## Iteration 6 — Local persistence

**Deliverable:** Close the app and reopen it — progress, due cards, and
stats are still there. Turns the demo into something you'd plausibly use
across multiple sessions, not a one-shot toy.

- [ ] Repository interface (maps, progress, card state), decoupled from
      platform
- [ ] SQLite implementation for Tauri; `sql.js`/IndexedDB fallback for
      plain-browser dev
- [ ] Wire quiz/SRS state through the repository; persists across restarts

## Iteration 7 — Desktop POC packaging (milestone)

**Deliverable:** A double-click-to-install desktop app containing all three
demo maps, with working tour, quiz, and persistent progress. This is the
thing you hand someone to try. **The POC milestone.**

- [ ] Tauri project wrapping `/app`
- [ ] Bundle PMTiles + `map.json` assets into the app
- [ ] Wire local SQLite storage plugin
- [ ] Build a local installer
- [ ] End-to-end run: tour → quiz → close app → reopen → progress persisted
- [ ] **This is the POC deliverable** — demo-able artifact

---

## Iteration 8+ — Post-POC (not yet scoped in detail)

**Deliverable:** to be scoped once the POC validates that the tour → quiz
loop actually feels good. Candidates below, in rough priority order.

- [ ] Map editor UI (author maps/tours without hand-editing JSON)
- [ ] Mobile packaging via Capacitor
- [x] ~~Plain-browser deployment (static hosting)~~ — done in Iteration 3.5,
      live on Netlify
- [ ] **Sign-in (Google + other OAuth providers)**, as the prerequisite for
      recording scores per user per map. This is the point where "local-
      first, no backend" (see ARCHITECTURE.md's Storage section) actually
      gets a backend — auth needs somewhere to verify tokens and mint
      sessions, even if score storage itself stays minimal. Candidates:
      - A managed auth provider (Auth0, Clerk, Supabase Auth) — fastest to
        stand up, handles the OAuth dance and Google/other-provider config
        for you; adds a third-party dependency and (usually) a paid tier
        past some usage threshold.
      - Roll it via Netlify Identity or a small serverless function
        handling the OAuth callback directly — more control, more to
        build and maintain, but keeps everything inside the stack already
        in use (Netlify's already hosting this).
      Needs a decision before building, not just picking one silently —
      revisit when this iteration actually starts.
- [ ] **Score recording**, built on top of sign-in: per (user, map)
      results from quiz sessions (`scoreSession`'s `{ total, perfect,
      totalErrors }` already has the shape this needs), persisted
      somewhere durable rather than local-only. Which store depends on
      what the auth choice above already provides (several bundle a
      database) — another decision for when this iteration starts, not
      now.
- [ ] **Evaluate GUI/UX approaches to make the interface more captivating.**
      Right now the app is functional but plain (system-font UI chrome,
      flat map, no motion beyond the wrong-drop shake) — differentiating
      from Seterra was an original goal (see ARCHITECTURE.md's intro) and
      visual polish is part of that, not just the tour/quiz mechanics.
      Needs research before picking a direction, not a straight
      implementation task:
      - A component/design library (or a curated custom design system) for
        consistent, less "default browser" chrome.
      - Motion/feedback design beyond the current shake-on-wrong: reveal
        animations, progress/streak indicators, sound (optional/mutable),
        possibly a lightweight game-feel pass (juiciness) on correct drops.
      - Map styling itself — base.json is currently a flat functional
        palette; a more distinctive cartographic style (custom fills,
        terrain/hillshade, dark mode) could be a differentiator on its own.
      - Whatever's chosen needs to survive Tauri/Capacitor packaging later
        (Iteration 7/8+) and not fight MapLibre's rendering model.
      Revisit once the core loop (tour → quiz → score) is validated —
      polish before the mechanics are proven risks wasted work.
