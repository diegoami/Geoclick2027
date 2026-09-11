# Geoclick — working notes for Claude

Geography learning game. See [ARCHITECTURE.md](ARCHITECTURE.md) for system
design, [ROADMAP.md](ROADMAP.md) for the iteration plan, current status,
and per-iteration deliverables, [ONBOARDING.md](ONBOARDING.md) for a
running guide aimed at a new/junior contributor picking up small tasks,
[DECISIONS.md](DECISIONS.md) for a scannable log of *why* things work
the way they do — product/design decisions and the reasoning behind them,
separate from this file's workflow rules — and [MAPS.md](MAPS.md) for the
map-creation process: the exact build command behind every map currently
shipping, and what's planned next.

## Workflow

- New features/fixes: work on a branch, not directly on `main`. Commit and
  push the branch without asking first. Test locally and report concrete
  verification steps so the user can test it themselves too. Only merge
  to `main` after the user explicitly OKs it — `main` pushes trigger a
  real Netlify build (which costs credits), so nothing lands there
  without the user having tried it first. Small doc-only changes
  (ROADMAP.md/ARCHITECTURE.md/CLAUDE.md edits with no app code) can still
  go straight to `main`.
- Keep ROADMAP.md up to date: check off tasks as they land, update the
  Status section, and adjust deliverables if scope shifts mid-iteration.
- Update ARCHITECTURE.md as part of finishing each iteration — not just
  the original design doc, keep it a real map of how the code is
  organized as it grows. This is how the user (who isn't reading the code
  directly) keeps a grasp of it.
- Keep ONBOARDING.md current too: if a change adds a new gotcha, moves
  where something important lives, or changes the day-to-day workflow,
  reflect it there — it's written for a hypothetical junior dev and goes
  stale the same way ROADMAP.md/ARCHITECTURE.md would if left alone.
- Record product/design decisions in DECISIONS.md as they're made —
  not just what was built (that's ROADMAP.md's job) but *why*, in a
  form that's quick to scan later without digging through iteration
  prose. When a later decision corrects or supersedes an earlier one,
  update that entry rather than leaving a stale one to be found first.
- Keep MAPS.md current whenever a map gets built or the pipeline
  changes: record the exact command that produced a new map (not just
  that it exists), and keep the "planned" section honest — move an
  entry out once it's actually shipped rather than leaving it listed as
  upcoming.
- Roles: the user is Product Manager, Claude is Developer. When an
  iteration's deliverable is complete, don't just declare it done — give the
  user concrete steps to verify it themselves (what to run, click, or look
  at, and what result to expect).
- Treat "test locally" and "test the deployment" as two separate,
  explicitly labeled steps whenever both apply — never let a deploy
  problem read as a feature problem or vice versa. Verify locally first
  (dev server, or a production build served locally) and say so
  explicitly; only then check the live site, and say that explicitly too.
  Reason: the Iteration 4 quiz shipped correctly and passed every local
  check, while Netlify kept serving a stale build from a stuck production
  branch setting — conflating the two wasted real time chasing a "why
  doesn't the feature work" question that was actually "why hasn't this
  deployed."
- Don't go down debugging rabbit holes (digging through webhook configs,
  CLI internals, package source, etc.) when the issue can just be fixed
  manually by the user in a couple of clicks — e.g. a dashboard setting,
  a manual "trigger deploy" button. Try the direct/available tool once or
  twice; if that doesn't resolve it cleanly, say so and hand it back to
  the user rather than escalating into deeper investigation on my own.
  Reason: spent real time digging into Netlify's zip/symlink internals
  and GitHub webhook delivery logs to diagnose a stuck deploy, when the
  user could (and did) just click "Trigger deploy" in the dashboard and
  it worked immediately.
- Netlify builds cost credits on the plan in use — don't trigger deploys
  (via the MCP `deploy-site` tool or otherwise) just to check something or
  as a debugging step. Push to `main` and let the normal git-triggered
  build handle it; only prod-check the live site once, after you're
  already confident the local build is correct. If a deploy needs
  triggering manually (e.g. auto-deploy seems stuck), that's the user's
  call to make from the dashboard, not something to do repeatedly on your
  own initiative.

## Stack

- SvelteKit (frontend/app shell)
- MapLibre GL JS + PMTiles (map rendering, vector tiles)
- Tauri (desktop packaging), Capacitor (mobile packaging) — planned, not
  yet scaffolded
- Local-first storage: SQLite (Tauri plugin / Capacitor plugin), no backend
  for the POC
- Map source data: Natural Earth (public domain)

## Commit messages

End every commit with:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
