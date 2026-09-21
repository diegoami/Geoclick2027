# The review loop — Luna over GitHub

**Standing rule (product owner, 2026-09-21).** Every task PR gets an
independent review before it merges. The implementer builds and opens the
PR; the reviewer reviews it on GitHub and comments; the implementer replies;
the two iterate until they agree. This is in addition to — never instead of
— the product owner's own merge OK (CLAUDE.md §3).

## The two roles

| Role | Model | Job | Signature |
|---|---|---|---|
| Implementer | DeepSeek V4.1 Flash (`opencode/deepseek-v4.1-flash`) | writes the code, opens the PR, answers findings | `— DeepSeek V4.1 Flash (implementer)` |
| Reviewer | ChatGPT GPT-5.6 Luna, high (`opencode/gpt-5.6-luna#high`) | reviews the diff and comments on GitHub | `— ChatGPT GPT-5.6 Luna (high, reviewer)` |

The two roles are deliberately different models: a model cannot review its
own work with fresh eyes. Each signs every comment with its model name, so a
reader can tell who said what without the thread's context.

## The loop, per task

1. **Implementer:** branch, code, `npm run gates -- --quiet`, push.
2. **Implementer:** open the PR (`gh pr create`). The body names the issue
   (`Fixes #N`), what changed, how it was verified, and any deviation from
   the plan.
3. **Reviewer:** read the diff (`gh pr diff <n>`), then post an honest review
   (`gh pr comment <n>`). Findings are ranked — **blocking** (a correctness
   or contract problem), **worth doing**, or **nit**. A blocking finding
   names the file and line and what would make it pass.
4. **Implementer:** answer every finding in a comment — either the fix is
   pushed, or why it will not be. No finding is left unaddressed.
5. **Repeat 3–4** until the reviewer states, in a comment, that her findings
   are resolved or explicitly deferred. Silence is not agreement.
6. Only then is the PR ready for the product owner's merge OK. The loop does
   not replace that gate.

A finding the implementer declines to fix is settled only when the reviewer
accepts the reason. If the two cannot agree, both record the disagreement in
the PR and hand it to the product owner to decide.

## How the reviewer is actually run

Luna is ChatGPT (OpenAI) GPT-5.6 in its high reasoning variant — a model, not
a GitHub account. Her review is produced by spawning
`opencode/gpt-5.6-luna#high` as a subagent against the PR, and her words are
posted as GitHub PR comments:

```
subagent({
  agent: "general",
  model: "opencode/gpt-5.6-luna#high",
  prompt: "You are the reviewer on PR #<n> of diegoami/Geoclick2027.
           Read the issue and the diff (gh pr diff <n>). Review it honestly;
           rank findings blocking / worth doing / nit. Post your review with
           gh pr comment <n> and sign it '— ChatGPT GPT-5.6 Luna (high, reviewer)'."
})
```

If the subagent cannot post to GitHub, the implementer pastes its review
verbatim as a comment and says plainly who wrote it. **Never paraphrase away
a finding** — relay it as written, then answer it.

## Why this exists

The eight v0.9.4 issues were found by exactly this shape of independent
review, and the earlier review that produced them had one central fact
backwards (HANDOVER.md). A second model on every PR catches that class of
error before it reaches `main`, while independent verification — running the
gates, reading the cited lines — stays the implementer's job too.
