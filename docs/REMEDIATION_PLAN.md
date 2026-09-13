# Geoclick — Remediation Plan

Executable programme derived from the independent code review (2026-09-13).
**15 tasks, 4 waves, 3 tagged releases, 2 engines, no GitHub.**
Machine-readable source of truth: [`tasks.yaml`](tasks.yaml).
Execution model: [`ORCHESTRATION.md`](ORCHESTRATION.md).
Release policy: [`RELEASES.md`](RELEASES.md).

**This file is the roadmap. `tasks.yaml` is what the orchestrator reads.**
If they disagree, `tasks.yaml` wins and this file is stale — fix it.

> **Second draft (2026-09-13).** The first draft was a 20-task,
> GitHub-issue-driven, four-engine, release-branch-buffered programme. The
> product owner scaled it down before any task started: no GitHub, two engines,
> `main` as the integration branch again, and the review's nice-to-have tier cut.
> This file is that revision. What changed and why is summarised under
> "What the first draft got scaled down from", at the bottom.

## Ground rules inherited from CLAUDE.md

- One branch per task. Branches merge **straight into `main`** — `main` is the
  normal integration branch for this project and always has been. There are no
  `release/*` branches.
- Never merge to `main` without the user's explicit OK. That is a review/testing
  gate, not a cost gate: the user gets to try the change first.
- Netlify build cost is **not** a constraint (CLAUDE.md, 2026-09-13). Nobody
  rations merges. Still: no agent triggers a manual deploy, ever.
- Every commit ends with the attribution trailer in `tasks.yaml`'s
  `meta.attribution_trailer`.

## Quality gate

Every task's definition of done includes the same four commands, run from the
repo root of that task's worktree:

```
npm run check                  # svelte-check + tsc across workspaces
npm run test                   # Vitest: quiz-engine, srs, app
npm run lint                   # prettier --check && eslint
npm run build --workspace=app  # production build + postbuild worker copy
```

**Honest baseline as measured at `c5c786e`:** `check`, `test` and `build` pass.
**`lint` fails** (exit 1) — `core.autocrlf=true` plus a `.gitattributes` that
only covers `*.sh`/`gradlew`/binaries means Prettier flags all 39 files on line
endings, and because the script is `prettier --check . && eslint .`, **ESLint
has never actually run**. Three files are also genuinely unformatted. This is
why GC-001 is wave 0 and lands alone.

Until GC-001 merges, the gate for GC-001 itself is "`lint` must newly pass".
For every other task the gate is "all four pass".

## Waves and the dependency DAG

A wave is the earliest position in the dependency DAG a task can start. A wave
boundary exists only where tasks touch the same files — nothing is serialized
for taste. Waves are also the release batching unit (see
[`RELEASES.md`](RELEASES.md)), which is the one thing that changed about them
in this draft: with `main` as the integration branch, a wave is a point where
the tree is quiescent, and that is a natural place to tag.

```
WAVE 0  ── GC-001 ────────────────────────────────────────────────┐
              (renormalizes line endings tree-wide; conflicts      │
               with every other branch — must land alone)          │
                                                                   │
WAVE 1  ┌──────────────────────────────────────────────────────────┘
        ├─ GC-002  gate script + pre-push hook
        ├─ GC-003  test harness (restore the browser Vitest project)
        ├─ GC-010  SRS scheduler correctness
        ├─ GC-020  QuizView lifecycle safety
        ├─ GC-030  map-data integrity test + generated index
        ├─ GC-040  Capacitor schema migrations
        ├─ GC-050  <html lang> sync
        ├─ GC-060  doc count reconciliation
        └─ GC-070  base-path asset fetches
                                          │
WAVE 2  ┌─────────────────────────────────┘
        ├─ GC-021  extract resolveDrop            (needs 020, 003)
        ├─ GC-032  adjacency-aware map palette    (needs 030)
        ├─ GC-041  repository clear/reset         (needs 040)
        └─ GC-071  home page due-count rework     (needs 070, 030)
                                          │
WAVE 3  └─ GC-022  popup setText                  (needs 021)
```

Nine tasks are dependency-ready the moment GC-001 lands. With a concurrency cap
of 3 that is three batches, not one — the cap is a disk/CPU limit (each worktree
runs its own `npm install`), not a DAG limit.

### Worktree parallelism: settled, not a spike

