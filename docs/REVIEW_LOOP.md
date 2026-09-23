# Reviews — an independent model, at milestones, on GitHub

**The process lives in [CLAUDE.md §3a](../CLAUDE.md)** and the prompt
template in [`.claude/skills/review-handoff/SKILL.md`](../.claude/skills/review-handoff/SKILL.md)
(product owner, 2026-09-23, [#26](https://github.com/diegoami/Geoclick2027/issues/26),
adapted from diegoami/discola-web). In short: at a milestone (a design
proposal, a PR that implements one, a staged release) Claude hands the
product owner a prompt; the owner runs it in a different model, in any tool;
the reviewer opens one GitHub issue per reproduced finding and always posts
one AGREE/BLOCK verdict on the thread. Nothing is pasted back.

This file keeps only the history and the encoding rule.

## The paste-back prompt (2026-09-23, superseded the same day)

The first milestone-review prompt asked the independent model for one
Markdown report, which the product owner pasted back into a Claude session.
It was handed over once, for v0.10.0 (`v0.9.4..f2eca43`), and withdrawn
before it ran: findings that never reach GitHub leave no issue, no verdict
on the thread and no `Review:` line on a PR.

## Before: the per-PR loops (superseded)

- **2026-09-21 to 2026-09-22:** every task PR (#10–#21) was reviewed by
  ChatGPT GPT-5.6 Luna (high), spawned as an opencode subagent, while
  DeepSeek V4.1 Flash implemented.
- **2026-09-23, one PR:** a fresh Claude subagent reviewed PR #23 (FT-63)
  once, its review posted verbatim and answered, before the product owner
  replaced per-PR reviews with milestone reviews by an independent model.
  See DECISIONS.md, "An independent model reviews at milestones".

## Encoding: write GitHub comment bodies as UTF-8 without a BOM

Still applies whenever Claude posts to GitHub (e.g. answering a milestone
review on a PR). Write the body to a file with the Write tool (or a Node
script) and pass it with `--body-file`. Never build it with PowerShell
`Out-File`, `Set-Content` or a here-string piped to `gh`: on PRs #19–#21
that put a BOM in front of the comments and turned `—` into `?` in the
signatures, which breaks a search for who said what.

## Why an independent model

The eight v0.9.4 issues were found by an outside review, and the earlier
review that produced them had one central fact backwards (HANDOVER.md). A
different model brings different blind spots, which a fresh Claude context
cannot; independent verification — running the gates, reading the cited
lines — stays Claude's job on every task regardless.
