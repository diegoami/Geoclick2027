# External review with OpenCode

`scripts/external-review.ps1` runs an independent review of a PR (`-Pr n`) or
a milestone candidate (`-Issue n -Kind release`) in a detached worktree and
posts it as one GitHub comment. The model never writes to GitHub or git.

Model chain, in order, moving on only after an infrastructure failure:
GPT-5.6 Luna (high), GLM 5.3 Flash, DeepSeek V4.1 Flash. The implementer is
left out (from `Co-Authored-By` trailers or a `model:<name>` label). If no
model can run, nothing is posted and the script exits 3.

Pitfalls the scripts handle: the 1.x CLI needs the `permission:` map syntax in
agent frontmatter (the V2 list form is silently ignored); `opencode run` waits
for stdin EOF; runs use their own `XDG_DATA_HOME`; the real `opencode.exe` is
started instead of the npm shim.
