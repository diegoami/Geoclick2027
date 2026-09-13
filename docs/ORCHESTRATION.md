# Geoclick — Orchestration

How the 15 tasks in [`tasks.yaml`](tasks.yaml) actually get executed, on one
machine, with no forge. Roadmap: [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md).
Release policy: [`RELEASES.md`](RELEASES.md).

> **Second draft (2026-09-13).** The first draft ran on GitHub issues, labels
> and milestones, with four engines and `release/*` branches. Per the product
> owner's direction this is now **local harnesses only, two engines, straight to
> `main`**. The parts that were never GitHub-shaped — the worktree/port/lease
> protocol, cold-context review, no-fork-for-review, two-rounds-then-escalate,
> the human as sole merge authority — carry over unchanged. Everything that
> depended on the forge as shared state is replaced below.

## Who runs this

**The product owner (the human) starts one orchestrator session and leaves it
running.** Everything else is spawned by that session. The human's recurring
duties are: approving each merge to `main`, and adjudicating escalations.

```bash
# 0. see what would be created — creates nothing
node scripts/task.mjs init --dry-run

# 1. seed local task state (.orchestrator/state/GC-0NN.json, one per task)
node scripts/task.mjs init

# 2. start the orchestrator
claude --model opus
> Read docs/ORCHESTRATION.md and docs/tasks.yaml. You are the Orchestrator.
> Start with GC-001; it must land alone. Then work wave 1.
> Stop and ask me before every merge to main.
```

There is no step that creates issues, labels, milestones or release branches.
There is nothing to authenticate to.

The orchestrator is **stateless across restarts by design**: all authoritative
state lives in `.orchestrator/state/`, never in the session's head. Kill the
session, start a new one with the same prompt, and `node scripts/task.mjs
status` tells it exactly where the programme stands.

## Roles

Four roles. Three are agents; the fourth is the human. No role exists for
symmetry — each is here because something would otherwise go wrong.

| Role | Who | Engine | Why it exists |
|---|---|---|---|
| **Orchestrator** | long-lived Claude Code session | `opus` | Schedules, leases, spawns, integrates, cuts releases. Long-horizon agentic work over a 15-task DAG. Writes no product code. |
| **Implementer** | one agent per task, in its own worktree | `sonnet` | Does the work. Every task in this programme is well-specified implementation with tests. |
| **Reviewer** | one agent per review round, **cold context** | `opus` | Catches what the implementer cannot see. Must not be a fork of the implementer — a fork inherits the implementer's assumptions, which is exactly what review is for. |
| **Merge authority** | the human | — | CLAUDE.md reserves `main` merges for the user's explicit OK. It is a testing/review gate, not a cost gate — build cost stopped being a constraint on 2026-09-13 — and it stands either way. |

There is **no fable role** and nothing substitutes for one. The first draft gave
fable the orchestrator seat and one design task (GC-032); the orchestrator seat
is opus now, and GC-032 implements on sonnet under opus review like every other
task. See REMEDIATION_PLAN.md's engine rubric for the escalation valve.

### Why there is no separate Integrator agent

Integration here is two mechanical steps — rebase a task branch onto `main`, and
merge it — plus one judgement call, "may this go to `main`", which CLAUDE.md
already reserves for the human. A dedicated agent would add a handoff without
adding a decision. **The orchestrator performs integration itself**, in an
explicit Integrator mode described below. A merge conflict it cannot resolve
mechanically is escalated, not guessed at.

### Why there is no separate QA agent

The gates are scripted (`node scripts/task.mjs gates`). The implementer runs
them before requesting review; the reviewer re-runs them in a clean worktree. A
third party running the same script adds latency and nothing else.

## Task state, without a forge

This is the biggest structural change from the first draft, so it gets the most
detail.

### The problem

The first draft put task state on GitHub issue labels specifically to avoid a
race: several agents running concurrently, all needing to read and update shared
scheduling state. The obvious local replacement — a `status:` field per task in
`tasks.yaml` — reintroduces exactly that race. Three agents doing
read-modify-write on one YAML file will lose updates, and the failure is silent:
a clobbered `status` looks like a task that simply never progressed.

A lockfile would work but adds a thing that can be held by a dead process.

### The answer: one file per task, single-writer by construction

```
.orchestrator/                 (gitignored; lives in the MAIN checkout)
  state/
    GC-001.json                <- authoritative state for GC-001, and only GC-001
    GC-010.json
    ...
  handoff/
    GC-010.md                  <- the review packet (see "The review loop")
```

