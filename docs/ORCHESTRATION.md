# Geoclick — Orchestration

How the 19 tasks in [`tasks.yaml`](tasks.yaml) get executed: **one Opus agent,
one task at a time, in a loop, in the main checkout.** Roadmap:
[`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md). Release policy:
[`RELEASES.md`](RELEASES.md).

> **Third draft (2026-09-13).** Draft 1 was GitHub-driven, four engines,
> release-branch buffered. Draft 2 cut that to a local harness with two engines
> (sonnet implements, opus reviews). The product owner then cut it once more:
> *"for complex tasks let us Opus do them, or maybe let us just Opus do the
> change alone, no two steps required, no multi agent, just loop."* So there is
> no implementer/reviewer split, no subagents, no worktrees, no leases, no
> ports to allocate. One agent works the DAG in order and stops at each merge
> for the product owner's OK. Everything that is gone was removed because it
> was machinery, not because the discipline behind it was wrong — the gates,
> the DoD-before-approval rule, and "stop after two failed attempts" all stay.

## Who runs this

```bash
# 0. see what would be created — writes nothing
node scripts/task.mjs init --dry-run

# 1. seed local task state (one JSON file per task, gitignored)
node scripts/task.mjs init

# 2. confirm the machine is clean before starting
node scripts/task.mjs doctor

# 3. start the loop
claude --model opus
> Read docs/ORCHESTRATION.md, docs/REMEDIATION_PLAN.md and docs/tasks.yaml.
> You are running the remediation loop. Work one task at a time, starting with
> `node scripts/task.mjs next`. Stop and ask me before every merge to main.
```

That is the whole setup. Nothing to authenticate to, no issues to create, no
release branches, no second agent to brief.

### Run it as its own interactive session, not as a background agent

**The loop is a session the product owner can see and type into.** Start it in
its own terminal and talk to it directly — that is where "finish this task then
stop", "yes, merge it" and Ctrl+C go.

Do **not** run the loop as a background subagent of another session. It has to
stop and ask for approval **19 times**, once per merge; that is its normal
operating mode, not an exception. Relayed through a parent session, every one of
those approvals becomes a round trip with the agent's progress invisible in
between. An interactive session makes the thing it does most often — ask — the
cheapest thing it does.

The corollary: a **different** session is the right place to change the plan.
The loop treats `tasks.yaml` and these docs as read-only spec (hard rule 6), so
re-scoping a task, re-batching a release or rewriting a DoD after an escalation
happens in a separate session, in a commit, while the loop is stopped or parked.
And to know where things stand, nobody needs to ask an agent at all: read the
ledger in [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) or run
`node scripts/task.mjs status`.

## The loop

One iteration, start to finish. The agent repeats it until `next` says the
programme is done.

```
   ┌─► 1. next            node scripts/task.mjs next
   │   2. read the spec   node scripts/task.mjs show GC-0NN
   │   3. start           node scripts/task.mjs start GC-0NN     (branch + in-progress)
   │   4. do the work     smallest commits that still make sense
   │   5. gates           node scripts/task.mjs gates            (all four, green)
   │   6. self-check      re-read the DoD line by line; verify by hand what the
   │                      DoD says to verify by hand
   │   7. worklog         node scripts/task.mjs log GC-0NN
   │   8. push + ask      git push -u origin <branch>
   │                      node scripts/task.mjs state GC-0NN awaiting-approval
   │                      → ASK THE PRODUCT OWNER. WAIT.
   │   9. merge on OK     git checkout main && git merge --no-ff <branch> && git push
   │  10. finish          node scripts/task.mjs finish GC-0NN    (cleanup + integrated)
   │  11. tick the ledger the progress table in REMEDIATION_PLAN.md
   │  12. doctor          node scripts/task.mjs doctor           (no zombies)
   └───  13. batch done?  if the wave just closed → cut the release (RELEASES.md)
```

Steps 8 and 9 are the only places the loop blocks on a human, and it must.
Everything else the agent does on its own.

### Why there is no reviewer

There were two arguments for a separate cold-context reviewer: a fresh pair of
eyes catches what the author cannot see, and the author is a poor judge of its
own DoD. Both are real. Neither survives the product owner's decision to run one
Opus agent, and the replacement is not "nothing":

- **The gates are the mechanical reviewer.** Four commands, scripted, run before
  every approval request. They catch what a second agent would mostly have
  caught: type errors, broken tests, formatting, a build that does not build.
- **The product owner is the judgement reviewer**, at step 8, with the branch,
  the diff and the worklog in front of them. That gate already existed; it now
  carries the whole weight rather than sharing it.
- **`/code-review` is available without spawning anything.** It is an existing
  skill, not a subagent in this design's sense. For a High-effort task (GC-021,
  GC-032) running it on the branch before step 8 is cheap and sensible.

What is genuinely lost: an independent agent that never saw the author's
reasoning. Accept it knowingly — the honest mitigation is that every task has a
written DoD, and the product owner reads the diff.

### Attempts, and when to stop

Draft 2's "two review rounds then escalate" becomes **two attempts then stop**:

- If the product owner asks for changes, the task goes back to `in-progress`
  (`changes-requested` bumps the attempt count).
- If they ask for changes a **second** time on the same task, do not start a
  third round. Set `escalated`, say plainly what you tried and where you and the
  spec disagree, and move to the next task.

The reasoning is unchanged: a task with a written DoD that fails twice is
evidence the **DoD is wrong**, not that the work is. The product owner
adjudicates by editing the task in `tasks.yaml` and setting it back to `ready`.

## Stopping and resuming

**There is no harness process to stop.** `scripts/task.mjs` runs one command and
exits; the only long-lived thing is the Claude Code session running the loop, and
possibly a dev server it started. So stopping is always about the session plus
the one task in flight.

### Stopping cleanly (preferred)

Between iterations — after a `finish`, before the next `start` — the programme
is already at rest. Nothing is in flight, the tree is on `main`, the ledger is
current. Just stop the session. To pick a natural stopping point, tell the loop
*"finish the current task, then stop"* rather than interrupting it.

### Stopping mid-task

Say so, or interrupt with Ctrl+C. Then park the task so the board does not claim
work is happening that is not:

```bash
node scripts/task.mjs state GC-0NN ready --note "parked <date>: <why>"
node scripts/task.mjs doctor              # is a dev server still up? a branch half-done?
```

Before walking away, deal with the work in progress — it lives on the task
branch, so nothing is lost either way:

```bash
git status                                # what is uncommitted
git commit -am "WIP: GC-0NN <what is done so far>"   # keep it on the branch
git push -u origin <branch>               # optional, survives the machine
```

Leave the branch in place. The next `start GC-0NN` checks it out again rather
than creating it, so a parked task resumes exactly where it stopped. What you
must **not** leave behind is an uncommitted working tree plus a `ready` state:
the next `start` refuses a dirty tree (deliberately), and you will not remember
which task those edits belonged to.

If the dev server is still running, stop it. That is the one true zombie an
abrupt stop creates, and `doctor` will report the port and PID.

### The one task where stopping mid-way is genuinely awkward

**GC-001.** It renormalizes line endings across every text file in the tree, so
a half-applied state looks like "everything is modified" and is hard to read. If
you have to stop during GC-001, prefer `git stash` or a full reset back to
`main` and redo it — it is a mechanical task that takes minutes, and redoing it
is cheaper than untangling a partial renormalization.

### Resuming

```bash
node scripts/task.mjs doctor     # clean up whatever the stop left behind
node scripts/task.mjs status     # where the programme actually stands
node scripts/task.mjs next       # what to do now (or `start GC-0NN` to resume a parked one)
```

Then start a fresh session with the same prompt as the first one. The loop is
stateless across restarts by design: everything it needs is in `tasks.yaml`, the
state files, the ledger, and git itself. A new session does not need to be told
what happened — `status` tells it.

### Stopping the programme for good, or changing direction

The state files are disposable: `rm -rf .orchestrator` and the live board is
gone, while every merged task stays merged and every tag stays pushed. `init`
re-seeds from scratch. What you should keep current in that case is the
**ledger** in REMEDIATION_PLAN.md, since that is the record of what actually
shipped — and if the programme stops part-way, say so in that table rather than
leaving rows reading `todo` forever.

## Task state

Two places, on purpose.

| | `docs/tasks.yaml` + the ledger in `REMEDIATION_PLAN.md` | `.orchestrator/state/GC-0NN.json` |
|---|---|---|
| Holds | the plan, and the progress the **product owner** reads | the live state the **loop** reads |
| Written by | humans, and the agent ticking a box at merge time | `scripts/task.mjs` only |
| Committed | yes | no (gitignored) |
| Lifetime | forever | one programme run |

With one agent there is no concurrent-write race to design around, so the state
files are simply the loop's memory across restarts. They are still one file per
task, written temp-file-then-rename, with a transition table that refuses an
illegal move — cheap insurance against a confused session recording a state that
never happened.

**The committed ledger is what makes the programme trackable.** State files are
gitignored and machine-local; the product owner should never have to run a
command to know where things stand. Step 11 of the loop is not optional.

If `.orchestrator/` is lost, nothing real is lost: `init` re-seeds it, and git is
the ground truth for what actually happened (which branches exist, what is
merged into `main`, which tags are pushed).

### States

```
  backlog ──► ready ──► in-progress ──► awaiting-approval ──► integrated ──► released
     ▲                     ▲                    │
     │                     └── changes-requested ┘
     │                              │
     └──── blocked                  └─(2nd time)─► escalated ──► (owner) ──► ready
```

| State | Means |
|---|---|
| `backlog` | Exists; dependencies not merged yet. |
| `ready` | Dependencies are in `main`; startable. |
| `in-progress` | The loop is working it, on its branch. |
| `awaiting-approval` | Gates green, DoD met, branch pushed. **The product owner's turn.** |
| `changes-requested` | The owner asked for changes. Attempt count goes up. |
| `integrated` | Merged into `main` with the owner's OK. |
| `released` | Included in a pushed tag (RELEASES.md). |
| `blocked` | Cannot proceed; reason in the note. |
| `escalated` | Two failed attempts, or a spec problem. The owner owns it. |

`node scripts/task.mjs state <id> <state> --note "..."` is the only way to move
between them.

## Working in the main checkout

Draft 2 gave every task its own git worktree, its own branch and its own port,
because three agents cannot share one working tree. One agent can. So:

- **One branch at a time**, named in `tasks.yaml`, created off `main` by
  `task.mjs start`, deleted by `task.mjs finish` after the merge.
- **`start` refuses a dirty tree.** Commit, stash or clean first. This is what
  stops one task's leftovers from riding along in the next task's diff.
- **`start` refuses if another task is still open**, and refuses if a dependency
  is not yet merged. Both are `--force`-able, and both should make you stop and
  think rather than reach for the flag.
- **One dev-server port: 5174.** Fixed, not allocated. Port 5173 stays free for
  the product owner's own server, so the two never collide.
- **No worktrees.** `git worktree` is not part of this design; `doctor` treats
  any worktree other than the main checkout as a leftover to remove. The
  2026-09-12/13 worktree investigation (ROADMAP.md's process notes) is settled
  history now, not something this programme depends on either way.

`node_modules` needs no special handling any more — one checkout, one install.
That entire class of problem disappeared with the worktrees.

## No zombies

The product owner asked for this explicitly, and the old design was the thing
that created them: nine worktrees, nine `node_modules`, nine dev servers, and a
branch per task. Draft 3's answer is mostly structural — there is only ever one
branch, one checkout and one server — plus a sweeper for what still slips
through.

```bash
node scripts/task.mjs doctor         # report
node scripts/task.mjs doctor --fix   # clean up the safe ones
```

`doctor` checks, and `--fix` repairs where it is safe to do so:

| Zombie | Detected | `--fix` |
|---|---|---|
| A git worktree other than the main checkout | `git worktree list` | removes it, then prunes |
| The old `../geoclick-wt/` directory | filesystem | reported (delete by hand) |
| `worktree-agent-*` branches from earlier runs | `for-each-ref` | deletes them |
| A task branch already merged but never deleted | `branch --merged main` | deletes it |
| Other long-merged branches (`feature/*`) | `branch --merged main` | reported only — some are history the owner wants |
| A task marked active whose branch does not exist | state vs git | reported with the fix command |
| A task marked integrated whose branch still exists | state vs git | reported (`finish` it) |
| More than one task in flight | state files | reported — park all but one |
| Interrupted state writes (`*.json.tmp`) | state dir | deletes them |
| State files for tasks that no longer exist | state dir | deletes them |
| Something listening on 5173–5199 | `netstat` / `lsof` | **reported only, with the PID** |

**`doctor` never kills a process.** Port 5173 is very likely the product owner's
own dev server, and a harness that kills windows out from under its user is
worse than a stray node process. It prints the PID and the command; the decision
is a human's.

Run `doctor` at step 12 of every loop iteration, and before cutting a release.
"No zombies" is a per-iteration habit, not an end-of-programme cleanup.

The loop's own hygiene rules, which are what actually prevent most of it:

1. **Stop the dev server before finishing a task.** Never leave one running
   across iterations; the next task starts on a different branch and a stale
   server serves a stale build.
2. **Never background a long-running command and walk away from it.** If you
   start something, you own stopping it.
3. **Delete the branch at `finish`**, local and remote. A pile of merged
   branches is how this repo got eleven of them.
4. **One task's work, one task's branch.** Spotting something unrelated means
   writing it in the worklog, not fixing it here.

## One machine

Local state means single-machine, by construction, and the product owner has
confirmed that is fine. There is no lease to transfer, no forge to share, and
nothing in `tasks.yaml` requires a capability beyond node + npm — GC-032 is
explicitly scoped to avoid retiling so that stays true (retiling would need the
WSL2 toolchain).

If a second machine is ever wanted, the honest answers are a shared checkout or
a forge. Do not invent a sync protocol for a 19-task programme on one laptop.

## Hard rules

1. **Never merge to `main` without the product owner's explicit OK.** `main` is
   the integration branch, and the gate in front of it is a person. Ask, show
   the diff and the worklog, and wait.
2. **Never trigger a Netlify deploy** — not via the MCP `deploy-site` tool, not
   manually, not "just to check". Push and let the git-triggered build run.
   Prod-check the live site once, after the push, and do not monitor deploys.
3. **Gates before approval. Always.** No "it's a docs-only change".
4. **One task at a time.** If `start` refuses because something is open, finish
   or park it — do not `--force` past it.
5. **Never hand-edit `.orchestrator/`.** Go through `scripts/task.mjs` so the
   transition table and the history apply. Reading it is fine.
6. **Never edit `docs/tasks.yaml`** during a run. It is the spec; only the
   product owner changes it, in a commit, after an escalation.
7. Every commit ends with the attribution trailer in `tasks.yaml`'s
   `meta.attribution_trailer`.
8. **Stay in scope.** An unrelated problem goes in the worklog, not in the diff.
9. If a task's description turns out to be wrong, **stop and say so** rather
   than improvising a different task.
10. **Leave no zombies.** Server stopped, branch deleted, `doctor` clean, before
    you call a task done.
