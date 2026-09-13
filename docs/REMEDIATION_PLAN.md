# Geoclick — Remediation Plan

Executable programme derived from the independent code review (2026-09-13).
20 tasks, 5 waves, 3 releases. Machine-readable source of truth:
[`tasks.yaml`](tasks.yaml). Execution model: [`ORCHESTRATION.md`](ORCHESTRATION.md).
Release policy: [`RELEASES.md`](RELEASES.md).

**This file is the roadmap. `tasks.yaml` is what the orchestrator reads.**
If they disagree, `tasks.yaml` wins and this file is stale — fix it.

## Ground rules inherited from CLAUDE.md

- One branch per task. Never merge to `main` without the user's explicit OK.
- A `main` push triggers a paid Netlify build ⇒ `main` merges happen **only at
  release boundaries**, in one batch. Feature branches merge into a
  `release/*` branch (free). See RELEASES.md.
- Every commit ends with the attribution trailer.
- No agent triggers a deploy. Ever.

## Quality gate

Every task's definition of done includes the same four commands, run from the
repo root of that task's worktree:

```
npm run check                  # svelte-check + tsc across workspaces
npm run test                   # Vitest: quiz-engine, srs, app
npm run lint                   # prettier --check && eslint
npm run build --workspace=app  # production build + postbuild worker copy
```

**Honest baseline as of `c5c786e`:** `check`, `test` and `build` pass.
**`lint` fails** (exit 1) — `core.autocrlf=true` plus a `.gitattributes` that
only covers `*.sh`/`gradlew`/binaries means Prettier flags all 39 files on line
endings, and because the script is `prettier --check . && eslint .`, **ESLint
has never actually run**. Three files are also genuinely unformatted. This is
why GC-001 is wave 0 and lands alone.

Until GC-001 merges, the gate for GC-001 itself is "`lint` must newly pass".
For every other task the gate is "all four pass".

## Waves and the dependency DAG

**Wave ≠ release.** A wave is the earliest position in the dependency DAG a
task can start. A release is when it ships. GC-080 is dependency-ready in
wave 1 but scheduled into v0.4.0 because it is low value, and that is fine —
the orchestrator schedules by DAG readiness, the release branch decides what
travels together.

A wave boundary exists only where tasks touch the same files. Nothing is
serialized for taste.

```
WAVE 0  ── GC-000 ─► GC-001 ──────────────────────────────────────┐
           │          (renormalizes line endings tree-wide;        │
           │           conflicts with every other branch —         │
           │           must land alone)                            │
           └─ BLOCKING SPIKE: prove worktree parallelism works      │
              on this repo at all. ROADMAP.md already records it    │
              FAILING on 2026-09-12. See "Known hazard" below.      │
                                                                   │
WAVE 1  ┌──────────────────────────────────────────────────────────┘
        ├─ GC-002  gate script + pre-push hook
        ├─ GC-003  test harness (delete scaffold, restore browser project)
        ├─ GC-010  SRS scheduler correctness
        ├─ GC-020  QuizView lifecycle safety
        ├─ GC-030  map-data integrity test + generated index
        ├─ GC-040  Capacitor schema migrations
        ├─ GC-050  <html lang> sync
        ├─ GC-060  doc count reconciliation
        ├─ GC-070  base-path asset fetches
        └─ GC-080  pmtiles storage ADR            (ships in v0.4.0)
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
        └─ GC-032  adjacency-aware map palette    (needs 031, 030)
                                          │
WAVE 4  └─ GC-033  tour dwell tuning              (needs 031, 022)
```

Ten tasks are dependency-ready the moment GC-001 lands. With a concurrency cap
of 3 that is four batches, not one — the cap is a disk/CPU limit (each worktree
runs its own `npm ci`), not a DAG limit.

### Known hazard: this repo has already tried worktree parallelism and failed

`ROADMAP.md`'s "Process notes" records, dated 2026-09-12, that git worktrees
**did not work** for parallel agent work here: a worktree gets no
`node_modules` of its own (npm workspaces hoists it to the main checkout), so
`npm run dev` inside one cannot render a map — Vite's `fs.allow` blocks the
maplibre-gl worker outside the worktree root. Three branches were attempted in
parallel and had to be redone serially. The note ends: *"Don't reach for
worktree-isolated parallel agents on this repo again without first solving the
`node_modules` problem."*

