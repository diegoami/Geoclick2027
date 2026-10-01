---
name: review-handoff
description: Prepare and process independent release-milestone reviews only. Use when a milestone release is called or proposed, when a BLOCK requires re-review, or when the owner says a milestone review is in. For optional pull-request reviews, use review-pr instead.
---

# Review handoff

This skill handles the formal release-milestone review (`AGENTS.md`, *Releases*).
It does not handle optional PR reviews; use `.claude/skills/review-pr/SKILL.md`
for those. Proposals and ordinary PRs do not trigger a release review.

The reviewer's job is written once, in `.opencode/agents/release-reviewer.md`.
It starts with no context and reads everything from the milestone issue, so the
issue has to carry everything it needs.

## Open the milestone issue

Title `Milestone vX.Y.Z`, body passed with `--body-file`:

- **Tag**: `vX.Y.Z` (the next in the existing scheme unless the owner says
  otherwise).
- **Candidate**: the full SHA of `origin/main` after a fetch.
- **Implementer**: the tool and model that did the work, so the owner can pick
  a reviewer that implemented none of it.
- **Previous milestone**: the last stable `vX.Y.Z` tag, with its commit.
- **Merged since**: one line per PR
  (`git log --merges --oneline <prev>..<sha>`).
- **Gates on the candidate**: `npm run gates -- --quiet` from a clean checkout
  of the SHA, with the unit test counts — what each would have caught.
- **Beta, if any**: the `vX.Y.Z-beta.N` tag, the commit it sits on (the
  candidate plus the version change only), and its `SHA256SUMS.txt`.
- **What changed**: two or three sentences across the range. Do not argue for
  it.
- **Claims to verify**: the specific things the work says are true, with
  `file:line`.
- **Known owner decisions**: questions already settled, so they are not
  reported as defects (the standing ones are below; add this milestone's own,
  or "none").
- **Rounds**: one line per review round: SHA, verdict, and issues.
- **Before the tag**: the installer and device checks `docs/RELEASES.md`
  requires.

`main` takes only fixes for this milestone's findings until it is tagged. When
the candidate moves, edit the issue and add a round line. Keep the issue's
`Review:` line current: `pending`, then `AGREE at <sha>`, `BLOCK at <sha>: #n`
or `tagged without review (owner)`.

Standing owner decisions:

- Deploys are stopped: a merge to `main` publishes nothing. Do not check or
  trigger the live site.
- There is no GitHub CI; the gates run locally. Failed "Workers Builds" checks
  on commits up to 2026-09-26 came from a Cloudflare project since
  disconnected; they are not a gate.
- Map data is rebuilt by `data/scripts/*.ts` under WSL2. Review the scripts,
  not their output in `data/maps/`.

Make sure the `review` label exists (`gh label list`).

## Run it with the script (preferred)

`pwsh scripts/external-review.ps1 -Issue <n> -Kind release` runs the review in
a detached worktree and posts one verdict comment on the milestone issue. The
reviewer is DeepSeek V4.1 Flash (effort high), then Claude Opus (owner,
2026-10-02); the implementer is left out. Run it in the background and watch
the log. Exit 3 = no OpenCode review (nothing posted): run the Opus reviewer
as a subagent on the printed brief in your own worktree. Exit 4 = posted but
flagged ("verdict unreadable" / "may be cut off"), no label: read it and decide.
A review already paid for is never discarded (`-FromFile` re-reads a saved one). The model never opens finding issues;
reproduce each finding it lists and open the issues yourself. See
`docs/EXTERNAL_REVIEW.md`.

## Give the owner the command (manual route)

Pick a reviewer model that implemented none of the release. Then, from the main
checkout, start it in a fresh session:

```sh
opencode run -m <provider/model> --command review-release <issue number>
```

In the TUI, use `/new`, pick the model with `/models`, then run
`/review-release <issue number>`. Neither the command nor the agent sets a
model, so the one picked here is the one used. With another tool, tell it:
"Follow `.opencode/agents/release-reviewer.md` for milestone issue #n."

For a re-review, first move **Candidate** to the new `main` commit, and add the
earlier verdict and the fix PRs to the issue. Then give the same command again,
in a fresh session.

## When the review is in

- Read the verdict and every issue it lists (`gh issue view <n>`). Check that
  the SHA is the current candidate, and update the issue's `Review:` line.
- Reproduce each finding before acting on it. MUST-FIX: fix it in a PR
  (`Fixes #n`), or rebut it on the issue and leave the close to the owner.
  SHOULD: recommend whether it goes in before the tag. OUT OF SCOPE: leave it.
  Owner decisions go to the owner with a recommended default. Nits are your
  call: say which you took.
- Reply on the milestone issue with what happened to each finding.
- **BLOCK**: once the fixes merge, rerun the gates on the new candidate and
  start the re-review without being asked. After a third round without AGREE,
  the owner decides.
- **AGREE**: run the checks `docs/RELEASES.md` requires before the tag, then
  tag exactly the reviewed SHA and build from the tag.
