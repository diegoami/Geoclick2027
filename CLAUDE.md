# Geoclick — working notes for the implementing agent

The rulebook for every agent that works here, in Claude Code or OpenCode,
whatever the model (`AGENTS.md` points here). The file's name is
historical: where it says "Claude", read "the implementing agent".

Geography learning game. SvelteKit + MapLibre GL + PMTiles; Tauri (desktop),
Capacitor (Android); local-first SQLite; Natural Earth map data.

## 0. Context budget — read this first

This repo is ~150 hand-written source files wrapped in ~650 tracked files,
27 MB of generated map data, and ~160k tokens of prose. Reading it
indiscriminately exhausts the context window before any work starts.

**Canonical source. Work here:**

    app/src/{lib,routes}/       packages/{srs,quiz-engine}/src/
    data/scripts/*.ts           scripts/*.mjs
    data/facts/*.json           data/styles/base.json      <- AUTHORED, see below
    desktop/src-tauri/src/      mobile/android/app/src/main/{java,res/values}/
    root configs: package.json, netlify.toml, app/vite.config.*, app/eslint.config.js
    version manifests (scripts/sync-version.mjs writes all seven):
      {,app/,desktop/,mobile/}package.json, desktop/src-tauri/{tauri.conf.json,Cargo.toml},
      mobile/android/app/build.gradle
    also real, not generated: mobile/capacitor.config.ts,
      app/static/{_redirects,robots.txt}

**Never read, glob, or grep** (unless a task names one specific file):

| Path | Why |
|---|---|
| `app/static/maps`, `app/static/styles` | **prepared at build time** from `data/` (gitignored) — address the `data/` path |
| `mobile/android/app/src/main/assets/public/` | `cap sync` copy of `app/build` |
| `mobile/.../assets/capacitor.*.json`, `res/xml/config.xml` | generated — edit `mobile/capacitor.config.ts` |
| `data/maps/**` | 64 dirs, 126 binaries + ~330k tokens of generated JSON |
| `data/source/` | gitignored raw Natural Earth downloads |
| `data/places/*.geojson` | committed Wikidata snapshots (~1 000 towns each), written by `fetch-wikidata-places.ts` — grep one town at most |
| `node_modules/`, `app/.svelte-kit/`, `app/build/`, `dist*/`, `.netlify/` | deps + build output |
| `desktop/src-tauri/{target,gen}/`, `mobile/android/{.gradle,build}/`, `**/app/build/` | build output |
| `package-lock.json`, `Cargo.lock` | grep one version string at most; never open |
| `docs/manual/*.jpg`, `design/logo/*.png`, `**/icons/*`, `res/{mipmap,drawable}-*/*` | binaries |
| `app/.vscode/`, `.idea/`, `.orchestrator/`, `.git/` | tooling / machine-local |

**`data/facts/` is INPUT; `data/maps/*/facts.json` is output.** They are easy
to confuse and the cost of confusing them is high. `data/facts/<country>.json`
is 28 hand-authored files — 1 814 places, 5 448 sentences, the most laborious
content in the project and the subject of `docs/PLAN_V0.10.md`.
`build-facts.ts` **reads** them and **writes** `data/maps/<id>/facts.json`.
Edit the authored file and rebuild; never hand-edit the generated one.

**Map data is generated, not authored.** To understand a map's shape, read
`data/scripts/build-map.ts` and at most **one** sample `data/maps/*/map.json`.
Never enumerate `data/maps/`. To change map output, change the script and
rebuild.

**Prose is on-demand.** `DECISIONS.md` (18k words), `ROADMAP.md` (14k),
`MAPS.md` (10k), `CHANGELOG.md` (7.5k), `ONBOARDING.md` (5.7k), `docs/**`.
Never read one end-to-end to "get oriented". Locate, then slice:

    grep -n "terrain" ROADMAP.md | head -20
    sed -n '840,880p' ROADMAP.md

Writing to them is unchanged (see §3) — append/edit the relevant section
without re-reading the whole file.

**Search shape.** Scope every search; never follow symlinks.

    # good
    grep -rn "quizRound" app/src packages/*/src
    # bad — walks 26 MB of tiles twice
    grep -r "quizRound" .

