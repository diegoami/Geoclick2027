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

## Blocking means

Blocking means (any one is enough; a blocking finding means rework in a PR review and BLOCK in a milestone review, never approve or AGREE):
1. A claim in the contract above fails, or cannot be run as written: a step it
   tells the owner to take, a test or gate it says passes, a number it states.
2. What this change protects can be got past. The contract's "Protects:" line
   names it (a gate, a data invariant, a test, a rule such as "version numbers
   change only in the release PR", an attribution a licence requires). If there
   is no such line, take what the contract says the change exists to guarantee.
   A bypass you proved is blocking, even when it looks like an edge case. Do not
   rate it "follow-up hardening" or "outside the threat model" unless the
   contract says so; if it does, quote the line.
3. Behaviour the contract forbids, or behaviour nobody asked for, inside a file
   the change touches.
4. Project items, each blocking: npm run gates fails or was not run; generated
   output (data/maps/*/facts.json, app/static/maps, app/static/manual) edited by
   hand instead of rebuilt; a version number changed outside the release PR; a
   test that still passes with the behaviour it names deleted; map data without
   the attribution its licence needs; a status or decision written into a
   document that the code does not bear out.
Not blocking: wording, style, and defects in code the change did not touch. File
those as follow-ups.
When unsure, rate it blocking and say why. An approve with a proven bypass is the
costliest mistake a review can make.

## Report every blocking finding in this one review

This review is your only pass before the author fixes. Do not stop at the first blocking
finding: finish reading the whole diff and the task file, check every Done-when line and
every item under "Blocking means", and report all blocking findings together.

- Before you write the verdict, make one last pass over the full diff for anything you have
  not yet rated, and say "Final pass done" as the last line before the verdict.
- Number the findings R1, R2, ... in order of severity. A finding you held back because an
  earlier one was already blocking is a review defect: if two problems share a cause, list
  both and say so.
- Do not rely on a later round. The author fixes everything you list, and the next review
  checks those fixes and new code only, not anything you saw but did not report.
- If you ran out of time or context before covering the whole diff, say which files or
  sections you did not cover. Do not approve in that case.

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
        @{ n = 'brief demands the tree proof, in order'; ok = ($brief -match '(?s)FIRST tool call.*rev-parse --show-toplevel.*rev-parse HEAD.*diff --name-only ' + ('a' * 40) + '\.\.\.HEAD.*wrong\s+tree') },
        @{ n = 'brief says what blocking means, and that a proven bypass is blocking'; ok = ($brief -match 'Blocking means' -and $brief -match 'proved is blocking' -and $brief -match 'Protects:') },
        @{ n = 'brief asks for every blocking finding in one pass, with a final pass'; ok = ($brief -match 'Report every blocking finding in this one review' -and $brief -match 'Final pass done') },
        @{ n = 'brief says an empty diff is wrong';      ok = ($brief -match 'must\s+not\s+be\s+empty') }
    )
    $script = Get-Content (Join-Path $PSScriptRoot 'external-review.ps1') -Raw
    $checks += @{ n = 'external-review.ps1 builds the brief with Get-ReviewerBrief'; ok = ($script -match 'Get-ReviewerBrief -Header' -and $script -match 'WorktreeLeaf \(Split-Path -Leaf \$wt\)') }
    $text = Get-Content $AgentFile -Raw
    $body = ($text -split '(?m)^---\s*$', 3)[2]
    $checks += @{ n = 'agent body has no "git -C"';       ok = ($body -notmatch 'git\s+-C') }
    $checks += @{ n = 'agent body makes the tree proof the first call and stops on mismatch'; ok = ($body -match 'FIRST tool call' -and $body -match 'wrong tree' -and $body -match 'must not be\s+empty') }
    $checks += @{ n = 'agent body forbids typing the path'; ok = ($body -match 'never type') }
    $checks += @{ n = 'agent deny rules for git -C stay';   ok = ($text -match '"git -C \* push\*": deny') }
    foreach ($c in $checks) {
        if ($c.ok) { Write-Host "ok   $($c.n)" } else { Write-Host "FAIL $($c.n)"; $fail++ }
    }
    return $fail
}
