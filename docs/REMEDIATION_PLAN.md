# Geoclick — Remediation Plan

Executable programme derived from the independent code review (2026-09-13).
**19 tasks, 5 waves, 3 tagged releases, one engine, one agent, no GitHub.**
Machine-readable source of truth: [`tasks.yaml`](tasks.yaml).
Execution model: [`ORCHESTRATION.md`](ORCHESTRATION.md).
Release policy: [`RELEASES.md`](RELEASES.md).

**This file is the roadmap and the progress ledger. `tasks.yaml` is what the
harness reads.** If they disagree, `tasks.yaml` wins and this file is stale.

> **Third draft (2026-09-13).** Draft 1: 20 tasks, GitHub issues, four engines,
> `release/*` buffering. Draft 2: local harness, two engines, `main` as the
> integration branch, nice-to-have tier dropped. Draft 3 is the product owner's
> final scale-down — *"just Opus do the change alone, no two steps required, no
> multi agent, just loop"* — plus two reversals: the **nice-to-have tier is back
> in** ("do those, if they are low effort") and **zombie hygiene is an explicit
> requirement**. What changed and why is tabulated at the bottom.

## Ground rules inherited from CLAUDE.md

- One branch per task, merged **straight into `main`**. No `release/*` branches:
  Netlify build cost was confirmed not to be a real constraint (2026-09-13).
