<#
.SYNOPSIS
  Independent review of a PR (or a release candidate) by an OpenCode model,
  posted to GitHub as ONE comment by this script, never by the model.

.EXAMPLE
  pwsh scripts/external-review.ps1 -Pr 150
  pwsh scripts/external-review.ps1 -Issue 150 -Kind release
  pwsh scripts/external-review.ps1 -Pr 150 -Model opencode/deepseek-v4.1-flash -DryRun

.NOTES
  Exit codes: 0 posted and acted on; 3 OpenCode unavailable or no review at all
  (nothing posted; the caller runs the Claude fallback, Opus, on the printed
  brief); 4 posted but flagged ("verdict unreadable" / "may be cut off"), no
  label applied: the caller reads it and decides; 5 the PR head moved during the
  review (nothing posted).

  Roles (owner, 2026-10-02): reviewer DeepSeek V4.1 Flash (effort high), then
  Claude Opus (the caller, on exit 3). Implementer: Claude Sonnet, then GPT Luna.
  Other models stay valid as an explicit -Model, but no default picks them.

  -DryRun never runs a model (so it costs nothing): it prints the arguments, or,
  with -FromFile, what would be posted, the note line and the exit code.
  -FromFile <file> runs a saved model message through the same parser, so a
  review already paid for is never thrown away.
  -SelfTest runs the parser's sample outputs and the brief/agent checks, and exits.

  Watcher failure classes the caller sees: no-session, idle-timeout,
  total-timeout, exited-without-session, nonzero-exit, permission-rejected,
  default-agent, cut-off, unknown-model, unknown-agent, no-executable, no-auth,
  and no-review (no header line anywhere in a run that otherwise succeeded).
#>
param(
    [int] $Pr,
    [int] $Issue,
    [ValidateSet('pr', 'release')] [string] $Kind = 'pr',
    [string] $BriefFile,
    # "model#variant" sets the reasoning variant: high, never max. One OpenCode
    # model per role: more entries multiply wasted paid attempts.
    [string[]] $Model = @(),
    [string[]] $ExcludeModel = @(),
    [string] $Agent = 'external-reviewer',
    [string[]] $CopyFiles = @(),
    [string] $FromFile,
    [switch] $ApplyLabel,
    [switch] $DryRun,
    [switch] $SelfTest
)

$ErrorActionPreference = 'Stop'

# No -Model: the reviewer named in .opencode/reviewer-model (one line,
# "provider/model#variant"), set with the switch-reviewer skill.
if (-not $Model -or $Model.Count -eq 0) {
    $cfg = Join-Path (Split-Path -Parent $PSScriptRoot) '.opencode/reviewer-model'
    $line = if (Test-Path $cfg) { (Get-Content $cfg | Where-Object { $_.Trim() -and -not $_.StartsWith('#') } | Select-Object -First 1) } else { $null }
    $Model = @(if ($line) { $line.Trim() } else { 'opencode-go/deepseek-v4.1-flash#high' })
}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (& git -C $here rev-parse --path-format=absolute --git-common-dir | Split-Path -Parent) -replace '\\', '/'
$watcher = Join-Path $here 'Invoke-OpenCodeWatched.ps1'
. (Join-Path $here 'ReviewParser.ps1')
. (Join-Path $here 'ReviewerBrief.ps1')
if ($SelfTest) {
    $failed = [int]@(Invoke-ReviewParserSelfTest)[-1]
    $failed += [int]@(Invoke-ReviewerBriefSelfTest -AgentFile (Join-Path (Split-Path -Parent $here) '.opencode/agents/external-reviewer.md'))[-1]
    exit $failed
}
$token = [guid]::NewGuid().ToString('N').Substring(0, 6)
if ($Issue -and -not $Pr -and -not $PSBoundParameters.ContainsKey('Kind')) { $Kind = 'release' }
$subject = if ($Kind -eq 'pr') { $Pr } else { $Issue }
if (-not $subject) { throw 'Give -Pr <n> (a PR) or -Issue <n> -Kind release (a milestone issue).' }

$display = @{ 'luna' = 'Luna'; 'glm' = 'GLM 5.3 Flash'; 'deepseek' = 'DeepSeek V4.1 Flash' }
function Display([string] $id) {
    foreach ($k in $display.Keys) { if ($id -match $k) { return $display[$k] } }
    return $id
}
function Invoke-Gh { & gh @args 2>&1 }
function Unavailable([string] $cause) {
    Write-Host "OpenCode unavailable: $cause"
    exit 3
}

