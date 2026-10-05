---
name: switch-reviewer
description: Change which OpenCode model reviews PRs and milestones by default. Use when the owner says to switch, change or use another reviewer model (DeepSeek, GPT Luna, GLM, ...).
---

# Switch the reviewer

The default reviewer chain for `scripts/external-review.ps1` is the
non-comment lines of `.opencode/reviewer-model`, one model per line, tried in
order (`provider/model#variant`, effort `high` for light models and `medium`
for heavy ones, never `max`). `-Model` on the command line still overrides it for one run.

1. Find the exact id; never guess it:

       XDG_DATA_HOME="$LOCALAPPDATA/geoclick-opencode-review/data" opencode models | grep -i <name>

   Use the provider the owner pays for: `opencode-go/...` (Go subscription),
   `openai/...` (OpenAI account), not the free `opencode/...` default.
2. Write it as a non-comment line of `.opencode/reviewer-model`: first for a
   new default, or replacing one line; keep the fallback line unless told to drop it.
3. Prove it: `pwsh scripts/external-review.ps1 -SelfTest`, then
   `pwsh scripts/external-review.ps1 -Pr <n> -DryRun` and check the printed
   model line.
4. The implementer's model never reviews its own PR (the script refuses it).
5. Say which model is now the default, and note the change in
   `docs/EXTERNAL_REVIEW.md` (Roles) if it is meant to last.

Known ids at 2026-10-05: default `openai/gpt-5.6-luna#high` then
`zai-coding-plan/glm-5.3-flash#high`; heavy `openai/gpt-6.1-sol` (effort
`medium`). Never `openai/gpt-6-luna` or `opencode-go/...luna`. Check quota
first (`docs/environment.md`). Earlier: `opencode-go/deepseek-v4.1-flash#high`,
`openai/gpt-5.6-luna#high`, `opencode-go/gpt-5.6-luna#high`.
