# The brief given to the external reviewer, and a self-test that neither it nor
# the agent file asks the reviewer to type its worktree's path or to use
# `git -C` (harness_imperial#15: a retyped path was auto-rejected as an
# external directory, which ends `opencode run`). The script starts OpenCode
# inside the worktree, so the reviewer needs no path; the tree proof (first
# tool call) says whether it is in the right tree.

function Get-ReviewerBrief {
    param([string] $Header, [string] $Kind, [string] $BaseRef, [string] $BaseSha, [string] $HeadSha,
          [string] $WorktreeLeaf, [string] $Verdicts, [string] $Contract, [string] $Extra)
    @"
# Brief

Header line (use it EXACTLY as line 1 of your final message): $Header

Reviewing: $Kind. Base: $BaseRef ($BaseSha). Head: $HeadSha.
Your working directory is a detached worktree at the head. Run git there as it
is, without -C, and never type the worktree's path. Its name ends in $WorktreeLeaf.
Diff to review: git diff $BaseSha...$HeadSha

Your FIRST tool call, in one command, prints:
  git rev-parse --show-toplevel
  git rev-parse HEAD
  git diff --name-only $BaseSha...HEAD
The top level must end in $WorktreeLeaf, HEAD must be $HeadSha, and the diff must
not be empty. If any of the three is wrong, your whole final message is "wrong
tree" and the reason, and you stop.

Allowed verdicts (line 2, and again alone as the very last line): $Verdicts

Stay inside your worktree. Do not read or write any path outside it. Do not
read half the repository: the contract below is pasted so you do not have to
look for it. Verify its claims against the code.

## Contract

$Contract

## Extra instructions from the caller

$Extra
"@
}

function Invoke-ReviewerBriefSelfTest {
    param([string] $AgentFile)
    $fail = 0
    $brief = Get-ReviewerBrief -Header 'h' -Kind 'pr' -BaseRef 'origin/main' -BaseSha ('a' * 40) -HeadSha ('b' * 40) `
        -WorktreeLeaf 'pr1-review-abc123' -Verdicts 'approve' -Contract 'c' -Extra 'None.'
    $checks = @(
        @{ n = 'brief has no "git -C"';            ok = ($brief -notmatch 'git\s+-C') },
        @{ n = 'brief names no full worktree path'; ok = ($brief -notmatch '[A-Za-z]:[\\/]|/Users/|-review/') },
        @{ n = 'brief demands the tree proof';      ok = ($brief -match 'rev-parse --show-toplevel' -and $brief -match 'wrong\s+tree') }
    )
    $text = Get-Content $AgentFile -Raw
    $body = ($text -split '(?m)^---\s*$', 3)[2]
    $checks += @{ n = 'agent body has no "git -C"';       ok = ($body -notmatch 'git\s+-C') }
    $checks += @{ n = 'agent body forbids typing the path'; ok = ($body -match 'never type') }
    $checks += @{ n = 'agent deny rules for git -C stay';   ok = ($text -match '"git -C \* push\*": deny') }
    foreach ($c in $checks) {
        if ($c.ok) { Write-Host "ok   $($c.n)" } else { Write-Host "FAIL $($c.n)"; $fail++ }
    }
    return $fail
}