# --- what is under review ------------------------------------------------------
if ($Kind -eq 'pr') {
    $meta = Invoke-Gh pr view $Pr --json "state,title,body,baseRefName,baseRefOid,headRefOid,labels" | ConvertFrom-Json
    if ($meta.state -ne 'OPEN') { throw "PR #$Pr is $($meta.state), not open." }
    $baseRef = $meta.baseRefName; $headSha = $meta.headRefOid; $baseSha = $meta.baseRefOid
    $contract = "PR #${Pr}: $($meta.title)`n`n$($meta.body)"
    $prLabels = @($meta.labels | ForEach-Object { $_.name })
} else {
    $meta = Invoke-Gh issue view $Issue --json "title,body" | ConvertFrom-Json
    if ($meta.body -notmatch '\*\*Candidate\*\*:\s*`([0-9a-f]{40})`') { throw 'No full Candidate SHA in the milestone issue.' }
    $headSha = $Matches[1]
    if ($meta.body -notmatch '\*\*Previous milestone\*\*:\s*`(v[0-9][^`]*)`') { throw 'No previous milestone tag in the issue.' }
    $baseSha = $Matches[1]; $baseRef = $baseSha
    $contract = "Milestone issue #${Issue}: $($meta.title)`n`n$($meta.body)"
    $prLabels = @()
}

# --- the chain, minus the implementer -------------------------------------------
$exclude = @($ExcludeModel)
foreach ($l in $prLabels) { if ($l -like 'model:*') { $exclude += $l.Substring(6) } }
if (-not $DryRun) {
    & git -C $repo fetch -q origin $(if ($Kind -eq 'pr') { "pull/$Pr/head" } else { 'main' }) --tags 2>$null
    $trailers = (& git -C $repo log "$baseSha..$headSha" --format=%b 2>$null) -join "`n"
    foreach ($m in $display.Keys) { if ($trailers -match "(?im)^Co-Authored-By:.*$m") { $exclude += $m } }
}
$chain = @()
foreach ($entry in $Model) {
    $id, $variant = $entry -split '#', 2
    if ($exclude | Where-Object { $_ -and $id -match [regex]::Escape($_) }) {
        Write-Host "skipping ${id}: it implemented (or is excluded from) this change"; continue
    }
    $chain += [pscustomobject]@{ Id = $id; Variant = $variant; Name = Display $id }
}
if (-not $chain.Count) { Unavailable 'every model in the chain is excluded' }

# --- worktree --------------------------------------------------------------------
$review = "$repo-review"
$wt = "$review/$Kind$subject-review-$token"
$makeWorktree = -not $DryRun -and -not $FromFile   # -FromFile needs no worktree
if ($makeWorktree) {
    New-Item -ItemType Directory -Force -Path $review | Out-Null
    & git -C $repo fetch -q origin 2>$null
    & git -C $repo worktree add -q --detach $wt $headSha
    if ((& git -C $wt rev-parse HEAD) -ne $headSha) { throw "worktree is not at $headSha" }
    # The reviewer's own definition comes from the trusted checkout this script
    # runs from, never from the PR head: the PR may predate it, or edit it.
    $trusted = Join-Path (Split-Path -Parent $here) ".opencode/agents/$Agent.md"
    New-Item -ItemType Directory -Force -Path "$wt/.opencode/agents" | Out-Null
    Copy-Item $trusted "$wt/.opencode/agents/$Agent.md" -Force
    foreach ($f in $CopyFiles) { Copy-Item (Join-Path $repo $f) (Join-Path $wt $f) -Force }
    New-Item -ItemType Directory -Force -Path "$wt/rendered" | Out-Null
}
$work = if ($makeWorktree) { $wt } else { $repo }

