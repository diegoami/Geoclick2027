# External review with OpenCode

`scripts/external-review.ps1` runs an independent review of a PR (`-Pr n`) or
a milestone candidate (`-Issue n -Kind release`) in a detached worktree and
posts it as one GitHub comment. The model never writes to GitHub or git.

Model chain, in order, moving on only after a failed run (an infrastructure failure or a malformed answer, never a verdict):
GPT-5.6 Luna (high), GLM 5.3 Flash, DeepSeek V4.1 Flash. The implementer is
left out (from `Co-Authored-By` trailers or a `model:<name>` label). If no
model can run, nothing is posted and the script exits 3.

Pitfalls the scripts handle: the 1.x CLI needs the `permission:` map syntax in
agent frontmatter (the V2 list form is silently ignored); `opencode run` waits
for stdin EOF; runs use their own `XDG_DATA_HOME`; the real `opencode.exe` is
started instead of the npm shim.

## Snags we hit (Windows, OpenCode CLI 1.18.33)

- **Agent permissions.** The 1.x CLI reads a `permission:` map in agent
  frontmatter. The V2 list form (`permissions:` with action/resource/effect)
  is silently ignored, so an agent that looks read-only can edit. Check with
  `opencode debug agent <name>`. The old `pr-reviewer` and `release-reviewer`
  still use the V2 form.
- **Where the agent comes from.** The script copies the reviewer agent from
  the trusted checkout into the worktree. A PR may predate the file or edit
  its own reviewer's permissions.
- **opencode-go models.** The Go subscription lives in `opencode.db` (account
  state), not in `auth.json`. A data dir with only `auth.json` lists no
  `opencode-go/*` models and the run fails fast as `unknown-model`. The watcher
  copies the default database into the review data dir once (`-RefreshData`
  re-copies). Alternative, untested on Windows: `opencode console login` with
  `XDG_DATA_HOME` set. Use the `opencode-go/` prefix; `opencode/` is the
  default, differently-billed provider.
- **False alarms.** The permission-rejection match must be a line starting
  with `!`, and the default-agent check must read the `> <agent> · <model>`
  banner. Matching the phrase anywhere fires when the model echoes the
  watcher's own source (a PR that touches the scripts).
- **Output.** Logs live outside the worktree (it is deleted afterwards).
  Decode opencode output as UTF-8 or posted reviews show `ÔÇö`. Models may put
  blank lines between the header and the verdict: the validator ignores them.
- **Process hygiene.** `opencode.exe` processes of the desktop app and
  OpenChamber are not ours. Killing a run mid-way skips the worktree cleanup:
  remove the orphan with `git worktree remove --force`.
- **Implementer exclusion** is by keyword from `Co-Authored-By` trailers, so
  "GPT-6 Luna" also excludes "GPT-5.6 Luna".
- **Disagreement is normal.** On the v0.16.0 candidate GLM 5.3 Flash said AGREE
  where DeepSeek V4.1 Flash found a MUST-FIX that reproduced. Treat each
  verdict as input, reproduce the findings, and never count verdicts.