- **Automerge** (product owner, 2026-09-13, after GC-001): the loop merges each
  task itself once all four gates are green and every DoD item is verified,
  and reports the merge. Release tags still wait for the product owner's OK.
  Full rules: [ORCHESTRATION.md § Automerge](ORCHESTRATION.md#automerge).
- One agent, one task at a time, in the main checkout. No subagents.
- Every commit ends with the attribution trailer
  (`meta.attribution_trailer` in `tasks.yaml`).
- No agent triggers a deploy, and nobody monitors deploys.
- Nothing in this programme lives on GitHub: no issues, labels, milestones, PRs
  or Releases.

## Quality gate

Every task's definition of done includes the same four commands:

```
npm run check                  # svelte-check + tsc across workspaces
npm run test                   # Vitest: quiz-engine, srs, app
npm run lint                   # prettier --check && eslint
npm run build --workspace=app  # production build + postbuild worker copy
```

`node scripts/task.mjs gates` runs all four in order and stops at the first
failure. With no separate reviewer and, since the automerge change, no
per-merge human review (see ORCHESTRATION.md), **these four plus the written DoD
are the review** — with `/code-review` added on the two High-effort tasks.

**Honest baseline as of `c5c786e` / `v0.1.0`:** `check`, `test` and `build`
pass. **`lint` fails** (exit 1) — `core.autocrlf=true` plus a `.gitattributes`
that only covers `*.sh`/`gradlew`/binaries means Prettier flags all 39 files on
line endings, and because the script is `prettier --check . && eslint .`,
**ESLint has never actually run**. Three files are also genuinely unformatted.
That is why GC-001 is wave 0 and lands alone.

Until GC-001 merges, the gate for GC-001 itself is "`lint` must newly pass".
For every other task the gate is "all four pass".

## Waves and the dependency DAG

A wave is the earliest position in the DAG a task can start, and — since the
loop is sequential — the order in which tasks are worked. A wave boundary exists
only where tasks touch the same files; nothing is serialized for taste. Waves
are also the release batching unit ([RELEASES.md](RELEASES.md)).

```
WAVE 0  ── GC-001  lint gate        (renormalizes line endings tree-wide;
              │                      conflicts with every branch — lands alone)
WAVE 1  ┌─────┘
        ├─ GC-002  gate script + pre-push hook
        ├─ GC-003  test harness (browser Vitest project + scaffold deleted)
        ├─ GC-010  SRS scheduler correctness
        ├─ GC-020  QuizView lifecycle safety (+ $state, DEV guard)
        ├─ GC-030  map-data integrity test + generated index
        ├─ GC-040  Capacitor schema migrations
        ├─ GC-050  <html lang> sync
        ├─ GC-060  doc count reconciliation
        ├─ GC-070  base-path asset fetches
        └─ GC-080  pmtiles storage ADR            (ships in v0.2.0, not v0.1.1 -
                                                     product-owner override, see
                                                     RELEASES.md; DAG-ready here)
                                          │
WAVE 2  ┌─────────────────────────────────┘
        ├─ GC-021  extract resolveDrop            (needs 020, 003)
        ├─ GC-031  build-script hygiene           (needs 030)
        ├─ GC-041  repository clear/reset         (needs 040)
        └─ GC-071  home page due-count rework     (needs 070, 030)
                                          │
WAVE 3  ┌─────────────────────────────────┘
        ├─ GC-004  data/scripts tsconfig + lint   (needs 001, 031)
        ├─ GC-022  popup setText + CSS dedup      (needs 021)
        └─ GC-032  adjacency-aware map palette    (needs 030, 031)
                                          │
WAVE 4  └─ GC-033  tour dwell tuning              (needs 031, 022)
```

Ten tasks are startable the moment GC-001 lands. The loop does them one at a
time in wave order — `node scripts/task.mjs next` picks lowest wave first, then
declaration order.

### Worktree parallelism: settled, and now moot

Draft 1 opened with a blocking spike (`GC-000`) to prove worktree parallelism
worked here, since `ROADMAP.md` recorded it failing on 2026-09-12. **It was run
and passed** — see ROADMAP.md's *"Git worktrees failed … RESOLVED 2026-09-13"*
entry: a worktree with its own `npm install` (~16s) serves tiles through the
maplibre-gl worker identically to the main checkout.

Draft 3 does not use worktrees at all — one agent needs one checkout — so the
finding is now history rather than a dependency. GC-000 stays deleted, and
`task.mjs doctor` reports any other worktree but never removes it — another
session (e.g. the product owner's planning session) may be working in it.

### Why each serialization exists (file-level conflicts)

| Edge | Shared file(s) |
|---|---|
| `GC-001 → everything` | every `*.ts` / `*.svelte` / `*.json` in the tree (line-ending renormalization) |
| `GC-020 → GC-021 → GC-022 → GC-033` | `app/src/lib/QuizView.svelte`, then `TourView.svelte` |
| `GC-003 → GC-021` | `app/vite.config.ts` — GC-021's new suite needs the harness GC-003 restores |
| `GC-030 → GC-031 → GC-032` | `data/scripts/build-map.ts`, `build-points-map.ts`, `data/maps/*/map.json` |
| `GC-031 → GC-004` | `data/scripts/*.ts` must stop changing before a strict tsconfig is written over it |
| `GC-031 → GC-033` | `data/scripts/*` dwell constants |
| `GC-030 → GC-071` | `app/src/lib/mapCatalog.ts` / the generated map index |
| `GC-040 → GC-041` | `app/src/lib/capacitorProgressRepository.ts` |
| `GC-070 → GC-071` | `app/src/routes/+page.svelte` (GC-071 deletes the fetch GC-070 fixes) |

`QuizView.svelte` is 909 lines and remains the biggest serialization cost —
four tasks queue behind it. That is itself the argument for GC-021.

## Engine

**One engine: `opus` (`claude-opus-5`), for every task and for the loop
itself.** The product owner's direction: *"for complex tasks let us Opus do
them, or maybe let us just Opus do the change alone, no two steps required, no
multi agent, just loop."*

| | Draft 1 | Draft 2 | Draft 3 |
|---|---|---|---|
| Engines | haiku, sonnet, opus, fable | sonnet + opus | **opus** |
| Agents per task | implementer + reviewer (+ orchestrator) | implementer + reviewer | **one** |
| Review | cold-context agent, 2 rounds | cold-context agent, 2 rounds | gates + the product owner |

The cost argument that motivated draft 2's cheap tiers is weaker than it looks
here: this programme's total is 19 tasks, most of them Low or Medium, and the
expensive part of a mixed-engine design was never the tokens — it was the
handoffs, the routing decisions, and a whole orchestration layer whose only job
was to keep several agents from colliding. One Opus agent in a loop deletes all
of that, and `engine:` stays in `tasks.yaml` only so the field means something
if the roster ever grows again.

## Effort scale

| Level | Means |
|---|---|
| Low | < 1h agent time, one or two files, no design decision. |
| Medium | A few files plus tests; one contained decision the task spec already makes. |
| High | Multi-file refactor or a real design choice with alternatives to weigh. |
| Ultrahigh | Irreversible, or requires regenerating committed binary artefacts, or needs a toolchain not on the default machine. |

**Nothing in this plan is Ultrahigh.** The two candidates are excluded by
scope: GC-080 writes an ADR and executes no migration, and GC-032 is explicitly
forbidden from retiling (it escalates instead).

Effort is also the gate the nice-to-have tier came back through: the product
owner restored it *"if they are low effort"*, and all eleven items were Low in
draft 1's own estimate. None of them is a design question.

## Task roster

Full descriptions and definitions of done are in [`tasks.yaml`](tasks.yaml) —
that is what the loop reads. This table is the index.

| ID | Title | Effort | Wave | Deps | Release | Tier | Review § |
|---|---|---|---|---|---|---|---|
| GC-001 | Repair the lint gate (`.gitattributes` + renormalize + format) | Medium | 0 | — | v0.1.1 | must-fix | S1, #3 |
| GC-002 | Gate runner script + pre-push hook | Low | 1 | 001 | v0.1.1 | worth-doing | D7, #15 |
| GC-003 | Test harness: browser Vitest project, scaffold deleted | Medium | 1 | 001 | v0.1.1 | worth-doing | D1, #11, #20 |
| GC-004 | `data/scripts` tsconfig + lint coverage | Low | 3 | 001, 031 | v0.2.0 | nice-to-have | #25 |
| GC-010 | SRS: cap interval, let ease recover | Medium | 1 | 001 | v0.1.1 | must-fix | C1, C2, C3, S3, #1, #2, #19 |
| GC-020 | QuizView lifecycle safety, `$state` bindings, DEV-guard `window.__map` | Medium | 1 | 001 | v0.1.1 | must-fix | C4, C5, C6, #4, #5, #6, #23, #24 |
| GC-021 | Extract and test `resolveDrop` | High | 2 | 020, 003 | v0.1.2 | worth-doing | D8, #10 |
| GC-022 | Popup `setText` + popup CSS dedup | Low | 3 | 021 | v0.2.0 | worth-doing | C8, #17, #21 |
| GC-030 | Map-data integrity test + generated map index | Medium | 1 | 001 | v0.1.1 | must-fix | C7, C11, #7 |
| GC-031 | Build-script hygiene (`PMTILES_BIN`, slugify, bbox flag) | Low | 2 | 030 | v0.1.2 | nice-to-have | #22, #27, #28 |
| GC-032 | Adjacency-aware map palette + opacity revisit | High | 3 | 030, 031 | v0.2.0 | worth-doing | D4, #8 |
| GC-033 | Tour dwell tuning for large maps | Low | 4 | 031, 022 | v0.2.0 | nice-to-have | #30 |
| GC-040 | Capacitor SQLite schema migrations | Medium | 1 | 001 | v0.1.1 | worth-doing | D2, #9 |
| GC-041 | `clearMap`/`clearAll` + localStorage write guard | Medium | 2 | 040 | v0.1.2 | worth-doing | D10, #16, #26 |
| GC-050 | Sync `<html lang>` to the selected language | Low | 1 | 001 | v0.1.1 | worth-doing | C13, #12 |
| GC-060 | Reconcile stale doc counts and dangling references | Low | 1 | 001 | v0.1.1 | worth-doing | S2, S4, #18 |
| GC-070 | Route asset fetches through SvelteKit `base` | Low | 1 | 001 | v0.1.1 | worth-doing | C12, #14 |
| GC-071 | Home page: stop fetching all 44 `map.json` | Medium | 2 | 070, 030 | v0.1.2 | worth-doing | C9, #13 |
| GC-080 | ADR: pmtiles storage strategy (Git LFS or not) | Low | 1 | 001 | v0.2.0 | nice-to-have | D12, #29 |

**Distribution** — effort: Low 9, Medium 8, High 2, Ultrahigh 0.
Tier: must-fix 5, worth-doing 9, nice-to-have 5. Engine: opus, all 19.

### Review-item coverage

**All 30 punch-list items from `CODE_REVIEW_2026-09-13.md` are assigned** — the
7 must-fix, the 12 worth-doing, and, since the product owner restored them, the
11 nice-to-haves. Items merged into one task: 1+2+19 → GC-010;
4+5+6+23+24 → GC-020; 11+20 → GC-003; 17+21 → GC-022; 22+27+28 → GC-031;
16+26 → GC-041; 7+13(index half) → GC-030.

Per CLAUDE.md, any task that makes a product or design decision writes its own
`DECISIONS.md` entry as part of its DoD rather than deferring it to a docs task.

### The nice-to-have tier: dropped in draft 2, restored in draft 3

Direction: *"Ok the nice to have, do those, if they are low effort."* All eleven
qualify — each was Low in draft 1's estimate, most are one-liners, and five of
them sit inside a file another task already opens, so they cost a line of diff
rather than a task.

| Item | What | Lands in |
|---|---|---|
| #20 | Delete `app/src/lib/vitest-examples/` scaffold | GC-003 |
| #21 | Popup CSS dedup into `app.css` | GC-022 |
| #22 | `PMTILES_BIN` instead of a hardcoded `$HOME` path | GC-031 |
| #23 | `$state` on three `bind:this` targets (3 svelte-check warnings) | GC-020 |
| #24 | `import.meta.env.DEV` guard on `window.__map` | GC-020 |
| #25 | `tsconfig` + lint for `data/scripts` | GC-004 |
| #26 | try/catch around `localStorage.setItem` | GC-041 |
| #27 | Escaped code-point range in `slugify` | GC-031 |
| #28 | `crossesAntimeridian` flag for Chukotka's inverted bbox | GC-031 |
| #29 | Git LFS decision for `*.pmtiles` (ADR only) | GC-080 |
| #30 | Target-count-aware tour dwell | GC-033 |

Two were worth a second look before approval, and both are now resolved:
**#24** closes a real production leak (`window.__map` currently ships to every
user) and stays in GC-020/`v0.1.1` as originally scoped. **#29** (GC-080) is a
decision document rather than a fix — it is Low effort because it executes
nothing, but it is the one item whose value is "the question stops being open"
rather than "a defect is gone" — and the product owner asked to hold it for
the closing milestone instead of shipping it with the real fixes in `v0.1.1`.
It stays DAG-ready at wave 1 (nothing blocks it, nothing depends on it) but
now ships in `v0.2.0`. See [RELEASES.md](RELEASES.md).

**Still dropped: GC-000** (the worktree spike — already proven, and moot now
that the loop uses no worktrees). Nothing else.

## Release map

Local git tags plus `CHANGELOG.md` entries — no GitHub Releases or milestones.
A batch is a completed wave; full reasoning in [RELEASES.md](RELEASES.md).

| Release | Batch | Tasks | Why that number |
|---|---|---|---|
| `v0.1.1` | waves 0 + 1 | 001, 002, 003, 010, 020, 030, 040, 050, 060, 070 | Repairs and developer tooling against shipped behaviour ⇒ PATCH. |
| `v0.1.2` | wave 2 | 021, 031, 041, 071 | Internal extraction, build hygiene, new repository methods, a perf fix ⇒ PATCH. |
| `v0.2.0` | waves 3 + 4 + close | 004, 022, 032, 033, 080 | **Milestone.** The visible half (palette legibility, watchable tours, popup safety) plus the programme's close-out ⇒ MINOR. |

`v0.2.0` is the closing milestone and the release the product owner ships. It is
deliberately *not* `1.0.0`: DECISIONS.md's SSO-deferral entry reserves that for
the real public launch (domain, app-store submission). Its identity line:
**"known issues from the Sept 13 review resolved."**

## Progress ledger

**This table is the programme's public status.** The loop ticks a row at step 11
of every iteration, in the same commit series as the merge; the
`.orchestrator/state/*.json` files are gitignored and machine-local, so this is
the only place progress is durable and readable without running anything.

Status values: `todo` → `in progress` → **`merged`** → `released`. Also
`escalated` when two attempts failed and the product owner owns the task, and
`blocked` when a DoD item cannot be verified on this machine (see
ORCHESTRATION.md § Automerge).

| ID | Status | Merged (commit) | Released in | Notes |
|---|---|---|---|---|
| GC-001 | **released** | `e619571` | v0.1.1 | lint passes for the first time; catch-all placed first in `.gitattributes` (spec said below binaries - would have overridden them) |
| GC-002 | **released** | `02164f7` | v0.1.1 | `npm run setup-hooks`; pure-delete pushes skip gates; `doctor` still lists 10 pre-programme `feature/*` branches as "your call", not zombies |
| GC-003 | **released** | `598da64` | v0.1.1 | real Chromium via Playwright, not jsdom; needs `npx playwright install chromium` once per machine |
| GC-010 | **released** | `7fa06f0` | v0.1.1 | cap 365 d (bites at 7th clean review); ease +0.1 to 2.5; no migration needed (overlong intervals need 393 d of history). Noted: `packages/*` is outside Prettier's config and the lint gate |
| GC-020 | **released** | `1748edb` | v0.1.1 | both crashes reproduced on main first; button gated (not just `clearAllVisuals` - that alone races the load handler); timers in a Set, not one handle |
| GC-030 | **released** | `25a788f` | v0.1.1 | 44 maps / 1410 targets clean; negative fixtures committed so "can fail" stays tested; `index.json` ships as `/maps/index.json` (GC-071 can use its `targetCount`) |
| GC-040 | **released** | `063d602` | v0.1.1 | migrator tested against real SQLite (`node:sqlite`) + cross-checked vs lib.rs; native bridge still device-only - manual plan in the merge commit (`git show 063d602^2`) |
| GC-050 | **released** | `1d0593e` | v0.1.1 | set at hydration; static home-page HTML paints `en` for an instant first (inline script would close it - not worth the duplicated key) |
| GC-060 | **released** | `1deb05d` | v0.1.1 | "no search UI" re-affirmed at 22 countries (re-open at ~40 or a real complaint) - the loop's call, overrulable |
| GC-070 | **released** | `f7e0963` | v0.1.1 | `asset()` not the deprecated `base` (same effect); verified under a real `/geoclick` subpath |
| GC-021 | **released** | `7d536be` | v0.1.2 | spec deviation: kept Bremen tolerance rescue (spec's case 3 would have regressed it); `/code-review` clean. Observed: at large-window zoom Bremen's edge is 30px from its centroid, > 24px tolerance |
| GC-031 | **released** | `1030bf0` | v0.1.2 | verified via tsx (no WSL toolchain here); found 5 mangled Polish ids (`wroc-aw`...) - documented, not changed (ids key saved progress) |
| GC-041 | **released** | `f303d18` | v0.1.2 | Capacitor clearMap is transactional; Tauri's is two statements (plugin has no transaction API); no reset UI (owner's call) |
| GC-071 | **released** | `d47e519` | v0.1.2 | 44 → 0 data requests; index carries `targetIds` (not just counts) so stale cards stay ignored - verified identical badges on 3 seeded maps |
| GC-004 | **merged** | `eac332e` | v0.2.0 | data/tsconfig.json strict + root check/lint cover data/scripts; 13 `any` → narrow GeoJSON interfaces; esbuild diff proves types-only (plus `cause` on one error) |
| GC-022 | todo | — | v0.2.0 | |
| GC-032 | **merged** | `9667bfb` | v0.2.0 | colorIndex 0-5 per target from tile adjacency (all 44 maps, 0 same-colour neighbours, asserted in mapColors.test.ts); unsolved opacity 0.55; hover recoloured (ΔE 16→38 vs palette) - verified on italy-provinces + germany-towns quizzes |
| GC-033 | todo | — | v0.2.0 | last task; v0.2.0 is cut after it |
| GC-080 | **merged** | `a53c541` | v0.2.0 | decision: stay in plain git (pack 15.6 MiB, 14.2 MB of it tileset history); revisit at 100 MB / 25 MB tileset / 60 countries |

| Release | Status | Tag | Date |
|---|---|---|---|
| `v0.1.1` | **cut** | `v0.1.1` → `47b69d5` | 2026-09-13 |
| `v0.1.2` | **cut** | `v0.1.2` → `34dd3a2` | 2026-09-13 |
| `v0.2.0` | not cut | — | — |

## Out of scope

- `feature/supabase-sso-sync` stays parked (DECISIONS.md, 2026-09-13).
- GC-000, the worktree spike.
- Multi-machine execution, multiple agents, and any hosted CI.
- No task rewrites history, regenerates a tileset, or triggers a deploy.

## What the earlier drafts got scaled down from

Recorded so the diff is legible later, not to re-argue it.

| Draft 1 | Draft 2 | Draft 3 (this one) | Why |
|---|---|---|---|
| 20 tasks | 15 | **19** | GC-000 already proven; nice-to-have tier dropped, then restored as low-effort work. |
| 4 engines | 2 (sonnet + opus) | **1 (opus)** | *"just Opus do the change alone, no two steps required, no multi agent, just loop."* |
| implementer + cold reviewer + orchestrator | implementer + cold reviewer | **one agent** | The gates are the mechanical review; the product owner is the judgement review. |
| GitHub issues/labels/milestones as state | `.orchestrator/state/*.json` | same, plus **a committed ledger** | *"not using GitHub, just local harnesses"*, and progress has to be readable without running a command. |
| Draft PR as handoff | branch + diff | **branch + diff + worklog** | Nobody to hand off to; the worklog is for the approver. |
| worktree + port + lease per task | same | **main checkout, one branch, port 5174** | One agent needs one checkout — and it is what removes the zombies. |
| `release/*` buffering | straight to `main` | same | Netlify build cost is not a constraint (2026-09-13). |
| 3 GitHub Releases | 3 git tags + CHANGELOG | same | Release tracking kept, forge dropped. |
| `scripts/seed-forge.mjs` | `task.mjs init` | same, plus **`task.mjs doctor`** | *"let us make sure that we have no zombies."* |
