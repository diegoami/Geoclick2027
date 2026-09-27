---
name: review-handoff
description: Write the prompt the owner runs in a different model (Codex, DeepSeek, or another tool) so it independently reviews a milestone, a release candidate on main before its vX.Y.Z tag, and records the result on the milestone issue. Use when a milestone issue is opened, when a BLOCK's fixes have moved the candidate (the re-review), and whenever the owner asks for a review prompt. Also use when the owner says a review is in, to process it.
---

# Review handoff

A milestone is a release (`CLAUDE.md` §3a): the tag `vX.Y.Z` on `main`, on
the exact commit the release is built from. The review runs once per
milestone, on the **milestone issue**, before the tag. Nothing else gets a
prompt: not a proposal, not a PR, not a docs or process change. At most say
in one line that a review is possible, and write the prompt only if the
owner asks.

Claude implements; a different model reviews, in whatever tool the owner
picks. Give the owner one prompt in a single fenced `text` block with
nothing else in it. Tell the owner to run it in a **fresh session** of that
tool: a reused session carries its earlier conclusions. The reviewer starts
with no context and posts its results to GitHub itself, so the prompt has
to carry everything it needs, and it must not assume a tool.

**The tag waits for the verdict.** On BLOCK, the fixes land in ordinary
PRs, the candidate moves, and you give a re-review prompt without being
asked (the variant below). A third round that does not end in AGREE goes to
the owner. The owner may tag without a review; the milestone issue then
records that.

This repository has no `AGENTS.md`. The prompt's first line makes the tool
the reviewer; a tool that reads `CLAUDE.md` on its own finds the same
handover at the top of §3a. If the tool sandboxes network access, every `gh`
call needs it: tell the owner to approve those calls when asked.

## The milestone issue

Open it once the version bump and the CHANGELOG entry are merged, before
writing the prompt. Title: `Milestone vX.Y.Z`. Body:

- **Tag:** `vX.Y.Z` (the next version in the existing scheme)
- **Candidate:** the full SHA of the `main` commit (`git rev-parse origin/main`)
- **Previous milestone:** the last stable tag, with its commit
- **Merged since:** one line per PR (`git log --merges --oneline <prev>..<sha>`)
- **Gates on the candidate:** `npm run gates -- --quiet` from a clean
  checkout of the SHA, with the unit test counts
- **Beta, if any:** the `vX.Y.Z-beta.N` tag, the commit it sits on (the
  candidate plus the version change only), and its `SHA256SUMS.txt`
- **Rounds:** one line per review round: SHA, verdict, and issues
- **Before the tag:** the installer and device checks RELEASES.md requires

`main` takes only fixes for this milestone's findings until it is tagged.
When the candidate moves, edit the issue and add a round line.

## Fill in before writing

- **Repo**: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
- **Thread**: the milestone issue URL.
- **Candidate**: its full SHA, pushed on `main`.
- **Previous tag**: the last stable `vX.Y.Z`. The diff is
  `git diff <previous tag>..<candidate SHA>`.
- **What changed and why**: one line per PR merged since the previous tag.
  Do not argue for the change.
- **Claims to verify**: the specific things the work says are true, with
  `file:line`. These are what the reviewer checks hardest.
- **Checks already run**: each command, its pass *count*, and what it would
  have caught (the gates; any browser, installer or device check). The
  reviewer should aim at what those checks cannot see.
- **Known owner decisions**: questions already put to the owner, so the
  reviewer does not report them as defects. The standing ones are in the
  template; add the milestone's own.
- **Labels**: `review`, `bug`, `robustness`, `tests`, `design`, `cleanup`
  and `documentation` should all exist (`gh label list`).

## Template

