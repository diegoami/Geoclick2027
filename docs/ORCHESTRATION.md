# Geoclick — Orchestration

How the 20 tasks in [`tasks.yaml`](tasks.yaml) actually get executed. Roadmap:
[`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md). Release policy:
[`RELEASES.md`](RELEASES.md).

## Who runs this

**The product owner (the human) starts one orchestrator session and leaves it
running.** Everything else is spawned by that session. The human's only
recurring duties are: adjudicating escalations, and approving each
`release/* → main` merge (which costs a Netlify build).

```bash
# 0. see what would be created — creates nothing
node scripts/seed-forge.mjs

# 1. create 33 labels, 3 milestones, 20 issues
node scripts/seed-forge.mjs --apply

# 2. create the release branches
git branch release/0.2.0 main
git branch release/0.3.0 main
git branch release/0.4.0 main

# 3. start the orchestrator
claude
> Read docs/ORCHESTRATION.md and docs/tasks.yaml. You are the Orchestrator.
> Run GC-000 first and stop if it fails. Then work release v0.2.0.
> Stop and ask me before any merge to main.
```

The orchestrator is stateless across restarts by design: **all authoritative
state lives on GitHub**, never in a local file. Kill the session, start a new
one with the same prompt, and it resumes from issue labels and PR status.

## Roles

Four roles. Three are agents; the fourth is the human. No role exists for
symmetry — each is here because something would otherwise go wrong.

| Role | Who | Engine | Why it exists |
|---|---|---|---|
| **Orchestrator** | long-lived Claude Code session | `fable` | Schedules, leases, spawns, integrates. Long-horizon agentic work over a 19-task DAG — the one place top-tier reasoning pays for itself. Writes no product code. |
| **Implementer** | one agent per task, in its own worktree | per `tasks.yaml` | Does the work. Engine varies by task so cheap work runs cheap. |
| **Reviewer** | one agent per review round, **cold context** | `opus` | Catches what the implementer cannot see. Must not be a fork of the implementer — a fork inherits the implementer's assumptions, which is exactly what review is for. |
| **Merge authority** | the human | — | `main` merges cost money (CLAUDE.md). This is a policy gate, not a capability gap. |

### Why there is no separate Integrator agent

Integration here is two mechanical steps — rebase a branch onto the release
branch, and merge it there — plus one judgement call, "is this release ready
for `main`", which CLAUDE.md already reserves for the human. A dedicated agent
would add a handoff without adding a decision. **The orchestrator performs
integration itself**, in an explicit Integrator mode described below, and stops
at the release branch. A merge conflict it cannot resolve mechanically is
escalated, not guessed at.

### Why there is no separate QA agent

The gates are scripted (`node scripts/task.mjs gates`). The implementer runs
them before requesting review; the reviewer re-runs them on a clean worktree.
A third party running the same script adds latency and nothing else.

## Task state machine

State lives in exactly one place: the `state:*` label on the task's GitHub
issue. One state label at a time.

```
  backlog ──► ready ──► leased ──► in-progress ──► in-review ──┬──► approved ──► integrated ──► released
     ▲                    │             ▲                       │
     │                    │             └── changes-requested ◄─┘
     │                    │                      │
     └──── blocked ◄──────┘                      └─(2nd round)─► escalated ──► (human) ──► ready | in-progress
```

| State | Set by | Means |
|---|---|---|
| `state:backlog` | seed script | Exists, dependencies unmet. |
| `state:ready` | orchestrator | All deps merged into the release branch; may be leased. |
| `state:leased` | orchestrator | Worktree + branch + port allocated; agent starting. |
| `state:in-progress` | implementer | Working. |
| `state:in-review` | implementer | Draft PR open, gates pass, review requested. |
| `state:changes-requested` | reviewer | Specific `file:line` changes asked for. Round 1. |
| `state:approved` | reviewer | Ready to integrate. |
| `state:integrated` | orchestrator | Merged into `release/x.y.z`. |
| `state:released` | orchestrator | Release branch merged to `main` and tagged. |
| `state:blocked` | anyone | Cannot proceed; reason in a comment. |
| `state:escalated` | orchestrator | Implementer and reviewer disagreed twice. Human owns it. |

## Exclusive machine access

Parallel agents cannot share one working tree. Every leased task gets its own
git worktree, its own branch, and its own dev-server port.

### Worktree layout

Worktrees live **outside the repo** so they can never be committed into it:

```
C:/Users/diego/projects/Geoclick2027          <- the main checkout; orchestrator only
C:/Users/diego/projects/geoclick-wt/GC-010/   <- implementer worktree
C:/Users/diego/projects/geoclick-wt/GC-020/
C:/Users/diego/projects/geoclick-wt/GC-030/
```

`node scripts/task.mjs lease GC-010` creates the worktree, checks out the
branch from `tasks.yaml`, allocates the port, and writes the lease.
`node scripts/task.mjs release GC-010` tears the worktree down.

Claude Code's Agent tool also accepts `isolation: "worktree"`, which does the
same thing automatically. **Use the script, not the flag**, for task work: the
script pins the branch name from `tasks.yaml` (so the PR matches the plan),
allocates the port, and records the lease on the forge. The flag gives you a
random `worktree-agent-*` branch — this repo already has three such orphans
from earlier runs, which GC-002 deletes.

### Ports

Deterministic from the task's ordinal in `tasks.yaml`, so two agents never
collide and the assignment survives a restart:

```
port = 5173 + ordinal      # GC-001 -> 5174, GC-002 -> 5175, ...
```

Reserved range 5174–5199. `task.mjs lease` prints the port and writes it into
the lease record; the implementer runs `npm run dev --workspace=app -- --port <port>`.
Port 5173 stays free for the human.

### Build artefacts

`app/build`, `.svelte-kit` and `desktop/src-tauri/target` are gitignored and
live inside each worktree, so they isolate naturally. `node_modules` does not:
worktrees do not share it. **Each worktree runs its own `npm ci`.**

> **This is the exact thing that broke last time.** `ROADMAP.md`'s process note
> (2026-09-12) records worktree parallelism failing on this repo: without its
> own `node_modules`, a worktree's `npm run dev` cannot render a map, because
> Vite's `fs.allow` blocks the maplibre-gl worker outside the worktree root.
> Three branches had to be redone serially. That note's own prescription is
> "solve the `node_modules` problem first (e.g. `npm install` inside each
> worktree)" — which is what this section does, and what **GC-000 exists to
> verify before anything else is leased.** Do not start the programme until
> GC-000 has passed. If it fails, escalate to the product owner; do not invent
> a different isolation scheme.

Do not junction or symlink a shared `node_modules` on Windows — npm workspaces
plus junctions is a known source of phantom resolution failures, and this repo
already has enough Windows-specific pain.

That install cost is the real limit on parallelism. **Concurrency cap: 3**
(`meta.concurrency_max` in `tasks.yaml`). Raise it only if disk and CPU allow;
GC-000 records the measured `npm ci` time and disk footprint to inform that.

### Lease protocol

A lease is forge-first so it works across machines:

1. Orchestrator assigns the issue to itself and applies `state:leased`.
2. It posts a comment containing a fenced `json` block:
   `{"task":"GC-010","agent":"impl-1","host":"DIEGO-PC","worktree":"...","branch":"...","port":5174,"acquiredAt":"<ISO>","ttlMinutes":90}`
3. `scripts/task.mjs` mirrors it to `.orchestrator/leases/GC-010.json` (gitignored)
   purely as a local cache. **The forge comment is authoritative.**
4. TTL 90 minutes. On expiry the orchestrator reclaims: unassign, drop
   `state:leased` back to `state:ready`, comment why, remove the worktree.

An expired lease is not a failure — a long High-effort task should renew by
posting a fresh lease comment before the TTL elapses.

## The review loop

### Handoff

The implementer opens a **draft PR** against the release branch with:

- title `GC-0NN: <title from tasks.yaml>`
- body containing `Closes #<issue>`, the DoD as a checked list, and pasted
  output of `node scripts/task.mjs gates`
- the `state:in-review` label moved on the issue

The orchestrator then spawns a Reviewer with a **cold context** — a fresh
agent, never `subagent_type: "fork"`. It is handed exactly:

- the issue number and the task's full `description` + `dod` from `tasks.yaml`
- the branch name and `git diff <release-branch>...<branch>`
- the specific `review_refs` findings the task closes
- nothing about how the implementer reasoned

### Verdicts

| Verdict | Meaning | Next |
|---|---|---|
| `approve` | Every DoD item is met; gates pass on a clean checkout. | Orchestrator integrates. |
| `changes-requested` | Specific, actionable `file:line` asks. | Back to the implementer. |
| `reject-scope` | The branch does something the task did not ask for, or omits something it did. | Straight to the human — this is a spec problem. |

The reviewer posts a real PR review (`gh pr review`) so the verdict is visible
on the forge, and re-runs the gates itself in a clean worktree rather than
trusting the pasted output.

### On `changes-requested`

**Resume the original implementer** via `SendMessage` with its agent id. It
still holds the context; a fresh agent would re-derive the whole task and is
both slower and likelier to undo something deliberate.

### Escalation

**Two rounds, then stop.** If the reviewer requests changes a second time on
the same task, the orchestrator:

1. applies `state:escalated`,
2. posts one comment summarising what the implementer did, what the reviewer
   asked for twice, and where they disagree,
3. drops the task and moves on to the next ready one.

Rationale: two competent agents disagreeing twice about a task whose DoD is
written down is evidence the **DoD is wrong**, not that the implementer is.
Iterating a third time burns tokens re-litigating an underspecified spec. The
human adjudicates by editing the task in `tasks.yaml` and setting the issue
back to `state:ready` or `state:in-progress`.

`reject-scope` skips straight to escalation — no second round.

## Integrator mode

The orchestrator runs this after each `approve`:

1. `git fetch`, rebase the task branch onto `release/x.y.z`.
2. If the rebase conflicts: **do not resolve it by guessing.** Label
   `state:blocked`, comment with the conflicting paths, and check whether the
   conflict reveals a missing edge in the DAG — if so, add it to `tasks.yaml`
   and say so on the issue.
3. Re-run gates on the rebased branch.
4. `gh pr ready` then `gh pr merge --squash --delete-branch` **into the
   release branch only**.
5. Apply `state:integrated`; run `task.mjs release <id>` to drop the worktree.
6. Re-evaluate the DAG: any task whose deps are now all `state:integrated`
   moves `state:backlog → state:ready`.

The orchestrator never touches `main`. Not once.

## Multi-machine

Nothing in this plan assumes one box. To add a second machine:

1. Clone the repo, `nvm use` (`.nvmrc` says 24), `npm ci`, `gh auth login`.
2. Start an orchestrator session there with a `--only` filter, or let the
   primary orchestrator lease tasks and a human start implementers locally.
3. Nothing else. Leases, states, branches and PR status are all on GitHub.

**What must never live only on one box:** task state, lease records, review
verdicts, the DAG. All of those are forge objects. The local
`.orchestrator/leases/*.json` mirror is a cache and is gitignored — deleting it
must be harmless, and if it ever is not, that is a bug.

**Machine-capability routing.** Each task carries a `needs` list in
`tasks.yaml`. Every task in this programme has `needs: []` — deliberately: the
one candidate for `needs: [wsl2]` was regenerating all 44 tilesets for GC-032,
and that task is explicitly scoped to avoid retiling for exactly this reason.
If a future task needs WSL2 (`ogr2ogr`/`tippecanoe`/`pmtiles`), Rust, or
Android Studio, tag it and the orchestrator will only lease it to a machine
that advertises that capability.

## Hard rules for every agent

1. **Never merge to `main`.** Not the orchestrator, not an implementer, not a
   reviewer. Release branch is the ceiling.
2. **Never trigger a Netlify deploy** — not via the MCP `deploy-site` tool, not
   by pushing `main`, not "just to check".
3. **Never push to a branch you do not own.** One branch, one task, one agent.
4. Every commit ends with the attribution trailer in `tasks.yaml`'s
   `meta.attribution_trailer`.
5. Gates before review. Always. No "it's a docs-only change".
6. Stay in scope. Spotting an unrelated problem means filing an issue, not
   fixing it. `reject-scope` exists to enforce this.
7. If a task's description turns out to be wrong, **stop and say so** rather
   than improvising a different task.