**No two agents ever write the same path.** The task id is in the filename, and
an agent only ever owns one task, so the concurrent-write race does not need to
be solved — it does not exist. Writes go through `scripts/task.mjs`, which
writes a sibling temp file and renames it over the target (atomic on NTFS), so
even a crash mid-write cannot leave a half-parsed state file.

`tasks.yaml` becomes **immutable spec**. It holds what a task *is*; the state
directory holds where that task *is up to*. They are never both edited by the
same actor for the same reason, which is the whole point of splitting them. The
only time `tasks.yaml` changes during the programme is when the human rewrites
an underspecified task after an escalation — a deliberate, single-writer,
human-initiated edit.

A state file looks like this:

```json
{
  "task": "GC-010",
  "state": "in-review",
  "round": 1,
  "agent": "impl-gc-010",
  "host": "DIEGO-PC",
  "branch": "fix/gc-010-srs-scheduler",
  "worktree": "C:/Users/diego/projects/geoclick-wt/GC-010",
  "port": 5177,
  "leasedAt": "2026-09-13T10:04:11.201Z",
  "ttlMinutes": 90,
  "updatedAt": "2026-09-13T11:22:40.880Z",
  "history": [
    { "at": "2026-09-13T10:04:11.201Z", "state": "leased", "note": "worktree created" },
    { "at": "2026-09-13T11:22:40.880Z", "state": "in-review", "note": "gates green, round 1" }
  ]
}
```

`history` is append-only and is what a restarted orchestrator reads to
understand *how* a task got where it is — it replaces the issue comment thread.

### It must live in the main checkout, not the worktree

