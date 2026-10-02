---
name: switch-reviewer
description: Change which OpenCode model reviews PRs and milestones by default. Use when the owner says to switch, change or use another reviewer model (DeepSeek, GPT Luna, GLM, ...).
---

# Switch the reviewer

The default reviewer for `scripts/external-review.ps1` is the one line in
`.opencode/reviewer-model` (`provider/model#variant`, effort `high`, never
`max`). `-Model` on the command line still overrides it for one run.

1. Find the exact id; never guess it:

       XDG_DATA_HOME="$LOCALAPPDATA/geoclick-opencode-review/data" opencode models | grep -i <name>

   Use the provider the owner pays for: `opencode-go/...` (Go subscription),
   `openai/...` (OpenAI account), not the free `opencode/...` default.
2. Write it as the only non-comment line of `.opencode/reviewer-model`.
3. Prove it: `pwsh scripts/external-review.ps1 -SelfTest`, then
   `pwsh scripts/external-review.ps1 -Pr <n> -DryRun` and check the printed
   model line.
4. The implementer's model never reviews its own PR (the script refuses it).
5. Say which model is now the default, and note the change in
   `docs/EXTERNAL_REVIEW.md` (Roles) if it is meant to last.

Known ids at 2026-10-02: `opencode-go/deepseek-v4.1-flash#high`,
`openai/gpt-5.6-luna#high`, `opencode-go/gpt-5.6-luna#high`.
