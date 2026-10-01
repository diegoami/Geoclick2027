<#
.SYNOPSIS
  Independent review of a PR (or a release candidate) by an OpenCode model,
  posted to GitHub as ONE comment by this script, never by the model.

.EXAMPLE
  pwsh scripts/external-review.ps1 -Pr 150
  pwsh scripts/external-review.ps1 -Issue 150 -Kind release
  pwsh scripts/external-review.ps1 -Pr 150 -Model opencode/deepseek-v4.1-flash -DryRun

.NOTES
  Exit codes: 0 posted; 3 OpenCode unavailable (nothing posted, caller falls
  back); 5 the PR head moved during the review (nothing posted).
  -DryRun only prints the arguments; it never runs a model, so it costs nothing.
#>
param(
    [int] $Pr,
    [int] $Issue,
    [ValidateSet('pr', 'release')] [string] $Kind = 'pr',
    [string] $BriefFile,
    # Order matters. "model#variant" sets the reasoning variant.
    [string[]] $Model = @('opencode/gpt-5.6-luna#high', 'opencode/glm-5.3-flash', 'opencode/deepseek-v4.1-flash'),
    [string[]] $ExcludeModel = @(),
    [string] $Agent = 'external-reviewer',
    [string[]] $CopyFiles = @(),
    [switch] $ApplyLabel,
    [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (& git -C $here rev-parse --path-format=absolute --git-common-dir | Split-Path -Parent) -replace '\\', '/'
$watcher = Join-Path $here 'Invoke-OpenCodeWatched.ps1'
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
if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $review | Out-Null
    & git -C $repo fetch -q origin 2>$null
    & git -C $repo worktree add -q --detach $wt $headSha
    if ((& git -C $wt rev-parse HEAD) -ne $headSha) { throw "worktree is not at $headSha" }
    foreach ($f in $CopyFiles) { Copy-Item (Join-Path $repo $f) (Join-Path $wt $f) -Force }
    New-Item -ItemType Directory -Force -Path "$wt/rendered" | Out-Null
}
$work = if ($DryRun) { $repo } else { $wt }

function New-Brief([string] $header, [string] $path) {
    $verdicts = if ($Kind -eq 'pr') { 'approve | approve after named fixes | rework | user decision' } else { 'AGREE | BLOCK (BLOCK if any finding is MUST-FIX)' }
    $body = @"
# Brief

Header line (use it EXACTLY as line 1 of your final message): $header

Reviewing: $Kind. Base: $baseRef ($baseSha). Head: $headSha.
Your working directory is a detached worktree at the head: $wt
Diff to review: git diff $baseSha...$headSha

Allowed verdicts (line 2, and again alone as the very last line): $verdicts

Stay inside your worktree. Do not read or write any path outside it. Do not
read half the repository: the contract below is pasted so you do not have to
look for it. Verify its claims against the code.

## Contract

$contract

## Extra instructions from the caller

$(if ($BriefFile) { Get-Content $BriefFile -Raw } else { 'None. Follow your agent instructions.' })
"@
    [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
}

function Validate-Review([string] $text, [string] $header, [string[]] $verdicts) {
    $t = $text.Trim() -replace "`r`n", "`n"
    $lines = $t -split "`n"
    if ($lines.Count -lt 3 -and $t.StartsWith($header)) {
        # A review flattened onto one line: accept it only if it still has the
        # header + verdict at the start and the verdict at the end.
        foreach ($v in $verdicts) {
            if ($t -match ('^' + [regex]::Escape($header) + '\s*' + [regex]::Escape($v) + '\b') -and $t.EndsWith($v)) {
                $rest = $t.Substring($header.Length).TrimStart().Substring($v.Length).Trim()
                $rest = $rest.Substring(0, $rest.Length - $v.Length).TrimEnd()
                return "$header`n$v`n`n$rest`n`n$v"
            }
        }
        return $null
    }
    if ($lines[0].Trim() -ne $header) { return $null }
    $verdict = $lines[1].Trim()
    if ($verdicts -notcontains $verdict) { return $null }
    if ($lines[-1].Trim() -ne $verdict) { return $null }
    return $t
}

$verdictSet = if ($Kind -eq 'pr') { @('approve after named fixes', 'approve', 'rework', 'user decision') } else { @('AGREE', 'BLOCK') }
$failures = [System.Collections.Generic.List[string]]::new()
$classes = @()
$posted = $false
try {
    foreach ($m in $chain) {
        $prior = if ($failures.Count) { '; ' + ($failures -join '; ') } else { '' }
        $header = "$(if ($Kind -eq 'pr') { 'PR review' } else { 'Release review' }) ($($m.Name)$prior)"
        $out = if ($DryRun) { Join-Path $repo "rendered/ext-review-dry-$token" } else { Join-Path $repo "rendered/ext-review/$Kind$subject-$token/$($m.Name -replace '\W','')" }
        New-Item -ItemType Directory -Force -Path $out | Out-Null
        $brief = Join-Path $out 'brief.md'
        New-Brief $header $brief

        $w = @('-NoProfile', '-File', $watcher, '-Dir', $work, '-Agent', $Agent, '-Model', $m.Id, '-BriefFile', $brief,
            '-OutDir', $out, '-Title', "ext-review-$Kind$subject-$token-$($m.Name -replace '\W','')")
        if ($m.Variant) { $w += @('-Variant', $m.Variant) }
        if ($DryRun) { $w += '-PrintArgs' }
        & pwsh @w
        if ($DryRun) { continue }

        $result = Get-Content (Join-Path $out 'result.json') -Raw | ConvertFrom-Json
        $class = $result.class
        if ($class -eq 'ok') {
            $review = Validate-Review $result.text $header $verdictSet
            if (-not $review) { $class = 'malformed'; $result.detail = 'header, verdict or closing verdict line is wrong' }
        }
        if ($class -ne 'ok') {
            Write-Host "$($m.Name) failed: $class $($result.detail)"
            $failures.Add("$($m.Name) failed: $class" + $(if ($class -eq 'permission-rejected') { " ($($result.detail))" } else { '' }))
            $classes += $class
            if ($classes.Count -ge 2 -and $classes[-1] -eq $classes[-2]) { Write-Host 'two consecutive failures of one class: stopping'; break }
            continue
        }

        # --- post one comment ---------------------------------------------------
        $review = [regex]::Replace($review, '(?i)\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+(#\d+)', 'see $3')
        if ($Kind -eq 'pr') {
            $now = (Invoke-Gh pr view $Pr --json headRefOid | ConvertFrom-Json).headRefOid
            if ($now -ne $headSha) { Write-Host "PR head moved ($headSha -> $now); nothing posted"; exit 5 }
        }
        $file = Join-Path $out 'comment.md'
        [System.IO.File]::WriteAllText($file, $review, [System.Text.UTF8Encoding]::new($false))
        $url = if ($Kind -eq 'pr') { Invoke-Gh pr comment $Pr --body-file $file } else { Invoke-Gh issue comment $Issue --body-file $file }
        Write-Host "posted: $url"
        $posted = $true

        if ($ApplyLabel) {
            $verdict = ($review -split "`n")[1].Trim()
            $label = switch ($verdict) { { $_ -in 'approve', 'AGREE' } { 'status:approved' } 'user decision' { 'status:decision' } default { 'status:rework' } }
            $target = if ($Kind -eq 'pr') { $Pr } else { $Issue }
            $colors = @{ 'status:approved' = '2da44e'; 'status:rework' = 'd1242f'; 'status:decision' = 'bf8700' }
            foreach ($l in $colors.Keys) { & gh label create $l --color $colors[$l] 2>$null | Out-Null }
            $others = ($colors.Keys | Where-Object { $_ -ne $label }) -join ','
            & gh issue edit $target --add-label $label --remove-label $others 2>&1 | Out-Null
            Write-Host "label: $label on #$target"
        }
        break
    }
} finally {
    if (-not $DryRun) {
        & git -C $repo worktree remove --force $wt 2>&1 | Out-Null
        Write-Host "worktree removed: $wt"
    }
}
if ($DryRun) { exit 0 }
if (-not $posted) { Unavailable ($failures -join '; ') }
exit 0
