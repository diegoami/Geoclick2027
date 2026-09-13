# Handover: revise the remediation programme (local, cheaper, no GitHub)

This briefs a reviewer who has not seen the current draft, to revise it —
not to redo the code review or re-derive the task list from scratch. Read
this fully before touching anything.

## What already exists, and why it's changing

On `main` today (as of `v0.1.0`, tagged 2026-09-13):

- `REVIEW_HANDOVER.md` / `CODE_REVIEW_2026-09-13.md` — an independent Opus
  code review: 30 findings (correctness bugs, sanity-check results, design
  issues), each tagged `C1`–`C13`, `D1`–`D12`, `S1`–`S5`, or a bare `#N`.
  **Do not redo this review.** Its findings are the input, not the subject.
- `docs/REMEDIATION_PLAN.md`, `docs/ORCHESTRATION.md`, `docs/RELEASES.md`,
  `docs/tasks.yaml`, `scripts/task.mjs`, `scripts/seed-forge.mjs`,
  `scripts/sync-version.mjs` — a first-draft execution plan turning those
  30 findings into 20 tasks, run by a **GitHub-issue-driven, four-engine
  (haiku/sonnet/opus/fable), release-branch-buffered** multi-agent
  pipeline. Read all of these fully; they're the thing being revised.

The product owner reviewed that first draft and gave explicit, specific
direction to scale it down **before any task started**. Your job is to
produce a second draft that follows this direction exactly — not to
re-litigate whether it's the right call.

## Required changes, verbatim from the product owner's own words

1. **"remove the constraints of not using main as integration branch, it
   is not an issue either way"** — Netlify build cost is confirmed *not*
   a real constraint (see `CLAUDE.md`'s Workflow section, already updated
   2026-09-13). Drop the release-branch buffering entirely: task/fix
   branches merge straight into `main`, same as every other feature in
   this project's history. `docs/RELEASES.md`'s reason for existing
   (avoid paid builds) is gone — but release *tracking* is still wanted,
   see point 3.