Implementers run inside `../geoclick-wt/GC-0NN/`, which has its own copy of
`scripts/`. If state were resolved relative to the script, each worktree would
get its own private `.orchestrator/` and the orchestrator would see nothing.
`scripts/task.mjs` therefore resolves the **main checkout** via
`git rev-parse --git-common-dir` (a worktree's `.git` file points back at the
main repo's git dir) and anchors `.orchestrator/` there. One state directory,
visible from every worktree. This is a real trap and the reason it is written
down.

### Commands

```bash
node scripts/task.mjs init [--dry-run]     # seed state for every task in tasks.yaml
node scripts/task.mjs status [--json]      # the board: every task, its state, its lease
node scripts/task.mjs next                 # tasks whose deps are integrated and which are unleased
node scripts/task.mjs state GC-010 in-review --note "gates green"
node scripts/task.mjs lease GC-010 --agent impl-gc-010
node scripts/task.mjs release GC-010       # tear the worktree down
node scripts/task.mjs handoff GC-010       # print/write the review packet
node scripts/task.mjs gates [--json]       # the four quality gates
```

`init` is idempotent and never overwrites an existing state file — re-running it
after adding a task to `tasks.yaml` seeds only the new one. It replaces
`scripts/seed-forge.mjs`, which is deleted.

### The state machine

```
  backlog ──► ready ──► leased ──► in-progress ──► in-review ──┬──► approved ──► integrated ──► released
     ▲                    │             ▲                       │
     │                    │             └── changes-requested ◄─┘
     │                    │                      │
     └──── blocked ◄──────┘                      └─(2nd round)─► escalated ──► (human) ──► ready | in-progress
```

| State | Set by | Means |
|---|---|---|
| `backlog` | `task.mjs init` | Exists, dependencies unmet. |
| `ready` | orchestrator | All deps `integrated` into `main`; may be leased. |
| `leased` | orchestrator | Worktree + branch + port allocated; agent starting. |
| `in-progress` | implementer | Working. |
| `in-review` | implementer | Branch pushed, gates pass, handoff packet written. |
| `changes-requested` | reviewer | Specific `file:line` changes asked for. `round` increments. |
| `approved` | reviewer | Ready to integrate. |
| `integrated` | orchestrator | Merged into `main` **after the human's OK**. |
| `released` | orchestrator | Included in a pushed tag (see RELEASES.md). |
| `blocked` | anyone | Cannot proceed; reason in the `note`. |
| `escalated` | orchestrator | Implementer and reviewer disagreed twice. Human owns it. |

`task.mjs state` refuses a transition the machine above does not allow, so a
confused agent gets an error rather than a plausible-looking wrong board.

## Exclusive machine access

Parallel agents cannot share one working tree. Every leased task gets its own
git worktree, its own branch, and its own dev-server port. None of this changed
— it was never GitHub-shaped.

### Worktree layout

Worktrees live **outside the repo** so they can never be committed into it:

```
C:/Users/diego/projects/Geoclick2027          <- the main checkout; orchestrator only
C:/Users/diego/projects/geoclick-wt/GC-010/   <- implementer worktree
C:/Users/diego/projects/geoclick-wt/GC-020/
C:/Users/diego/projects/geoclick-wt/GC-030/
```

`node scripts/task.mjs lease GC-010` creates the worktree, branches from `main`
using the branch name in `tasks.yaml`, allocates the port, and writes the lease
into that task's state file. `node scripts/task.mjs release GC-010` tears the
worktree down.

Claude Code's Agent tool also accepts `isolation: "worktree"`, which does the
same thing automatically. **Use the script, not the flag**, for task work: the
script pins the branch name from `tasks.yaml` (so the branch matches the plan),
allocates the port, and records the lease. The flag gives you a random
`worktree-agent-*` branch — this repo already has three such orphans from
earlier runs, which GC-002 deletes.

### Ports

Deterministic from the task's ordinal in `tasks.yaml`, so two agents never
collide and the assignment survives a restart:

```
port = 5173 + ordinal      # GC-001 -> 5174, GC-002 -> 5175, ...
```

Reserved range 5174–5199. `task.mjs lease` prints the port and records it in the
state file; the implementer runs
`npm run dev --workspace=app -- --port <port>`. Port 5173 stays free for the
human.

### Build artefacts and `node_modules`

`app/build`, `.svelte-kit` and `desktop/src-tauri/target` are gitignored and
live inside each worktree, so they isolate naturally. `node_modules` does not:
worktrees do not share it. **Each worktree runs its own `npm install` before
anything else.**

> This is the thing that broke on 2026-09-12 — and it is **solved**. A worktree
> with no `node_modules` of its own cannot render a map, because npm workspaces
> hoists the install to the main checkout and Vite's `fs.allow` then blocks the
> maplibre-gl worker. Running `npm install` inside the worktree fixes it:
> verified 2026-09-13 by starting a worktree dev server and comparing its
> network requests against the main checkout side by side — identical
> `206 Partial Content` tile responses through the worker. See `ROADMAP.md`'s
> "Process notes". **Do not re-verify this and do not budget a task for it.**
> Just never skip the install.

Do not junction or symlink a shared `node_modules` on Windows — npm workspaces
plus junctions is a known source of phantom resolution failures, and this repo
already has enough Windows-specific pain.

That install cost is the real limit on parallelism. **Concurrency cap: 3**
(`meta.concurrency_max` in `tasks.yaml`). Raise it only if disk and CPU allow.

### Lease protocol

A lease is a field group inside the task's own state file — the same
single-writer file described above, so there is no separate lease store to keep
consistent:

1. Orchestrator runs `task.mjs lease GC-010 --agent impl-gc-010`, which creates
   the worktree, allocates the port, sets `state: "leased"`, and stamps
   `leasedAt` + `ttlMinutes`.
2. The implementer sets `state: "in-progress"` when it starts.
3. TTL 90 minutes. On expiry the orchestrator reclaims: `task.mjs release
   GC-010`, set the state back to `ready` with a `note` saying why.
4. A long High-effort task **renews** by re-stamping the lease
   (`task.mjs lease GC-010 --renew`) before the TTL elapses. An expired lease is
   not a failure, but an unnoticed one costs a worktree.

## The review loop

### Handoff — what replaces the draft PR

**A branch name and a diff. That is all a review needs, and no new machinery is
invented for it.** Concretely, the implementer:

1. pushes its branch (`git push -u origin <branch>`),
2. runs `node scripts/task.mjs handoff GC-010`, which writes
   `.orchestrator/handoff/GC-010.md` containing: the task id and title, the
   branch, its base, `git diff --stat main...<branch>`, the commit list, the DoD
   from `tasks.yaml` as a checklist, and the JSON output of the gate run,
3. sets `state: "in-review"`.

The orchestrator then spawns a Reviewer with a **cold context** — a fresh agent,
never `subagent_type: "fork"`. It is handed exactly:

- the task's full `description` + `dod` from `tasks.yaml`,
- the branch name, and the instruction to read `git diff main...<branch>` itself
  (the packet's `--stat` is an index, not a substitute),
- the specific `review_refs` findings the task closes,
- nothing about how the implementer reasoned.

The handoff file is a convenience for the human and a restart-survivable record.
The branch is the artefact under review.

### Verdicts

| Verdict | Meaning | Next |
|---|---|---|
| `approve` | Every DoD item is met; gates pass on a clean checkout. | Orchestrator asks the human to merge. |
| `changes-requested` | Specific, actionable `file:line` asks. | Back to the implementer. |
| `reject-scope` | The branch does something the task did not ask for, or omits something it did. | Straight to the human — this is a spec problem. |

The reviewer records its verdict with `task.mjs state <id> approved|changes-requested`
and a `--note`, and **re-runs the gates itself in a clean worktree** rather than
trusting the pasted output. Detailed `file:line` asks go into
`.orchestrator/handoff/GC-0NN-round<N>-review.md` — a plain file, because there
is no PR to comment on.

### On `changes-requested`

**Resume the original implementer** via `SendMessage` with its agent id. It
still holds the context; a fresh agent would re-derive the whole task and is
both slower and likelier to undo something deliberate.

### Escalation

**Two rounds, then stop.** If the reviewer requests changes a second time on the
same task, the orchestrator:

1. sets `state: "escalated"`,
2. writes one summary into the task's state `note` and the handoff directory:
   what the implementer did, what the reviewer asked for twice, and where they
   disagree,
3. drops the task and moves on to the next ready one.

Rationale: two competent agents disagreeing twice about a task whose DoD is
written down is evidence the **DoD is wrong**, not that the implementer is.
Iterating a third time burns tokens re-litigating an underspecified spec. The
human adjudicates by editing the task in `tasks.yaml` and setting the state back
to `ready` or `in-progress` — and this is the one place where re-running that
single task on `opus` instead of `sonnet` is a legitimate, human-authorised
choice.

`reject-scope` skips straight to escalation — no second round.

## Integrator mode

The orchestrator runs this after each `approve`:

1. `git fetch`, rebase the task branch onto `main`.
2. If the rebase conflicts: **do not resolve it by guessing.** Set `blocked`
   with the conflicting paths in the note, and check whether the conflict
   reveals a missing edge in the DAG — if so, add it to `tasks.yaml` and say so.
3. Re-run gates on the rebased branch.
4. **Ask the human.** Show the task id, the diffstat, the gate summary, and what
   the reviewer said. Wait for an explicit OK. This is CLAUDE.md's rule and it
   does not bend.
5. On OK: `git merge --no-ff <branch>` into `main`, push, delete the branch.
   Set `state: "integrated"`.
6. `task.mjs release <id>` to drop the worktree.
7. Re-evaluate the DAG: any task whose deps are now all `integrated` moves
   `backlog → ready`.

Step 4 happens 15 times over the programme. If the product owner would rather
grant a standing OK for a whole wave at once, that is their call to make
explicitly — the orchestrator must never assume it.

**`main` is the integration branch.** There are no `release/*` branches in this
draft; the first draft only had them to ration paid Netlify builds, and that
constraint is gone (CLAUDE.md, 2026-09-13). What is *not* gone is the approval
gate in step 4 — those were two separate rules that happened to share a
justification, and only one of them was retired.

## One machine, by design

The first draft's multi-machine story ran entirely on GitHub: leases, states and
verdicts were forge objects, so a second box needed only `gh auth login`. With
state in a local directory, **this programme is single-machine**. That is a
deliberate consequence of "local harnesses only", not an oversight.

If a second machine is ever wanted, the honest options are a shared filesystem
for `.orchestrator/`, or going back to a forge. Do not invent a sync protocol
for a 15-task programme that runs on one laptop.

The `needs:` (machine-capability) field is gone from `tasks.yaml` for the same
reason: every task in this programme runs on plain node + npm. The one candidate
for a WSL2 requirement was regenerating all 44 tilesets, and GC-032 is
explicitly scoped to avoid retiling.

## Hard rules for every agent

1. **Never merge to `main` without the human's explicit OK.** Not the
   orchestrator, not an implementer, not a reviewer. `main` is the integration
   branch, and it is still gated.
2. **Never trigger a Netlify deploy** — not via the MCP `deploy-site` tool, not
   manually, not "just to check". Push, and let the git-triggered build happen.
3. **Never push to a branch you do not own.** One branch, one task, one agent.
4. **Never write another task's state file.** One writer per file is the entire
   concurrency design.
5. Every commit ends with the attribution trailer in `tasks.yaml`'s
   `meta.attribution_trailer`.
6. Gates before review. Always. No "it's a docs-only change".
7. Stay in scope. Spotting an unrelated problem means reporting it, not fixing
   it. `reject-scope` exists to enforce this.
8. If a task's description turns out to be wrong, **stop and say so** rather
   than improvising a different task.
9. **Run `npm install` in your worktree first.** Every time. See above.