This plan's answer is a per-worktree `npm ci`, which should fix both symptoms
— once `node_modules` is inside the worktree root, the `fs.allow` failure goes
away as a consequence. **That is a hypothesis, not a result.** GC-000 exists to
prove it before the programme spends anything on it, and to escalate rather
than improvise if it fails. If GC-000 fails, the fallback is serial execution
in the main checkout (concurrency 1, no leases, no ports) — a decision for the
product owner, not an agent.

### Why each serialization exists (file-level conflicts)

| Edge | Shared file(s) |
|---|---|
| `GC-001 → everything` | every `*.ts` / `*.svelte` / `*.json` in the tree (line-ending renormalization) |
| `GC-020 → GC-021 → GC-022 → GC-033` | `app/src/lib/QuizView.svelte`, then `TourView.svelte` |
| `GC-030 → GC-031 → GC-032 → GC-033` | `data/scripts/build-map.ts`, `data/scripts/build-points-map.ts` |
| `GC-031 → GC-004` | `data/scripts/*.ts` must be stable before a tsconfig is written over it |
| `GC-040 → GC-041` | `app/src/lib/capacitorProgressRepository.ts` |
| `GC-070 → GC-071` | `app/src/routes/+page.svelte` (GC-071 deletes the fetch GC-070 fixes) |
| `GC-030 → GC-071` | `app/src/lib/mapCatalog.ts` / the generated map index |
| `GC-001 → GC-080` | `.gitattributes` |

`QuizView.svelte` is 909 lines and is the single biggest serialization cost in
this plan — four tasks queue behind it. That is itself an argument for GC-021
(extracting the pure logic out of it).

## Engine assignment rubric

Tiers, cheapest first. Column 1 is what the operator passes as the Agent tool's
`model`; column 2 is the concrete model for the record.

| Alias | Model | Use for |
|---|---|---|
| `haiku` | `claude-haiku-4-5` | Mechanical, single-file, zero design judgement. A wrong answer is obvious on sight. |
| `sonnet` | `claude-sonnet-5` | Well-specified implementation with tests. The workhorse — most tasks. |
| `opus` | `claude-opus-5` | Cross-cutting changes, invariant-preserving refactors, anything where "correct" needs an argument. **All code review runs here.** |
| `fable` | `claude-fable-5-1` | Genuinely open-ended design problems and long-horizon agentic roles. Exactly one task and the orchestrator. |

Fable is ~2× Opus per token; spend it only where the problem is *design*, not
implementation. If Fable is not enabled on the operator's account, substitute
`opus` at effort `max` and say so on the issue.

## Effort scale

| Level | Means |
|---|---|
| Low | < 1h agent time, one or two files, no design decision. |
| Medium | A few files plus tests; one contained decision the task spec already makes. |
| High | Multi-file refactor or a real design choice with alternatives to weigh. |
| Ultrahigh | Irreversible, or requires regenerating committed binary artefacts, or needs a toolchain not on the default machine. |

**Nothing in this plan is Ultrahigh.** The only candidate would be executing a
`pmtiles` history rewrite — which is precisely why GC-080 is scoped to an ADR
and stops short of migrating anything.

## Task roster

Full descriptions and definitions of done are in [`tasks.yaml`](tasks.yaml) —
that is what an implementer is handed. This table is the index.

