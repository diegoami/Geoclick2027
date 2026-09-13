# Geoclick — Handover for independent review

This document exists for a single purpose: brief a reviewer who has never
seen this project before, so they can do a **code review, sanity check,
and design-issues pass**, and hand back a **prioritized task list** —
without needing back-and-forth with whoever built the thing.

Nothing in this file is meant to be defended. If something described here
as a "deliberate decision" looks wrong once you actually read the code,
say so — the point of asking for outside eyes is to catch exactly that.

## What Geoclick is

A geography-learning game: SvelteKit + MapLibre GL JS + PMTiles vector
tiles. A user picks a country's map, watches a guided tour of its
regions/cities, then plays a drag-the-name-onto-the-region quiz with
spaced repetition (SM-2) so mistakes resurface sooner than things already
known. Local-first: progress is stored on-device (`localStorage` in the
browser, SQLite when packaged as a desktop/mobile app), no backend, no
accounts, in production today. Ships as a web app (Netlify), a Tauri
desktop app (Windows/Linux installers), and a Capacitor Android APK
(POC), all three wrapping the same SvelteKit build.

Solo-developer-plus-AI project: one human (product manager, makes all
product/scope calls) and Claude Code (developer). There is no team, no
existing code-review process, no CI beyond what's described below — this
review is effectively the first outside look at the codebase.

## Where everything actually lives — read these first

Docs are current and were actively maintained throughout, not written
once and abandoned. Suggested reading depth in parentheses:

- **`CLAUDE.md`** (read in full, ~90 lines) — the workflow rules this
  project is run under: branch-per-feature, only merge to `main` on
  explicit user approval (a `main` push triggers a real Netlify build
  that costs credits), doc-maintenance obligations, commit trailer
  format. Any review of *process*, not just code, should start here.
- **`ARCHITECTURE.md`** (read in full, ~290 lines) — system design: how
  the map pipeline, the SvelteKit app, the quiz engine, and the three
  storage backends fit together. This is the one doc to trust for
  "how is this actually structured" over inferring it from source.
- **`DECISIONS.md`** (read in full, ~645 lines, but it's terse bullet
  points, not prose) — the *why* behind product/design choices, in
  chronological sections. This is where "was this actually a considered
  decision, or just what happened" gets answered — cross-check a few of
  its claims against the actual code rather than taking them on faith.
- **`ROADMAP.md`** (skim; read the **Status** section at the top in
  full, spot-check a few iteration sections that interest you) — the
  iteration-by-iteration build log, including bugs found and fixed along
  the way. Long and somewhat repetitive by design (it's a working log,
  not a polished doc) — don't read it end to end.