The first draft opened with `GC-000`, a blocking spike to prove worktree
parallelism worked here at all, because `ROADMAP.md` recorded it **failing** on
2026-09-12. **That has since been run and passed** — see `ROADMAP.md`'s "Process
notes", the *"Git worktrees failed … — RESOLVED 2026-09-13"* entry. A worktree
that runs its own `npm install` gets a real local `node_modules`, and the
maplibre-gl worker / pmtiles data path then behaves identically to the main
checkout (verified by comparing network requests side by side: identical
`206 Partial Content` tile responses).

So this plan **assumes worktree-per-task parallelism works** and spends zero
tasks re-verifying it. GC-000 is gone, not re-scoped. The one operational
consequence that survives: **every worktree must run `npm install` before
anything else**, which is baked into `scripts/task.mjs lease`'s output and into
[`ORCHESTRATION.md`](ORCHESTRATION.md).

### Why each serialization exists (file-level conflicts)

| Edge | Shared file(s) |
|---|---|
| `GC-001 → everything` | every `*.ts` / `*.svelte` / `*.json` in the tree (line-ending renormalization) |
| `GC-020 → GC-021 → GC-022` | `app/src/lib/QuizView.svelte` |
| `GC-003 → GC-021` | `app/vite.config.ts` + the test harness GC-021's new suite runs under |
| `GC-030 → GC-032` | `data/maps/*/map.json` (GC-032 writes `colorIndex` into files GC-030 asserts over) |
| `GC-030 → GC-071` | `app/src/lib/mapCatalog.ts` / the generated map index |
| `GC-040 → GC-041` | `app/src/lib/capacitorProgressRepository.ts` |
| `GC-070 → GC-071` | `app/src/routes/+page.svelte` (GC-071 deletes the fetch GC-070 fixes) |

`QuizView.svelte` is 909 lines and remains the single biggest serialization cost
in this plan — three tasks queue behind it. That is itself an argument for
GC-021 (extracting the pure logic out of it).

## Engine assignment rubric

Two engines. The product owner's direction, verbatim: *"sonnet would do the
fixes in a branch, opus the review and merge … the orchestrator must be opus."*

| Alias | Model | Role |
|---|---|---|
| `sonnet` | `claude-sonnet-5` | **Implements every task in this programme.** Each task here is well-specified implementation with tests — sonnet's own tier description. |
| `opus` | `claude-opus-5` | **Orchestrator, Reviewer, and merge integration.** Cold-context review is where top-tier reasoning pays for itself; scheduling a 15-task DAG is the other. Writes no product code. |

No `haiku`: the tasks that would have used it are either dropped (see below) or
folded into sonnet, which costs little and removes a routing decision.
No `fable`: the plan is specified tightly enough that a long-horizon
design-grade engine buys nothing an opus orchestrator does not already provide.
It is **cut, not downgraded** — there is no "opus at effort `max`" stand-in for
a fable role anywhere in this draft.