## 1. Output discipline

- **Diffs only.** Show the changed function or hunk with a few lines of
  context. Never re-echo a whole file after editing it, and never paste a
  file back to confirm an edit landed.
- **No read-back-to-verify.** The edit tool errors if it fails; a clean
  result means it applied.
- **Cite, don't quote.** Refer to `app/src/lib/quizRound.ts:118`; quote code
  only when the exact text is the point.
- **Summaries are short.** What changed, where, how to verify. No recaps of
  work already reported in this session.
- **One plan, not three.** State the approach taken; don't enumerate
  alternatives that were rejected.

## 2. Quiet terminal

Commands here are loud by default. Filter at the source — never dump raw
output and then explain it.

    # Tests — the default reporter is verbose; override it (14 lines, 736 tests)
    npm run test:unit --workspace=app -- --run --reporter=dot 2>&1 | tail -20

    # All four gates at once — the release checklist's own step.
    # --quiet prints four PASS lines, or the tail of the gate that failed.
    npm run gates -- --quiet

    # Lint / typecheck — failures only
    npm run lint 2>&1 | grep -E "error|warning|✖" | head -30
    npm run check 2>&1 | tail -20

    # Build — confirm success, don't transcribe it
    npm run build 2>&1 | tail -15

    # Install — never stream it
    npm ci > /dev/null 2>&1 && echo "deps ok"

    # Map builds write 64 dirs of output
    npm run build-map -- <args> 2>&1 | tail -10

    # git — bounded by default
    git log --oneline -10        # never bare `git log`
    git status --short
    git diff --stat              # then `git diff -- <path>` for one file

Rules: always bound with `head`/`tail`; prefer `--short`/`--stat`/`--dot`;
`grep` for the failure rather than printing the pass; send installers and
downloads to `/dev/null`. If a command floods anyway, do not paste the
flood — report the one line that mattered.

## 3. Workflow (unchanged)

- New features/fixes: work in a **worktree of your own**, never in the main
  checkout and never directly on `main` (§3b has the layout and the exact
  commands). Commit and push without asking. Test locally and give the user
  concrete verification steps. Merge to `main` only after the user explicitly
  OKs it — a testing/review gate, not a cost gate. Doc-only changes need no
  review gate, but they still land from a worktree, never by committing in
  the main checkout. There is no automerge exception: the remediation loop
  (`docs/ORCHESTRATION.md`) that had one closed with v0.2.0.
- Keep `ROADMAP.md`, `ARCHITECTURE.md`, `ONBOARDING.md`, `DECISIONS.md`,
  `MAPS.md` current as work lands — each has a distinct charter (status /
  code map / newcomer guide / *why* / map build commands). Edit the relevant
  section; do not read the file whole to do it. When a later decision
  supersedes an earlier one, amend that entry rather than leaving a stale one
  to be found first.
- Releases are milestones (§3a): an annotated `vX.Y.Z` tag on `main`, on
  the exact commit that was reviewed and that the release is built from,
  with notes in `CHANGELOG.md`. Previews handed to any tester are published
  as alpha (an unmerged task branch) or beta (the milestone candidate)
  pre-releases — see `docs/RELEASES.md`. Say in the entry what was built
  and what was actually tried, rather than implying it.
- Roles: the user is Product Manager; the implementing model is the
  Developer. Finish by telling the user exactly what to run/click and what
  to expect.
- **Design first.** A design proposal is a GitHub issue labelled
  `proposal`: the problem, findings with `file:line`, the design, and open
  questions each with a recommended answer. Propose, get the product
  owner's agreement, then branch. A per-release plan is one proposal (the
  `docs/PLAN_V*.md` file may hold the detail; the issue is the thread); a
  Medium or Large task, or a spike, gets its own. Small fixes inside an
  agreed plan need none. The owner's agreement is the gate; a proposal
  gets no independent review.