- **`ONBOARDING.md`** (skim the "Gotchas that have already cost real
  time" section in full, ~419 lines total) — written for a hypothetical
  junior dev picking up small tasks. Worth checking whether it's
  actually still accurate, since staleness there would bite a real
  future contributor.
- **`MAPS.md`** (skim) — the map-data build pipeline: exact commands,
  per-country name-fixup tables, what's planned next for map authoring.
- **`README.md`** — brief, probably not much beyond what's above.

## Current state on `main` (what you're reviewing)

Live and shipped: 22 countries, 44 maps (corrected by GC-060 — this
handover originally said "14 countries", an error the review itself caught
as S2) (regions/states/provinces plus a
population-thresholded towns map per country), tour mode, the quiz
engine with SM-2 spaced repetition, local persistence, a visual refresh
(background color, opacity-based solved/unsolved contrast on the map),
UI in English/German/Italian, and packaging as a web app (live on
Netlify), a Tauri desktop app, and a Capacitor Android APK (POC quality,
not yet fully click-tested on a real device this cycle).

**Explicitly paused, not on this branch, not merged, and out of scope
for this review**: a Supabase-backed optional-sign-in / cross-device-sync
feature, fully built and reconciled with `main` on a separate branch
(`feature/supabase-sso-sync`), then deliberately deferred by the product
owner until there's a concrete plan to buy a domain, go public, and
publish to an app store (see `DECISIONS.md`'s "SSO/cross-device sync
deferred" entry). Mentioned here only so you don't wonder why an
auth-shaped gap exists in the local-first architecture — it's not an
oversight, and it's not part of what you're reviewing.

## What's actually being asked for

Four things, in this order:

1. **Code review** — correctness, code quality, obvious bugs, anything
   that looks fragile. You have full read access to the repo; read
   actual source, don't infer quality from the docs' own claims about
   itself.
2. **Sanity check** — does the system actually work the way the docs
   say it does? Pick a few specific claims from `ARCHITECTURE.md` /
   `DECISIONS.md` and verify them against the code rather than trusting
   them. Run the test suite and the build yourself rather than trusting
   this document's word that they pass (see "What you can run" below).
3. **Design issues** — architecture, API shape, coupling, anything that
   will make the *next* feature harder than it should be. This project
   has taken on real structural debt in a few places by its own
   admission (see "Known soft spots" below) — form your own opinion on
   whether those trade-offs were the right call, and look for others
   nobody's flagged yet.
4. **A prioritized task list** — concrete, actionable items a developer
   (human or AI) could pick up one at a time. Not "consider improving
   test coverage" — name the file, the gap, and what a first step looks
   like. Separate "must-fix" from "worth doing" from "nice-to-have, low
   value."

## Known soft spots (flagged by the project itself — verify, don't just repeat)

Listed here so you spend your time verifying and going deeper, not
rediscovering what's already suspected. Each is a real, specific claim —
check it against the code:

- **No automated end-to-end/UI regression suite exists.** Every
  "verified via Playwright" note throughout `ROADMAP.md` describes a
  one-off manual script run during that feature's development, not a
  committed test that runs on subsequent changes. The only thing that
  runs repeatably is `npm run test` — 41 Vitest unit tests total, all in
  `packages/quiz-engine`, `packages/srs`, and `app`'s own repository
  layer. There is no Playwright config or `.spec.ts` file checked into
  the repo at all. Confirm this, and assess how much risk it represents
  given the app's actual complexity (drag-and-drop hit-testing, MapLibre
  feature-state, three storage backends).
- **SQLite schema exists in two hand-mirrored, non-shared
  implementations** — `desktop/src-tauri/src/lib.rs`'s `migrations()`
  for Tauri, and `app/src/lib/capacitorProgressRepository.ts` for
  Capacitor — because, per `ONBOARDING.md`, "Capacitor has no equivalent
  of Tauri's single `migrations()` function to keep both in sync
  automatically. If you change one schema, change the other." That's an
  honest admission of a manual-sync risk with no test or lint enforcing
  it. Is this actually a problem worth solving, or fine for a two-backend
  POC?
- **Per-country name-fixup tables (`NAME_FIXUPS`) are hardcoded in
  `data/scripts/build-map.ts`/`build-points-map.ts`**, growing by a few
  entries with every new country batch. `ROADMAP.md`'s own Iteration 8+
  backlog already flags this as needing to become data-driven before a
  non-developer could add a country. Assess whether it's actually
  urgent yet, or premature to fix before it hurts.
- **The 8-color categorical map palette is a `["%", ["length",
  ["get", "name"]], 8]` name-length hash** (`data/styles/base.json`) —
  i.e., two regions can collide on the same color if their names happen
  to be the same length mod 8, with no collision detection. A real,
  recent bug from this exact family (a muted teal-green visually close
  to the solved-state green, fixed via opacity in `DECISIONS.md`'s
  "Quiz solved-state contrast" entry) suggests this hashing approach may
  have other undiscovered collisions on some of the 44 maps. Worth
  actually computing hash values for a large map's regions and checking
  for adjacent same-color collisions, not just trusting that it "looks
  fine" on the maps that have been eyeballed so far.
- **The i18n system is a hand-rolled `TranslationKey` union + `t()`
  helper** (`app/src/lib/i18n.svelte.ts`), deliberately not a library —
  reasoning is in `DECISIONS.md`'s i18n entry. Sanity-check whether that
  reasoning still holds (string count, growth rate) or whether it's
  already past the point where a library would pay for itself.
- **Map/target data pipeline requires WSL2 + a Linux-only toolchain**
  (`ogr2ogr`, `tippecanoe`, `pmtiles` CLI) on this Windows dev machine —
  not evaluated here for whether that's a design issue worth solving
  (e.g. a Docker container, a hosted build step) versus an accepted cost
  of a solo project's tooling.
- **Netlify build-credit cost gates all `main` merges** — every
  workflow rule in `CLAUDE.md` about branch-first development and never
  merging without explicit approval traces back to this one constraint.
  Worth asking whether that constraint still makes sense at this
  project's current size/cadence, or whether it's now overly
  conservative.

Feel free to disagree with how any of the above is framed, dismiss ones
that turn out to be non-issues, and add ones this list missed entirely —
this is a starting point for your own investigation, not a checklist to
confirm.

## What you can actually run (verify claims, don't just read them)

From the repo root (`npm` workspaces: `app`, `packages/quiz-engine`,
`packages/srs`, `desktop`, `mobile`):

```bash
npm install                 # if node_modules isn't already present
npm run check                # svelte-check / typecheck across workspaces
npm run test                  # 41 Vitest unit tests (quiz-engine, srs, app)
npm run lint                  # ESLint, app workspace
npm run build --workspace=app  # production build of the web app
```

The web app's dev server (`npm run dev --workspace=app`, port 5173) is
the fastest way to actually click through the product yourself — do
this before forming opinions about UX/design, not just from reading
`.svelte` files.

Desktop (`desktop/`, Tauri) and mobile (`mobile/`, Capacitor) each wrap
the same `app/build` output but need their own native toolchains (Rust,
Android Studio/Gradle) — not required for this review unless you want to
go that deep; `ONBOARDING.md` has the exact commands and gotchas if so.

## Ground rules for this review

- **This is a read-only review.** Don't push anything, don't merge
  anything, don't trigger a Netlify deploy. If you want to demonstrate a
  fix, describe it or show a diff — don't commit it.
- **Nothing here is a request for new features.** Scope is limited to
  reviewing what exists on `main` as of this handover (commit at branch
  point: see `git log -1` on `docs/code-review-handover`'s parent).
  The paused SSO branch is explicitly out of scope (see above).
- **Report findings directly to whoever is running this session** — you
  don't need to write your output back into this repo; a plain-text or
  markdown report is fine wherever this session's output naturally goes.

## One honest caveat about this document

This handover was written by the same AI (Claude) that built most of the
project being reviewed, working from the project's own documentation and
a re-check of a few specific claims (test counts, file existence) done
just before writing this. It was not written by someone with adversarial
distance from the code. Treat every claim of "this was a deliberate
decision" as worth re-litigating, not as settled — that's the entire
point of getting a second, independent opinion.
