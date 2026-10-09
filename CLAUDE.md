<!-- Claude Code reads this file; OpenCode and every other tool read AGENTS.md. Delete it once Claude Code is no longer used. -->
@AGENTS.md

## Choosing a model

Whenever this project needs a model (delegating to OpenCode, picking a reviewer,
heavy or light), ask the local quota service first. It runs in WSL, answers on
Windows too, needs no auth and is read-only:

    curl.exe -s "http://localhost:8765/recommend?tier=light"   # small tasks, reviews
    curl.exe -s "http://localhost:8765/recommend?tier=heavy"   # bigger implementation

(PowerShell: `curl.exe`, not the `curl` alias, or `Invoke-RestMethod <url>`.)
Reading it: `pick` is the model to use now, with its exact `command`;
`pair.implementer` / `pair.reviewer` for a task with a doer and a reviewer (the
reviewer is always from another family); `ranking` lists every usable model,
rank 1 best, so follow the rank (`outlook: "tight"` only means that pool is
forecast to run short later, it has quota now); `skipped` says what is
unusable and why.

- Small fixes, reviews, questions: `tier=light`. Real feature work: `tier=heavy`. When in doubt, light.
- Claude is the main session; delegate to Claude only where the ranking puts it.
- Never DeepSeek (blacklisted), Alibaba or OpenRouter, even if a command names them.
- If the service does not answer, do the work in this session and say the quota
  service was down. Do not guess from percentages.