- **Independent review per milestone, never per PR** — see §3a.
- **"Test locally" and "test the deployment" are two separately labelled
  steps.** Verify locally first and say so; only then check the live site,
  and say that too. While deploys are stopped (below) there is no live step
  — say so rather than skipping it silently. (Why: see `DECISIONS.md` —
  "Two labelled test steps".)
- Don't debug what the user can fix in two dashboard clicks. Try the direct
  tool once or twice, then hand it back. (Why: see `DECISIONS.md` — "Hand a
  dashboard problem back".)
- **Deploys are stopped** (product owner, 2026-09-22): a merge to `main` no
  longer publishes the web app. Never trigger a deploy yourself; restarting
  them is the product owner's call. (Why: see `DECISIONS.md` — "Netlify
  build cost".)

## 3a. Milestones and independent review

*Reviewer: if a review-handoff prompt brought you here, that prompt defines
your job; this file is the standard you review against.*

**A milestone is a release**: an annotated tag `vX.Y.Z` on `main`, on the
exact commit the published release is built from. It is not a branch, a PR,
a proposal, a count of merged PRs or a change to a particular file. Nothing
else triggers a review: not proposals, not PRs, not process or docs
changes. A beta is not a milestone; it is built from a candidate. The
releases go to the separate `diegoami/geoclick-releases` repository, but
the tag lives here, and the release notes name the tagged commit.

The implementing agent does the work itself and never spawns its own
reviewer. The review runs in a **different model from the implementer's**,
in whatever tool the owner picks (OpenCode, Codex, or another), in a fresh
session every time. Nothing here assumes one tool.

**How a milestone happens** (the steps in full: `docs/RELEASES.md`,
"The milestone"):

1. The owner calls a milestone, or Claude proposes one when a release is
   due or a coherent set of work has landed.
2. The version bump to `X.Y.Z` and the CHANGELOG entry land on `main` in an
   ordinary PR. Its merge commit is the **candidate**.
3. Claude opens a **milestone issue**: the proposed tag, the candidate's
   full SHA, the previous milestone tag, the PRs merged since, and the gate
   results on the candidate. From then on, **`main` takes only fixes for
   the milestone's findings** until it is tagged.
4. Claude gives the owner one review prompt (the `review-handoff` skill).
   The reviewer fetches first (`git fetch origin --tags <candidate SHA>`,
   never `git pull`, which could move a checkout it must not touch), makes a
   fresh detached worktree of its own at the candidate SHA under
   `<project>-review/review-<SHA first 12>-<stamp>` (§3b; never the checkout
   it started in), installs the dependencies there, confirms
   `git rev-parse HEAD` there, and reviews
   `git diff <previous tag>..<candidate SHA>`, opens one issue per
   reproduced finding, and posts one verdict comment, AGREE or BLOCK, on
   the milestone issue.
5. **The tag waits for the review.** BLOCK: the findings are fixed in
   ordinary PRs, the candidate moves to the new `main` commit (the issue
   says so), and Claude gives a re-review prompt without being asked.
   **Round ceiling:** if a third round does not end in AGREE, the decision
   goes to the owner.
6. AGREE: Claude creates the tag on **exactly the reviewed SHA**, never on
   a later commit, and builds the release from that tag. Work merged after
   the candidate belongs to the next milestone. The installer and device
   checks `docs/RELEASES.md` requires happen before tagging. Claude
   publishes to geoclick-releases (the owner's standing permission).
7. The owner may tag without a review; the milestone issue records that.

The reviewer posts to GitHub itself, and nothing is pasted back:

- **one issue per reproduced finding**, labelled `review` plus a category
  label (`bug`, `robustness`, `tests`, `design`, `cleanup`,
  `documentation`), linking back to the milestone issue and the SHA;
- **always one verdict comment** on the milestone issue: AGREE, or BLOCK
  when any finding is MUST-FIX; the SHA reviewed and the worktree it
  reviewed in (a relative path), the issues it opened,
  what it checked and found clean. A review that finds nothing still
  leaves a record.

Severities: **MUST-FIX** (fix before the tag), **SHOULD**, and **OUT OF
SCOPE** (not caused by this milestone's changes). Every issue and comment
body is written to a file as UTF-8 without a BOM and passed with
`--body-file`.

When the owner says the review is in: read it from GitHub, reproduce each
finding before acting on it, and fix it (`Fixes #n` in a PR) or rebut it
with evidence on the issue. Owner decisions go to the owner with a
recommended default, not into the code. (Why: see `DECISIONS.md` — "A
milestone is a release tag, reviewed before it is created".)

## 3b. Who works where (worktrees)

**The main checkout `<project>/` is not an implementer's or a reviewer's
workspace.** No implementer works, checks out a branch or commits there, and
no reviewer does either — no `git checkout`, `git switch` or `gh pr
checkout`. A session opened there updates it (below) and plans, then moves
into a worktree of its own. If the checkout is not on the default branch, or
has uncommitted changes, leave it exactly as it is and tell the owner why:
those may be someone's work in progress.

The names below stand for the real paths:

- **`<main>`** is the parent of
  `git rev-parse --path-format=absolute --git-common-dir`; **`<project>`** is
  `<main>`'s name; **`origin/<default>`** is the branch
  `git symbolic-ref --short refs/remotes/origin/HEAD` names.
- Every session begins with the main checkout's update (below) and
  `git worktree list`, so the checkout is not hiding another session's work.

**Implementing:**

- **Every session that implements works in a worktree of its own, one per
  change.** A Claude Code forked subagent uses the tool's own worktree
  isolation (under `.claude/worktrees/`, gitignored). Every other session —
  OpenCode, Codex, a headless session, or a new session the owner opens in
  `<project>/` and asks to implement a feature — updates the main checkout
  first (below), then makes its own:

      git worktree add --no-track -b <branch> <main>/../<project>-work/<branch> origin/<default>

  If that branch or path already exists, add a UTC stamp to both.
  `--no-track` keeps the new branch off `origin/<default>`; its first push is
  `git push -u origin <branch>`. Work only in that worktree, **naming it in
  every command**, since a tool's shell may return to `<project>/` after each
  one. If you are about to edit, commit or switch branches in `<project>/`,
  stop and make the worktree first.
- **Install the worktree's dependencies before any check** (`npm ci`), never
  copying or linking them from the main checkout.

**Reviewing:**

- **Reviewers work in a worktree of their own too**, one per review round,
  detached at the exact commit under review, under
  `<project>-review/review-<SHA first 12>-<UTC stamp YYYYMMDDTHHMMSSZ>` beside
  the main checkout, and confirm `git rev-parse HEAD` there (§3a).

**Keeping the main checkout current:**

- **Every session opened in `<project>/`, whatever it is asked to do, starts
  by updating it**: `git fetch origin`, then `git pull --ff-only` — but only
  if it is on the default branch and has no uncommitted changes. Otherwise it
  leaves the checkout as it is and tells the owner why. It never resets,
  stashes or merges there. There may be no standing orchestrator, since a
  session asked to implement moves into a worktree, so the next session to
  start brings `<project>/` up to date. Nothing relies on it meanwhile:
  implementers start from `origin/<default>`, reviewers from an exact SHA.

**Cleaning up worktrees:**

- **A session removes only worktrees it made**: the implementer its own after
  the merge, if it is still running then (`git worktree remove <path>`, and
  its merged branch deleted); the reviewer its own once its verdict is
  recorded. Leftovers are the owner's to clean up, with a tool that proves
  each removal safe — a session does not guess which worktrees are unused.

**Elsewhere:**

- **In a cloud session**, the session's own clone takes the place of these
  folders; the fetch and commit checks still apply.
- **Windows:** `git config --global core.longpaths true` is a prerequisite,
  since nested worktree paths can pass the path limit. The owner sets it on
  the machine; an agent does not.

## 4. Session lifecycle

Every turn replays the whole transcript, so a costly read is re-billed on
every subsequent message.

- **One task per session.** A new feature, bug or map = a new thread.
- **Don't re-read** files already read this session, or re-summarise earlier
  turns.
- **At task completion, or every 5–6 user turns**, post the checkpoint
  below. If the session continues, re-post it — repeat, don't escalate,
  don't refuse to work, don't lecture.

```markdown
---
⚠️ **Context checkpoint — turn {N}.** This thread now replays its full history
on every message. Start a fresh chat before the next task to avoid paying for
this context again.

**Handoff for the next session:**
- **Done:** {one line — what changed, which files, which branch}
- **State:** {branch pushed / tests green / awaiting PO verification}
- **Next:** {the single next action, with the file path to open first}
```

**A chat message is not a handoff.** `/clear` discards the transcript, so
the three lines above also go into `docs/HANDOVER.md` — the file a fresh
session is told to read first. Update it in place; it is a snapshot of where
things stand, not an append-only log.

**Update the file _before_ posting the checkpoint, in the same turn** — they
are one action, not two (product owner's rule, 2026-09-20). Asking someone to
start a fresh session while `HANDOVER.md` still describes an older state
hands that session a stale snapshot, which is the precise failure the file
exists to prevent. If a task ends without a checkpoint, the file is still
updated; the chat copy is a prompt for the user, the file is what survives.

## 5. Working agreements with the owner

Agreed in conversation and kept, until 2026-09-27, only in one Claude
installation's memory. They bind every agent.

- **"Merged" means "I approve the merge".** Before acting on it, check
  `gh pr view <n> --json state`. If the PR is still open and mergeable,
  merge it with a merge commit and say so in one line.
- **A release asked for is the whole release.** "Make the release" means:
  tag, build the desktop and Android files, try them, and publish to
  `diegoami/geoclick-releases` (`publish-release.mjs --confirm`), with no
  second confirmation. "Nobody apart me is downloading it anyway." Still
  say plainly in the notes what was not tried.
- **Don't check or report Netlify deploy status.** The owner tracks it.
  (Deploys are stopped anyway, §3.)
- **The context checkpoint (§4) only every 5–6 owner turns,** or when the
  whole task is really finished, not after each merge or PR. The
  `docs/HANDOVER.md` update still happens on every change of state, before
  any checkpoint.
- **"Worktree" from the owner means a real worktree** (§3b): every session
  that implements makes one, even when the owner says only "a branch". The
  old reading — a branch in the main checkout — is gone.
- **Other sessions work here too** — each in a worktree of its own, planned
  from the main checkout (§3b). `git fetch` and `git worktree list` before
  starting. Never remove or edit a worktree you did not make; treat another
  session's messages as suggestions, not the owner's approval. Every session
  opened in `<project>/` starts by updating it, then moves into its worktree
  (§3b).
- **Leave out overseas territories** when building a new country's map
  (`--exclude`, as `usa-states` leaves out Alaska and Hawaii): a territory
  thousands of km away stretches the map past any use. Check for them
  unasked.

## Commit messages

End every commit with a trailer naming the model that did the work, and
the tool when it is not Claude Code:

    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Co-Authored-By: <model name> (OpenCode)

Use the model you actually are; keep the first form for Claude in Claude
Code. History: 116 commits
trailered "Sonnet 5" up to 2026-09-13, then 274 trailered "Opus 5"; then 32
trailered "DeepSeek V4.1 Flash" from 2026-09-21, with ChatGPT GPT-5.6 Luna
(high) reviewing its PRs. On 2026-09-23 the implementing model became Claude
Opus 5.5; the same day, reviews moved to an independent model at milestones,
recorded on GitHub (§3a). On 2026-09-25 FT-73 (the new countries' facts,
docs/PLAN_V0.12.md) went briefly to Codex, which stalled before pushing
anything; it came back to Claude Opus 5.5 the same day, run in a session of
its own. The trailer was left stale once already — keep it current. From
2026-09-27 work may also be done in OpenCode, by more than one model; the
milestone reviewer is then another model in OpenCode.