`engine:` is therefore `sonnet` on every task in `tasks.yaml`. Opus appears only
as the orchestrator/reviewer, configured in `meta`. **If a task escalates twice**
(see ORCHESTRATION.md's two-rounds-then-escalate rule) the product owner may
re-run that one task on opus — that is a human-authorised exception to an
underspecified task, not a scheduled cost.

**The most likely candidate for that exception is GC-032** (adjacency-aware
palette). It is the one remaining task with real design content rather than
specified implementation, and it was the first draft's only `fable` task. It is
scheduled as sonnet like everything else; if its review round-trips twice, that
is the signal, and the escalation path is already there.

## Effort scale

| Level | Means |
|---|---|
| Low | < 1h agent time, one or two files, no design decision. |
| Medium | A few files plus tests; one contained decision the task spec already makes. |
| High | Multi-file refactor or a real design choice with alternatives to weigh. |
| Ultrahigh | Irreversible, or requires regenerating committed binary artefacts, or needs a toolchain not on the default machine. |

**Nothing in this plan is Ultrahigh.** GC-032 is explicitly scoped to avoid
retiling; if its implementer concludes retiling is unavoidable, that is a STOP
and an escalation, not a task it may grow into.

## Task roster

Full descriptions and definitions of done are in [`tasks.yaml`](tasks.yaml) —
that is what an implementer is handed. This table is the index.

| ID | Title | Engine | Effort | Wave | Deps | Release | Branch | Review § |
|---|---|---|---|---|---|---|---|---|
| GC-001 | Repair the lint gate (`.gitattributes` + renormalize + format) | sonnet | Medium | 0 | — | v0.1.1 | `fix/gc-001-lint-gate` | S1, #3 |
| GC-002 | Gate runner script + pre-push hook | sonnet | Low | 1 | 001 | v0.1.1 | `chore/gc-002-gate-hook` | D7, #15 |
| GC-003 | Test harness: restore the browser Vitest project | sonnet | Medium | 1 | 001 | v0.1.1 | `chore/gc-003-test-harness` | D1, #11 |
| GC-010 | SRS: cap interval, let ease recover | sonnet | Medium | 1 | 001 | v0.1.1 | `fix/gc-010-srs-scheduler` | C1, C2, C3, S3, #1, #2, #19 |
| GC-020 | QuizView lifecycle safety + practice-mode persistence | sonnet | Medium | 1 | 001 | v0.1.1 | `fix/gc-020-quizview-lifecycle` | C4, C5, C6, #4, #5, #6 |
| GC-021 | Extract and test `resolveDrop` | sonnet | High | 2 | 020, 003 | v0.1.2 | `refactor/gc-021-resolve-drop` | D8, #10 |
| GC-022 | Popup `setText` (no raw HTML injection) | sonnet | Low | 3 | 021 | v0.2.0 | `fix/gc-022-popup-text` | C8, #17 |
| GC-030 | Map-data integrity test + generated map index | sonnet | Medium | 1 | 001 | v0.1.1 | `feat/gc-030-map-data-integrity` | C7, C11, #7 |
| GC-032 | Adjacency-aware map palette + opacity revisit | sonnet | High | 2 | 030 | v0.1.2 | `feat/gc-032-map-palette` | D4, #8 |
| GC-040 | Capacitor SQLite schema migrations | sonnet | Medium | 1 | 001 | v0.1.1 | `fix/gc-040-capacitor-migrations` | D2, #9 |
| GC-041 | `clearMap`/`clearAll` on ProgressRepository | sonnet | Medium | 2 | 040 | v0.1.2 | `feat/gc-041-repository-clear` | D10, #16 |
| GC-050 | Sync `<html lang>` to the selected language | sonnet | Low | 1 | 001 | v0.1.1 | `fix/gc-050-html-lang` | C13, #12 |
| GC-060 | Reconcile stale doc counts and dangling references | sonnet | Low | 1 | 001 | v0.1.1 | `docs/gc-060-count-reconciliation` | S2, S4, #18 |
| GC-070 | Route asset fetches through SvelteKit `base` | sonnet | Low | 1 | 001 | v0.1.1 | `fix/gc-070-base-path-fetches` | C12, #14 |
| GC-071 | Home page: stop fetching all 44 `map.json` | sonnet | Medium | 2 | 070, 030 | v0.1.2 | `perf/gc-071-home-due-counts` | C9, #13 |

**Distribution** — engines: sonnet 15 (opus reviews all 15).
Effort: Low 5, Medium 8, High 2, Ultrahigh 0.

### Review-item coverage

All 19 must-fix and worth-doing items from `CODE_REVIEW_2026-09-13.md`'s task
list are assigned. Items merged into a single task: 1+2+19 → GC-010;
4+5+6 → GC-020; 7 → GC-030; 18 → GC-060.

Per CLAUDE.md, any task that makes a product or design decision writes its own
`DECISIONS.md` entry as part of its DoD rather than deferring it to a docs task.

## What was dropped, and why

Direction, verbatim: *"let us focus on the necessary things, no nice to have
things."* The review's **"Nice-to-have / low value" tier (`#20`–`#30`)** is out
of scope. "Must-fix" (`#1`–`#7`) and "Worth doing" (`#8`–`#19`) are in.

Whole tasks dropped:

| Was | Covered | Why dropped |
|---|---|---|
| GC-000 | — | Already done and passed; see "Worktree parallelism" above. Not re-scoped. |
| GC-004 | #25 | `data/scripts` tsconfig + lint — nice-to-have tier. |
| GC-031 | #22, #27, #28 | Build-script hygiene (`PMTILES_BIN`, slugify escape, bbox flag) — nice-to-have tier. |
| GC-033 | #30 | Tour dwell tuning — nice-to-have tier, and the first draft already called it "explicitly the last task". |
| GC-080 | D12, #29 | pmtiles storage ADR (Git LFS) — nice-to-have tier. |

Nice-to-have *sub-items* dropped out of tasks that otherwise survive:

| Item | Was folded into | Now |
|---|---|---|
| #20 delete `app/src/lib/vitest-examples/` | GC-003 | Dropped. GC-003 restores the browser project only. |
| #21 dedup popup CSS into `app.css` | GC-022 | Dropped. GC-022 is the `setText` fix only — which is the `C8` half, and `C8` is a correctness finding. |
| #23 `$state` on the three tray bindings | GC-020 | Dropped. The three `svelte-check` warnings stay. |
| #24 `import.meta.env.DEV` guard on `window.__map` | GC-020 | Dropped. |
| #26 try/catch around `localStorage.setItem` | GC-041 | Dropped. GC-041 is `clearMap`/`clearAll` only. |

**Dependency check on the drops.** No kept task depends on a dropped one. The
three edges that pointed at dropped work:

- `GC-032 → GC-031` — removed. GC-031 only touched the build scripts for
  hygiene; nothing GC-032 needs. GC-032 now depends on GC-030 alone.
- `GC-004 → GC-031` and `GC-033 → GC-031/GC-022` — both dependants are
  themselves dropped.
- `GC-060 → GC-032` coordination **survives**: `data/styles/base.json:5` cites a
  `DECISIONS.md` "Map colors" entry that has never existed, GC-060 leaves it
  alone, and GC-032 still writes it. That handshake is intact.

**One honest note, not a request to re-litigate.** Five of the dropped
sub-items (#20, #21, #23, #24, #26) are each well under an hour and sit inside a
file a kept task already opens. They are dropped because the direction was to
drop the tier, not because they are expensive. If the product owner wants any of
them back, say which and they become DoD lines on the task that already touches
that file — no new task, no new wave.

## Release map

Local git tags plus `CHANGELOG.md` entries. No GitHub Releases, no milestones.
A **batch is a completed wave**; full reasoning in [`RELEASES.md`](RELEASES.md).

| Release | Batch | Tasks | Theme |
|---|---|---|---|
| `v0.1.1` | waves 0 + 1 | 001, 002, 003, 010, 020, 030, 040, 050, 060, 070 | Correctness, gates and platform |
| `v0.1.2` | wave 2 | 021, 032, 041, 071 | Extraction, palette, storage, performance |
| `v0.2.0` | wave 3 + programme close | 022 | **Milestone: the Sept 13 review is closed out** |

`v0.2.0` is the programme's closing milestone. It is deliberately *not* `1.0.0`
— `DECISIONS.md`'s SSO-deferral entry reserves `1.0.0` for the real public
launch (domain purchased, app-store submission), which this programme does not
deliver. Reasoning for the exact numbers is in `RELEASES.md`.

## Out of scope

- `feature/supabase-sso-sync` stays parked (DECISIONS.md, 2026-09-13).
- The stale `worktree-agent-*` branches are leftovers from earlier agent runs;
  GC-002 deletes them as housekeeping.
- No task in this plan triggers a deploy or rewrites history.
- Multi-machine execution. See ORCHESTRATION.md — local state means one box.

## What the first draft got scaled down from

Recorded so the diff is legible later, not to re-argue it.

| First draft | This draft | Why |
|---|---|---|
| 20 tasks | 15 | GC-000 already done; nice-to-have tier dropped. |
| 4 engines (haiku/sonnet/opus/fable) | 2 (sonnet implements, opus reviews/orchestrates/merges) | Product owner pushing back on cost. |
| GitHub issues/labels/milestones as authoritative state | `.orchestrator/state/GC-0NN.json`, one file per task, local | *"not using GitHub, but just using local harnesses."* |
| Draft PR as the review handoff | A branch name and a diff | Same information, no forge. |
| `release/*` branches buffering merges to `main` | Straight to `main` | Netlify build cost is not a real constraint (CLAUDE.md, 2026-09-13). |
| 3 GitHub Releases + milestones | 3 git tags + `CHANGELOG.md` entries | Release tracking kept; forge dropped. |
| `scripts/seed-forge.mjs` | `node scripts/task.mjs init` | Same job, no `gh`. |
