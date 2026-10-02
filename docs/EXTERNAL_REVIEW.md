# External review with OpenCode

`scripts/external-review.ps1` runs an independent review of a PR (`-Pr n`) or
a milestone candidate (`-Issue n -Kind release`) in a detached worktree and
posts it as one GitHub comment. The model never writes to GitHub or git.

Roles (owner's decision, 2026-10-02): reviewer **DeepSeek V4.1 Flash**
(`opencode-go/deepseek-v4.1-flash`, effort `high`), then **Claude Opus**.
Later the same day the owner switched the default OpenCode reviewer to **GPT
Luna** (`openai/gpt-5.6-luna#high`). The default is the one line in
`.opencode/reviewer-model`; change it with the `switch-reviewer` skill, or pass
`-Model` for one run. Implementer
**Claude Sonnet**, then **GPT Luna**. One OpenCode model per role:
a chain of several cheap models multiplies wasted attempts. Other models remain
valid as an explicit `-Model`, but no default picks them. Effort is `high` for
every variant, never `max`. The implementer's model never reviews its own PR
(`Co-Authored-By` trailers or a `model:<name>` label); with no OpenCode
reviewer left the script exits 3.

Exit codes: `0` posted and acted on; `3` no OpenCode review (nothing posted:
run the Opus reviewer as a subagent on the printed brief, in its own worktree);
`4` posted but flagged, no label (read it and decide); `5` the PR head moved.

**A review that can be read is never thrown away** (`scripts/ReviewParser.ps1`,
`-SelfTest` runs 13 samples). Only a message with no header line anywhere (tool
chatter, or nothing) is a failure. The header is found case-insensitively,
inside Markdown, after any preamble; the verdict may be decorated, prefixed
"Verdict:" or punctuated; the closing verdict is looked for in the last three
non-empty lines; a one-line review is accepted. A review whose verdict cannot be
read, or that has no closing verdict, is posted anyway with a first line
`> Note from external-review.ps1: verdict unreadable` (or `may be cut off`), no
label, exit 4. Closing keywords before `#n` are rewritten to `see #n` and logged.
Failure classes: no-session, idle-timeout, total-timeout, exited-without-session,
nonzero-exit, permission-rejected, default-agent, cut-off, unknown-model,
unknown-agent, no-executable, no-auth, no-review. A cut-off run that left text is
posted flagged, like any other doubtful review.
`-FromFile <file>` pushes a saved message through the same parser; with
`-DryRun` it prints what would be posted, the note line and the exit code.

**OpenCode Go and the data directory.** Runs use their own `XDG_DATA_HOME`,
`XDG_CACHE_HOME` and `XDG_STATE_HOME` (`%LOCALAPPDATA%\geoclick-opencode-review\{data,cache,state}`,
restored afterwards). `auth.json` is copied, never read. Go is not an
`opencode auth login` provider: it comes from `opencode console login` (a URL and
a code approved in the browser), stored in that data directory's *database*, so
each data directory needs its own login. The watcher seeds the database from the
default one until you have logged in (`-RefreshData` re-copies). To log in:

```powershell
$env:XDG_DATA_HOME = "$env:LOCALAPPDATA\geoclick-opencode-review\data"
$exe = "$env:APPDATA\npm\node_modules\opencode-ai\bin\opencode.exe"
& $exe console login        # prints a URL and a code; approve in the browser
& $exe console orgs
& $exe models opencode-go   # about 29 models; add --refresh if none
```

Why one model: GLM-5.3 and GLM-5.3-Flash sometimes end their turn early in long
implementer runs (a whole run of reading, then exit 0 with no commit); as
reviewers they were cheap, but in this project GLM 5.3 Flash said AGREE where
DeepSeek found a real MUST-FIX. Go's `gpt-6-luna` returned "Bad Request" in
long agent loops, so it is not a default for long runs.

Pitfalls the scripts handle: the 1.x CLI needs the `permission:` map syntax in
agent frontmatter (the V2 list form is silently ignored); `opencode run` waits
for stdin EOF; runs use their own `XDG_DATA_HOME`; the real `opencode.exe` is
started instead of the npm shim.

## Snags we hit (Windows, OpenCode CLI 1.18.33)

- **The reviewer never types its worktree's path (2026-10-02, learned in
  harness_imperial#15, applies here).** An agent told to pass `git -C
  <worktree>` mistyped a 90-character path (one extra character); OpenCode
  auto-rejected it as `external_directory`, which ends `opencode run`, and the
  review was lost in 17 s. The script already starts OpenCode inside the
  worktree (`--dir`), so the rule bought nothing. The brief now gives only the
  worktree's name, never its path, and the agent runs git as it is, without
  `-C`. What `-C` was for is covered by the tree proof, the reviewer's first
  tool call: top level (must end in the worktree name), HEAD (must be the
  commit named) and `git diff --name-only <base>...HEAD` (must not be empty);
  otherwise the whole message is "wrong tree". `scripts/ReviewerBrief.ps1`
  builds the brief and `external-review.ps1 -SelfTest` checks that neither the
  brief nor the agent file asks for `git -C` or a path. The `git -C * push|commit|stash|worktree` deny
  rules stay as a safeguard.
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