function New-Brief([string] $header, [string] $path) {
    $verdicts = if ($Kind -eq 'pr') { 'approve | approve after named fixes | rework | user decision' } else { 'AGREE | BLOCK (BLOCK if any finding is MUST-FIX)' }
    $extra = if ($BriefFile) { Get-Content $BriefFile -Raw } else { 'None. Follow your agent instructions.' }
    $body = Get-ReviewerBrief -Header $header -Kind $Kind -BaseRef $baseRef -BaseSha $baseSha -HeadSha $headSha `
        -WorktreeLeaf (Split-Path -Leaf $wt) -Verdicts $verdicts -Contract $contract -Extra $extra
    [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
}

$verdictSet = if ($Kind -eq 'pr') { @('approve after named fixes', 'approve', 'rework', 'user decision') } else { @('AGREE', 'BLOCK') }
$target = if ($Kind -eq 'pr') { $Pr } else { $Issue }

# Posts one comment from a parsed review; returns the exit code the run ends with.
function Publish-Review($parsed, [string] $outDir) {
    $script:rewrites = 0
    $text = Protect-ClosingKeywords $parsed.Text
    if ($script:rewrites) { Write-Host "rewrote $($script:rewrites) closing keyword(s) before #n to 'see #n'" }
    $flagged = $parsed.Status -ne 'ok'
    if ($flagged) { $text = "> Note from external-review.ps1: $($parsed.Note). Read it and decide; no label was applied.`n`n$text" }
    $code = if ($flagged) { 4 } else { 0 }
    if ($DryRun) {
        Write-Host "---- would post to $Kind #$target ----"; Write-Host $text; Write-Host '----'
        Write-Host "would exit $code$(if (-not $flagged -and $ApplyLabel) { " and label by verdict '$($parsed.Verdict)'" })"
        return $code
    }
    if ($Kind -eq 'pr' -and $headSha) {
        $now = (Invoke-Gh pr view $Pr --json headRefOid | ConvertFrom-Json).headRefOid
        if ($now -ne $headSha) { Write-Host "PR head moved ($headSha -> $now); nothing posted"; exit 5 }
    }
    $file = Join-Path $outDir 'comment.md'
    [System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))
    $url = if ($Kind -eq 'pr') { Invoke-Gh pr comment $Pr --body-file $file } else { Invoke-Gh issue comment $Issue --body-file $file }
    Write-Host "posted: $url$(if ($flagged) { " (flagged: $($parsed.Note))" })"
    if ($ApplyLabel -and -not $flagged) {
        $label = switch ($parsed.Verdict) { { $_ -in 'approve', 'AGREE' } { 'status:approved' } 'user decision' { 'status:decision' } default { 'status:rework' } }
        $colors = @{ 'status:approved' = '2da44e'; 'status:rework' = 'd1242f'; 'status:decision' = 'bf8700' }
        foreach ($l in $colors.Keys) { & gh label create $l --color $colors[$l] 2>$null | Out-Null }
        $others = ($colors.Keys | Where-Object { $_ -ne $label }) -join ','
        & gh issue edit $target --add-label $label --remove-label $others 2>&1 | Out-Null
        Write-Host "label: $label on #$target"
    } elseif ($flagged) { Write-Host 'no label applied (flagged review): read it and decide' }
    return $code
}

# A saved model message goes through the same parser and the same posting.
if ($FromFile) {
    $saved = Get-Content $FromFile -Raw
    $h = "$(if ($Kind -eq 'pr') { 'PR review' } else { 'Release review' }) (from file)"
    $parsed = Read-Review -Text $saved -Header $h -Verdicts $verdictSet
    if ($parsed.Status -eq 'none') { Unavailable 'no review (no header line) in the file' }
    $outDir = Join-Path $repo "rendered/ext-review/$Kind$subject-$token"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    exit (Publish-Review $parsed $outDir)
}

$failures = [System.Collections.Generic.List[string]]::new()
$classes = @()
$exitCode = $null
$lastBrief = $null
try {
    foreach ($m in $chain) {
        $prior = if ($failures.Count) { '; ' + ($failures -join '; ') } else { '' }
        $header = "$(if ($Kind -eq 'pr') { 'PR review' } else { 'Release review' }) ($($m.Name)$prior)"
        $out = if ($DryRun) { Join-Path $repo "rendered/ext-review-dry-$token" } else { Join-Path $repo "rendered/ext-review/$Kind$subject-$token/$($m.Name -replace '\W','')" }
        New-Item -ItemType Directory -Force -Path $out | Out-Null
        $brief = Join-Path $out 'brief.md'
        New-Brief $header $brief
        $lastBrief = $brief

        $w = @('-NoProfile', '-File', $watcher, '-Dir', $work, '-Agent', $Agent, '-Model', $m.Id, '-BriefFile', $brief,
            '-OutDir', $out, '-Title', "ext-review-$Kind$subject-$token-$($m.Name -replace '\W','')")
        if ($m.Variant) { $w += @('-Variant', $m.Variant) }
        if ($DryRun) { $w += '-PrintArgs' }
        & pwsh @w
        if ($DryRun) { continue }

        $result = Get-Content (Join-Path $out 'result.json') -Raw | ConvertFrom-Json
        $class = $result.class
        $parsed = $null
        if ($class -eq 'cut-off' -and $result.text) {
            # The run ended early but left text: never throw a readable review away.
            $parsed = Read-Review -Text $result.text -Header $header -Verdicts $verdictSet
            if ($parsed.Status -eq 'ok') { $parsed.Status = 'cut-off'; $parsed.Note = 'may be cut off' }
            if ($parsed.Status -ne 'none') { $class = 'ok' }
        }
        if ($class -eq 'ok' -and -not $parsed) {
            $parsed = Read-Review -Text $result.text -Header $header -Verdicts $verdictSet
            if ($parsed.Status -eq 'none') { $class = 'no-review'; $result.detail = 'no header line anywhere in the final message' }
        }
        if ($class -ne 'ok') {
            Write-Host "$($m.Name) failed: $class $($result.detail)"
            $failures.Add("$($m.Name) failed: $class" + $(if ($class -eq 'permission-rejected') { " ($($result.detail))" } else { '' }))
            $classes += $class
            if ($classes.Count -ge 2 -and $classes[-1] -eq $classes[-2]) { Write-Host 'two consecutive failures of one class: stopping'; break }
            continue
        }
        # A readable review is never thrown away: Publish-Review flags a doubtful one.
        $exitCode = Publish-Review $parsed $out
        break
    }
} finally {
    if ($makeWorktree) {
        & git -C $repo worktree remove --force $wt 2>&1 | Out-Null
        Write-Host "worktree removed: $wt"
    }
}
if ($DryRun) { exit 0 }
if ($null -eq $exitCode) {
    if ($lastBrief) { Write-Host "fallback brief for the Claude reviewer (make your own worktree at $headSha): $lastBrief" }
    Unavailable ($failures -join '; ')
}
exit $exitCode
