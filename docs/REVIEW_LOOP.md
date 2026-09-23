# Reviews — an independent model, at milestones

**Standing rule (product owner, 2026-09-23).** Claude does its work —
branches, PRs, gates, local verification — without a per-PR review round.
At each **milestone** Claude gives the product owner a ready-to-paste
prompt, and the product owner runs it in an **independent model** (not
Claude) with access to the repository. The findings come back through the
product owner, who decides which become tasks. Claude never spawns the
reviewer itself. The product owner's merge OK (CLAUDE.md §3) is unchanged.

A milestone is, by default:

- a release candidate, before its `vX.Y.Z` tag; or
- whenever the product owner asks for one.

## The prompt

Fill in the three placeholders and hand it over whole, in a fenced block:

```
You are an independent reviewer of the Geoclick repository
(https://github.com/diegoami/Geoclick2027). You did not write any of it.

Scope: the changes from <BASE> to <HEAD> (`git diff --stat <BASE>..<HEAD>`),
which delivered: <ONE LINE PER TASK/PR>. Review the rest of the repository
only where those changes touch it.

Before anything else, read CLAUDE.md section 0: it lists the generated and
binary paths you must not read (map data, build output, lockfiles), and
the "quiet terminal" commands in section 2.

Do not trust PR descriptions, commit messages or docs: read the cited
lines and run the checks yourself (`npm ci`, then `npm run gates -- --quiet`
for typecheck, tests, lint and build).

Look for: correctness bugs and unhandled edge cases; places where the code
and DECISIONS.md / ARCHITECTURE.md disagree; missing or vacuous tests;
performance on the paths that run per frame or per map move; anything that
breaks offline use (desktop and Android builds must work with no network).

Rank each finding BLOCKING (a correctness or contract problem), WORTH DOING,
or NIT. For each give file:line, a concrete failure scenario (input or state
-> wrong result), and what would fix it. Say which findings you verified by
running something and which by reading only. Do not modify files, commit or
push. Output one Markdown report.
```

The report comes back to Claude from the product owner. Answer every
finding — fixed (with the commit), or why not — the same way a PR review
used to be answered.

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
