# The review loop — a fresh Claude over GitHub

**Standing rule (product owner, 2026-09-21; reviewer changed 2026-09-23).**
Every task PR gets a review before it merges. The implementer builds and
opens the PR; a reviewer reviews it and its review is posted on GitHub; the
implementer replies; the two iterate until they agree. This is in addition
to — never instead of — the product owner's own merge OK (CLAUDE.md §3).

## The two roles

| Role | Model | Job | Signature |
|---|---|---|---|
| Implementer | Claude Opus 5.5 (the working session) | writes the code, opens the PR, answers findings | `— Claude Opus 5.5 (implementer)` |
| Reviewer | Claude, as a fresh subagent | reviews the diff; its review is posted on GitHub | `— Claude Opus 5.5 (fresh subagent, reviewer)` |

**Claude reviews itself** (product owner, 2026-09-23). What keeps that from
being a rubber stamp is the fresh context: the reviewer is spawned with no
memory of the implementation, so it sees the diff the way a stranger would,
not the way its author meant it. What it cannot give is a second model's
blind spots — see DECISIONS.md, "Claude reviews its own PRs".

## The loop, per task

1. **Implementer:** branch, code, `npm run gates -- --quiet`, push.
2. **Implementer:** open the PR (`gh pr create`). The body names the issue
   (`Fixes #N`), what changed, how it was verified, and any deviation from
   the plan.
3. **Reviewer:** read the diff (`gh pr diff <n>`) and write an honest review.
   Findings are ranked — **blocking** (a correctness or contract problem),
   **worth doing**, or **nit**. A blocking finding names the file and line
   and what would make it pass.
4. **Implementer:** post the review verbatim, then answer every finding in a
   comment — either the fix is pushed, or why it will not be. No finding is
   left unaddressed.
5. **Repeat 3–4** — a new fresh reviewer each round, given the previous
   review and the reply — until a reviewer states that its findings are
   resolved or explicitly deferred. Silence is not agreement.
6. Only then is the PR ready for the product owner's merge OK. The loop does
   not replace that gate, and a PR is never merged in the same breath as its
   last re-review.

A finding the implementer declines to fix is settled only when the reviewer
accepts the reason. If the two cannot agree, both record the disagreement in
the PR and hand it to the product owner to decide.

## How the reviewer is actually run

From a Claude Code session, with the Agent tool (general-purpose subagent,
no prior context):

```
Agent({
  description: "Review PR #<n>",
  prompt: "You are the reviewer on PR #<n> of diegoami/Geoclick2027. You did
           not write it. Read CLAUDE.md §0 (context budget), the linked issue
           and the diff (gh pr diff <n>). Do not trust the PR body: read the
           cited lines and run the relevant tests yourself. Rank findings
           blocking / worth doing / nit. Write the review, in Markdown, to
           <scratchpad>/review-<n>-<round>.md with the Write tool and sign it
           '— Claude Opus 5.5 (fresh subagent, reviewer)'. Do not post it."
})
```

The implementer then posts that file unchanged:

    gh pr comment <n> --body-file <scratchpad>/review-<n>-<round>.md

**Never paraphrase away a finding** — post it as written, then answer it.

### Encoding: write comment bodies as UTF-8 without a BOM

Write every comment body to a file with the Write tool (or a Node script)
and pass it with `--body-file`. Never build it with PowerShell `Out-File`,
`Set-Content` or a here-string piped to `gh`: on PRs #19–#21 that put a BOM
in front of the comments and turned `—` into `?` in the signatures, which
breaks a search for who said what.

## History

PRs #10–#21 (FT-52 to FT-65, 2026-09-21 to 2026-09-22) were implemented by
DeepSeek V4.1 Flash and reviewed by ChatGPT GPT-5.6 Luna (high), spawned as
an opencode subagent; their comments are signed with those names. Both ran
under opencode, which a Claude Code session cannot drive.

## Why this exists

The eight v0.9.4 issues were found by exactly this shape of review, and the
earlier review that produced them had one central fact backwards
(HANDOVER.md). A reviewer on every PR catches that class of error before it
reaches `main`, while independent verification — running the gates, reading
the cited lines — stays the implementer's job too.
