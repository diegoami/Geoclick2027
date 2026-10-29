---
name: review-handoff
description: Prepare and process independent release-milestone reviews only. Use when a milestone release is called or proposed, when a BLOCK requires re-review, or when the owner says a milestone review is in. For optional pull-request reviews, use review-pr instead.
---

# Review handoff

This skill handles the formal release-milestone review (`AGENTS.md`, *Releases*).
It does not handle optional PR reviews; use `.claude/skills/review-pr/SKILL.md`
for those. Proposals and ordinary PRs do not trigger a release review.

The reviewer's job is written once, in `docs/review/release-reviewer.md`.
Nothing runs a review automatically: the implementing session hands the owner
a prompt, and the owner starts the review in whatever tool and model they pick.
The reviewer starts with no context and reads everything from the milestone issue, so the
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

## Give the owner the prompt

Once the issue is open, end the handoff with a ready-to-paste prompt, filled in
from live data (no placeholders left), for a fresh session in any tool:

```text
You are the independent reviewer of the Geoclick release candidate on
milestone issue #<n> (https://github.com/diegoami/Geoclick2027/issues/<n>),
candidate <full SHA>. Work from the main checkout at <main-checkout path>.
Follow docs/review/release-reviewer.md in full: start with `gh issue view <n>`,
review in a fresh detached worktree of your own under
<main-checkout parent>/Geoclick2027-review/, post the finding issues and one
AGREE/BLOCK verdict comment on the milestone issue yourself, and remove only
your own worktree when done.
```

Add one line: the review runs in a fresh session, preferably on a model that
implemented none of the release (the issue's **Implementer** line says which).
In OpenCode, `/review-release <n>` is a shortcut to the same instructions. Do
not start the review yourself, and never spawn a reviewer of your own.

For a re-review, first move **Candidate** to the new `main` commit and add the
earlier verdict and the fix PRs to the issue, then give the prompt again with
the new SHA.

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
  give the owner the re-review prompt without being asked. After a third
  round without AGREE, the owner decides.
- **AGREE**: run the checks `docs/RELEASES.md` requires before the tag, then
  tag exactly the reviewed SHA and build from the tag.