```text
You are the independent reviewer for <owner/repo>, working from a
review-handoff prompt: this prompt defines your job. Claude did this work. Do
not trust its description, its commit messages or its docs. Verify everything
against the code.

MILESTONE: v<X.Y.Z>, a release. The tag waits for your verdict and will be
created on exactly the SHA you review.
THREAD: <milestone issue URL>
CANDIDATE: main at <full sha>. Before anything else, in this order:
1. Fetch first: git fetch origin --tags (for a pull request, also
   git fetch origin pull/<N>/head; a milestone has none). Not git pull: the
   checkout you started in may be on another branch or hold local changes.
2. A commit you cannot see is not missing until you have fetched. Stop and
   say so only if git cat-file -t <full sha> still does not print "commit"
   after the fetch.
3. Review in a fresh, detached worktree of your own at exactly that SHA,
   never in the checkout you started in:
     git worktree add --detach <main>/../<project>-work/review-<id>-<stamp> <full sha>
   <main> is the parent directory of
   git rev-parse --path-format=absolute --git-common-dir, <project> is
   <main>'s name, <id> is the first 12 characters of the SHA, and <stamp>
   is the UTC time as YYYYMMDDTHHMMSSZ, so every run has its own. Remove no
   worktree you did not make.
4. In that worktree, git rev-parse HEAD must equal <full sha> before you
   review. Every command from here on runs there.
PREVIOUS MILESTONE: <previous tag>

WHAT CHANGED since <previous tag>:
- <PR #n: one line>

CLAIMS TO VERIFY:
- <claim> (<file:line>)

ALREADY RUN: <command: pass count, what it would catch>. Look for what these
cannot see.

KNOWN OWNER DECISIONS (not defects):
- Deploys are stopped: a merge to main publishes nothing. Do not check or
  trigger the live site.
- There is no GitHub CI; the gates run locally. Failed "Workers Builds"
  checks on commits up to 2026-09-26 came from a Cloudflare project since
  disconnected; they are not a gate.
- Map data is rebuilt by data/scripts/*.ts under WSL2. Review the scripts,
  not their output in data/maps/.
- <this milestone's own, or "none">

Before anything else, read the repository's CLAUDE.md: section 0 lists the
generated and binary paths you must not read (27 MB of map data, build
output, lockfiles) and section 2 the quiet forms of every command. Its
principles and rules are the standard. data/facts/*.json is authored input;
data/maps/*/facts.json is generated from it.

Run the gates yourself: `npm ci > /dev/null 2>&1`, then
`npm run gates -- --quiet` (typecheck, unit tests, lint, build; four PASS
lines, or the tail of the failing gate). If `check` dies with exit code
3221225477, rerun it once: that is a native svelte-check crash, not a type
error.

Review git diff <previous tag>..<candidate sha>, and follow it into any
file it touches or relies on. Look hardest at correctness and edge cases,
code that disagrees with DECISIONS.md or ARCHITECTURE.md, missing or vacuous
tests, work done per frame or per map move, and anything that breaks offline
use (the desktop and Android builds must work with no network). Problems
elsewhere in the repository count too, as out of scope.

Rules:
- Do not edit files, commit, push or tag. Your only writes are the GitHub
  issues and the one comment described below, made with the gh CLI.
- Reproduce every finding: cite file:line, and give the command, the input or
  the reasoning that shows it. Leave out anything you could not reproduce.
- Do not report style preferences.
- Before opening an issue, search open issues (gh issue list --search) and
  comment on an existing one instead of duplicating it.
- Write every issue and comment body to a file as UTF-8 without a byte-order
  mark and pass it with --body-file.

1. For each finding, open one issue:
   gh issue create --label review --label <bug|robustness|tests|design|cleanup|documentation>
   Title: the defect, stated plainly.
   Body:
     - Severity: MUST-FIX (a defect in this milestone's changes that must
       be fixed before the tag), SHOULD, or OUT OF SCOPE (not caused by
       this milestone's changes)
     - Found by: review of <THREAD> at <sha>
     - What: the defect, with file:line and a reproduction
     - Why it matters: what a player or maintainer would notice
     - Suggested fix: the smallest change that resolves it
     - Effort: S, M or L
     - Signed: — Reviewer (<tool>, <model>)

2. Then, always, even if you found nothing, post one comment on THREAD:
   VERDICT: AGREE | BLOCK        (BLOCK if any MUST-FIX issue was opened)
   Reviewed: <full sha>
   Worktree: ../<project>-work/review-<id>-<stamp> (relative to the main
   checkout; never one machine's absolute path)
   Issues opened: #n (MUST-FIX), #m (SHOULD), ... or "none"
   Owner decisions: questions only the owner can settle, or "none"
   Nits: one line each, or "none" (nits do not get issues)
   Checked and clean: what you verified and found correct
   — Reviewer (<tool>, <model>)
```

## Re-review, after a BLOCK

Give it without being asked once the MUST-FIX fixes are merged and the
issue names the new candidate. Use the same template with the new SHA and
the same previous tag, so the verdict still covers the whole milestone. Add
these lines after CLAIMS TO VERIFY:

```text
ROUND: <2 or 3>. The last round was BLOCK at <old sha>: <#n, #m>.
Since then: git diff <old sha>..<new sha> (<the fix PRs>). Check first that
each MUST-FIX is resolved, then that the fixes broke nothing else. Fetch
and make a fresh worktree for <new sha> as the CANDIDATE steps say; do not
reuse an earlier round's.
```

The same prompt serves whenever the candidate moves after any verdict, not
only after a BLOCK. v0.10.0's round 2 followed an AGREE on a commit made
before the candidate existed. Say what the last round saw and what moved.

After a third round without AGREE, stop: put the open findings to the
owner with a recommended default.

## When the owner says the review is in

- Read the verdict comment on the milestone issue and every issue it lists
  (`gh issue view <n>`), and add the round line to the issue. Check that the
  SHA it names is the current candidate.
- Reproduce each finding yourself before acting on it. A reviewer can be wrong,
  and so can you.
- MUST-FIX: fix it in an ordinary PR (`Fixes #n`), or rebut it with evidence
  on the issue and leave the close to the owner. SHOULD: fix it now or in
  the next milestone; recommend which, and the owner decides. OUT OF SCOPE:
  leave the issue for its own change. Owner decisions: put them to the owner
  with a recommended default. Nits: your call, and say which you took.
- Reply on the milestone issue with what happened to each finding. Write the
  body with the Write tool and pass it with `--body-file` (UTF-8, no BOM).
- AGREE: run the checks RELEASES.md requires before the tag, then tag
  exactly the reviewed SHA and build from the tag (RELEASES.md, "The
  milestone").