2. **"a local orchestrator would be enough... sonnet would do the fixes
   in a branch, opus the review and merge... the orchestrator must be
   opus, let us push back on the costs that they are proposing"** — cut
   the engine roster from four (haiku/sonnet/opus/fable) to exactly two:
   `sonnet` implements, `opus` reviews, merges, and orchestrates. No
   haiku (fold trivial tasks into sonnet — they're still "well-specified
   implementation with tests", sonnet's own tier description already
   covers them). No fable (the plan is well-specified enough now that a
   long-horizon design-grade engine isn't buying anything an opus
   orchestrator doesn't already do; the product owner is explicitly
   pushing back on that cost, not asking for a cheaper substitute of the
   same role — cut it, don't downgrade it to `opus` at `effort: max` the
   way the first draft's fallback language suggested).

3. **"we also need to have release management with tags / release notes
   after successful merges. Then a major milestone at the end."** —
   keep real release tracking, just make it local and lightweight: a git
   tag (`vX.Y.Z`) plus a `CHANGELOG.md` entry (already started — see that
   file's `v0.1.0` entry for the format to match) after each meaningful
   batch of merges, not GitHub Releases/milestones. Design what counts as
   "a batch" — could be every N tasks, every wave, or whenever the
   product owner says so; make a call and say why. End the whole
   programme with one clearly-marked larger release. **`1.0.0` is already
   reserved** for the real public-launch milestone (domain purchase,
   app-store submission — see `DECISIONS.md`'s SSO-deferral entry) — the
   remediation programme's own "major milestone at the end" needs a
   *different* version number under that ceiling; propose one and justify
   it (e.g. `0.2.0`, "known issues from the Sept 13 review resolved").

4. **"let us focus on the necessary things, no nice to have things"** —
   drop the "nice-to-have / low value" tier from the review's task list
   entirely (items `#20`–`#30` in `CODE_REVIEW_2026-09-13.md`'s task
   list, folded into the first draft as low-priority `tasks.yaml`
   entries — check which ones actually made it in). Keep "must-fix" and
   "worth doing" only. If dropping an item breaks a dependency edge
   another kept task relies on, say so explicitly rather than silently
   keeping it anyway.

5. **"not using Github, but just using local harnesses"** — this is the
   biggest structural change. No `scripts/seed-forge.mjs`, no GitHub
   issues/labels/milestones, no `gh pr` commands anywhere in
   `docs/ORCHESTRATION.md`. Design a local equivalent for everything that
   depended on GitHub as shared state:
   - **Task state** (`backlog`/`ready`/`leased`/`in-progress`/`in-review`/
     `changes-requested`/`approved`/`integrated`/`escalated`) needs
     somewhere to live that isn't a GitHub issue label. `tasks.yaml`
     itself, a status field per task, is the obvious candidate — but
     multiple agents writing to one YAML file concurrently is a real
     race condition the first draft's "state lives on GitHub" design
     was specifically avoiding. Think about this rather than papering
     over it (a lockfile? one file per task under a local directory,
     similar to the first draft's gitignored `.orchestrator/leases/`
     idea, but made authoritative instead of a cache? something else?).
   - **The review handoff** ("draft PR" in the first draft) needs a local
     stand-in: what does an implementer hand the reviewer, concretely,
     with no `gh pr create`? A branch name and a diff is probably enough
     — say so plainly rather than inventing new machinery for its own
     sake.
   - **Everything else in `docs/ORCHESTRATION.md`** (roles, the lease/
     port/worktree protocol, cold-context review, no-fork-for-review,
     two-rounds-then-escalate, human as sole merge authority) is sound
     and should carry over structurally — it just needs its GitHub-shaped
     parts replaced, not the whole design rethought.

## One finding to reuse, not re-derive

The first draft's `GC-000` (prove worktree parallelism actually works on
this repo, since `ROADMAP.md` recorded it failing 2026-09-12) has **already
been run and passed** — see `ROADMAP.md`'s "Process notes" section, the
"Git worktrees failed... RESOLVED 2026-09-13" entry, for the real result:
a worktree with its own `npm install` gets a real `node_modules` and the
maplibre-gl worker/pmtiles data path works identically to the main
checkout. **Do not re-scope this as an open question or a new spike task.**
The revised plan can assume worktree-per-task parallelism works, cite that
ROADMAP.md entry, and spend zero tasks re-verifying it.

## What "revise" means concretely

Rewrite, in place, on a branch (see "Workflow" below):

- `docs/REMEDIATION_PLAN.md` — waves/DAG, engine rubric (now 2 rows, not
  4), effort scale (unchanged), task roster (must-fix + worth-doing only),
  release map (local tags, not GitHub milestones; reflects point 3 above).
- `docs/ORCHESTRATION.md` — roles (Orchestrator = opus, Implementer =
  sonnet, Reviewer = opus cold-context; no separate fable role), the local
  task-state mechanism (point 5), the review-loop handoff (point 5), the
  worktree/port/lease protocol (keep, it's GitHub-agnostic already), hard
  rules (keep "never touch main without approval" as a policy gate —
  that's not the same rule as the release-branch buffering that's being
  dropped).
- `docs/RELEASES.md` — local tag + `CHANGELOG.md` process, replacing the
  GitHub-milestone-driven one. Say explicitly how a "batch" is decided and
  what the closing "major milestone" release is numbered and why.
- `docs/tasks.yaml` — re-derive from the trimmed task list: drop
  nice-to-have items, reassign every task's `engine` field to `sonnet` or
  `opus` only, update `deps`/waves if dropping tasks changed the DAG,
  remove any GitHub-specific fields (issue numbers, label names) that no
  longer mean anything.
- `scripts/seed-forge.mjs` — delete it. If the local task-state design
  needs an equivalent "initialize state for all tasks" step, that's a new,
  small, GitHub-free script — write one only if the design actually needs
  it, don't keep this file around unused.
- `scripts/task.mjs` — audit for GitHub-specific bits (issue
  assign/comment calls) and adjust to the new local task-state design;
  the worktree/port/lease mechanics themselves are already local and
  should mostly survive as-is.
- `scripts/sync-version.mjs` — no changes needed; it's already local-only
  and is exactly the release-tagging mechanism to build point 3 on top of.

## Workflow (per CLAUDE.md, unchanged)

Work on a branch (suggest `docs/remediation-plan-v2`), commit, push. Do
**not** merge to `main` yourself — report back when it's ready and the
product owner (or the session that dispatched you) will review and merge.
This revision touches only `docs/`, `scripts/`, and possibly
`.gitignore` — no app code, so keep it that way; if you find yourself
wanting to touch `app/`, `packages/`, `desktop/`, or `mobile/`, stop —
that's out of scope for this task.

## Keep this tight

The original code review ran long because it was open-ended exploration
of an unfamiliar codebase. This is not that — it's a well-specified
revision of four documents and some scripts against explicit,
already-decided direction. Don't re-run the code review, don't re-verify
GC-000, don't second-guess the four numbered decisions above (do flag it
plainly if one of them turns out to be genuinely unworkable once you're
actually writing the design — that's different from relitigating a
decision you'd have made differently). Aim to actually finish, not to be
exhaustive.