| ID | Title | Engine | Effort | Deps | Release | Branch | Review § |
|---|---|---|---|---|---|---|---|
| GC-000 | Spike: prove worktree parallelism works here | sonnet | Low | — | v0.2.0 | `chore/gc-000-worktree-spike` | — |
| GC-001 | Repair the lint gate (`.gitattributes` + renormalize + format) | sonnet | Medium | — | v0.2.0 | `fix/gc-001-lint-gate` | S1 |
| GC-002 | Gate runner script + pre-push hook | sonnet | Low | 001 | v0.2.0 | `chore/gc-002-gate-hook` | D7 |
| GC-003 | Test harness: drop scaffold, restore browser Vitest project | sonnet | Medium | 001 | v0.2.0 | `chore/gc-003-test-harness` | D1, #20 |
| GC-004 | `data/scripts` tsconfig + lint coverage | sonnet | Low | 001, 031 | v0.3.0 | `chore/gc-004-scripts-typecheck` | #25 |
| GC-010 | SRS: cap interval, let ease recover | opus | Medium | 001 | v0.2.0 | `fix/gc-010-srs-scheduler` | C1, C2, C3, S3 |
| GC-020 | QuizView lifecycle safety + practice-mode persistence | opus | Medium | 001 | v0.2.0 | `fix/gc-020-quizview-lifecycle` | C4, C5, C6, #23, #24 |
| GC-021 | Extract and test `resolveDrop` | opus | High | 020, 003 | v0.2.0 | `refactor/gc-021-resolve-drop` | D8, #10 |
| GC-022 | Popup `setText` + popup CSS dedup | sonnet | Medium | 021 | v0.3.0 | `fix/gc-022-popup-text-css` | C8, #21 |
| GC-030 | Map-data integrity test + generated map index | sonnet | Medium | 001 | v0.2.0 | `feat/gc-030-map-data-integrity` | C7, C11 |
| GC-031 | Build-script hygiene (`PMTILES_BIN`, slugify, bbox assert) | haiku | Low | 030 | v0.3.0 | `chore/gc-031-build-script-hygiene` | #22, #27, #28 |
| GC-032 | Adjacency-aware map palette + opacity revisit | fable | High | 031, 030 | v0.4.0 | `feat/gc-032-map-palette` | D4 |
| GC-033 | Tour dwell tuning for large maps | sonnet | Low | 031, 022 | v0.4.0 | `feat/gc-033-tour-dwell` | #30 |
| GC-040 | Capacitor SQLite schema migrations | opus | Medium | 001 | v0.3.0 | `fix/gc-040-capacitor-migrations` | D2 |
| GC-041 | `clearMap`/`clearAll` + localStorage write guard | sonnet | Medium | 040 | v0.3.0 | `feat/gc-041-repository-clear` | D10, #26 |
| GC-050 | Sync `<html lang>` to the selected language | haiku | Low | 001 | v0.2.0 | `fix/gc-050-html-lang` | C13 |
| GC-060 | Reconcile stale doc counts and dangling references | haiku | Low | 001 | v0.2.0 | `docs/gc-060-count-reconciliation` | S2, S4 |
| GC-070 | Route asset fetches through SvelteKit `base` | sonnet | Low | 001 | v0.3.0 | `fix/gc-070-base-path-fetches` | C12 |
| GC-071 | Home page: stop fetching all 44 `map.json` | sonnet | Medium | 070, 030 | v0.3.0 | `perf/gc-071-home-due-counts` | C9 |
| GC-080 | ADR: pmtiles storage strategy (Git LFS or not) | opus | Low | 001 | v0.4.0 | `docs/gc-080-pmtiles-storage-adr` | D12, #29 |

**Distribution** — engines: haiku 3, sonnet 11, opus 5, fable 1.
Effort: Low 9, Medium 9, High 2, Ultrahigh 0.

### Review-item coverage

All 30 punch-list items are assigned. Items that merged into a single task:
1+2 → GC-010; 4+5+6+23+24 → GC-020; 11+20 → GC-003; 17+21 → GC-022;
22+27+28 → GC-031; 16+26 → GC-041; 7+13(index half) → GC-030; 18 + the missing
"Map colors" DECISIONS entry → GC-060, with GC-032 writing the real entry as
part of its own DoD; 19 splits — the code/comment half into GC-010, the
`ARCHITECTURE.md` half into GC-060.

Per CLAUDE.md, any task that makes a product or design decision writes its own
`DECISIONS.md` entry as part of its DoD rather than deferring it to a docs task.

## Release map

| Release | Theme | Tasks | Paid Netlify builds |
|---|---|---|---|
| v0.2.0 | Correctness & gates | 000, 001, 002, 003, 010, 020, 021, 030, 050, 060 | 1 |
| v0.3.0 | Storage & platform | 004, 022, 031, 040, 041, 070, 071 | 1 |
| v0.4.0 | Map palette & pipeline | 032, 033, 080 | 1 |

20 tasks, 20 branches, 20 PRs — **3 paid builds**. That ratio is the whole
point of the release-branch structure.

## Out of scope

- `feature/supabase-sso-sync` stays parked (DECISIONS.md, 2026-09-13).
- The stale `worktree-agent-*` branches on this repo are leftovers from earlier
  agent runs; GC-002 deletes them as housekeeping.
- No task in this plan triggers a deploy, rewrites history, or merges to `main`.
