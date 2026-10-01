<#
.SYNOPSIS
  Runs `opencode run` under a watchdog and reports a failure class.

.DESCRIPTION
  Writes <OutDir>/result.json: { class, detail, exitCode, session, version,
  dataDir, stdout, stderr, text }. Exit code 0 when class is "ok", otherwise 4.
  Failure classes: ok, no-session, idle-timeout, total-timeout,
  exited-without-session, nonzero-exit, permission-rejected, default-agent,
  cut-off, unknown-model, unknown-agent, no-executable.

  Notes that cost a day to learn (see docs/EXTERNAL_REVIEW.md):
  - Starts the real opencode.exe, not the npm .cmd shim (the shim cannot carry
    a multi-line prompt and killing it orphans opencode.exe).
  - Stdin is an empty file: `opencode run` waits for stdin EOF before it makes
    a session, which looks like a silent hang.
  - Runs use their own XDG_DATA_HOME so the desktop app cannot migrate the
    database to a schema this CLI cannot read. auth.json is copied, never read.
  - The brief is attached with -f, not passed as an argument, so quoting a
    multi-line prompt is not an issue.
#>
param(
    [Parameter(Mandatory)] [string] $Dir,
    [Parameter(Mandatory)] [string] $Agent,
    [Parameter(Mandatory)] [string] $Model,
    [Parameter(Mandatory)] [string] $BriefFile,
    [Parameter(Mandatory)] [string] $OutDir,
    [string] $Variant = '',
    [string] $Title = ("review-" + [guid]::NewGuid().ToString('N').Substring(0, 8)),
    [string] $Message = 'Follow the attached brief exactly. Your final message is the review.',
    [int] $StartupSeconds = 180,
    [int] $IdleSeconds = 600,
    [int] $TotalSeconds = 3600,
    [string] $DataDir = (Join-Path $env:LOCALAPPDATA 'geoclick-opencode-review\data'),
    [switch] $PrintArgs,
    [switch] $RefreshData
)

$ErrorActionPreference = 'Stop'
# opencode writes UTF-8; without this its output is decoded as the console code page (mojibake in posted reviews).
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stdoutFile = Join-Path $OutDir 'stdout.txt'
$stderrFile = Join-Path $OutDir 'stderr.txt'
$stdinFile = Join-Path $OutDir 'stdin-empty.txt'
$resultFile = Join-Path $OutDir 'result.json'
[System.IO.File]::WriteAllText($stdinFile, '')

$script:result = [ordered]@{
    class = 'ok'; detail = ''; exitCode = $null; session = $null; version = $null
    dataDir = $DataDir; stdout = $stdoutFile; stderr = $stderrFile; text = $null
}

function Finish([string] $class, [string] $detail = '') {
    $script:result.class = $class
    $script:result.detail = $detail
    ($script:result | ConvertTo-Json -Depth 4) | Set-Content -Encoding utf8NoBOM -Path $resultFile
    Write-Host "watcher: $class $detail"
    Write-Host "watcher: stdout=$stdoutFile stderr=$stderrFile result=$resultFile"
    if ($class -eq 'ok') { exit 0 } else { exit 4 }
}

function Stop-Tree([int] $ProcId) {
    & taskkill.exe /PID $ProcId /T /F 2>&1 | Out-Null
}

function Strip-Ansi([string] $s) { [regex]::Replace($s, '\x1B\[[0-9;?]*[ -/]*[@-~]', '') }

# --- the real executable -----------------------------------------------------
$exe = $env:OPENCODE_EXE
if (-not $exe) {
    $shim = (Get-Command opencode -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if ($shim) {
        $root = Join-Path (Split-Path $shim) 'node_modules\opencode-ai\bin\opencode.exe'
        if (Test-Path $root) { $exe = $root }
        else {
            $exe = Get-ChildItem (Split-Path $shim) -Recurse -Filter opencode.exe -ErrorAction SilentlyContinue |
                Select-Object -First 1 -ExpandProperty FullName
        }
    }
}
if (-not $exe -or -not (Test-Path $exe)) { Finish 'no-executable' 'opencode.exe not found; set OPENCODE_EXE' }

# --- data directory: own database, auth copied (never read) ------------------
$ocData = Join-Path $DataDir 'opencode'
New-Item -ItemType Directory -Force -Path $ocData | Out-Null
$srcAuth = Join-Path $HOME '.local\share\opencode\auth.json'
$dstAuth = Join-Path $ocData 'auth.json'
if ((Test-Path $srcAuth) -and (-not (Test-Path $dstAuth) -or (Get-Item $srcAuth).LastWriteTime -gt (Get-Item $dstAuth).LastWriteTime)) {
    Copy-Item $srcAuth $dstAuth -Force
}
# The opencode-go subscription lives in the database (account state), not in
# auth.json: without a copy of it this data dir lists no opencode-go models.
# Copied once (or with -RefreshData), never read. If the desktop app has since
# migrated the original to a newer schema, pass -RefreshData to re-copy.
$srcDb = Join-Path $HOME '.local\share\opencode\opencode.db'
$dstDb = Join-Path $ocData 'opencode.db'
if ((Test-Path $srcDb) -and ($RefreshData -or -not (Test-Path $dstDb))) {
    foreach ($suffix in '', '-wal', '-shm') {
        $s = "$srcDb$suffix"; $d = "$dstDb$suffix"
        if (Test-Path $d) { Remove-Item $d -Force -ErrorAction SilentlyContinue }
        if (Test-Path $s) { Copy-Item $s $d -Force }
    }
    Write-Host 'watcher: seeded the review database from the default one'
}
$env:XDG_DATA_HOME = $DataDir
Write-Host "watcher: data dir $DataDir"

$versionText = (& $exe --version 2>&1 | Select-Object -First 1).ToString().Trim()
$major = [int](($versionText -split '\.')[0] -replace '\D', '')
$script:result.version = $versionText

# --- fail fast on an unknown model or agent ----------------------------------
Push-Location $Dir
$models = & $exe models 2>&1 | ForEach-Object { $_.ToString().Trim() }
& $exe debug agent $Agent *> $null
$agentOk = ($LASTEXITCODE -eq 0)
Pop-Location
if ($models -notcontains $Model) { Finish 'unknown-model' "$Model is not in the output of 'opencode models'" }
if (-not $agentOk) { Finish 'unknown-agent' "$Agent is not an agent in $Dir" }

# --- arguments per major version ---------------------------------------------
$argv = @('run')
if ($major -ge 2) {
    $argv += '--standalone'
    $argv += @('--model', $(if ($Variant) { "$Model#$Variant" } else { $Model }))
} else {
    $argv += @('--dir', $Dir, '--model', $Model)
    if ($Variant) { $argv += @('--variant', $Variant) }
}
$argv += @('--agent', $Agent, '--title', $Title, '--format', 'default', '-f', (Resolve-Path $BriefFile).Path, '--', $Message)

if ($PrintArgs) {
    Write-Host "exe: $exe"; Write-Host "cwd: $Dir"; Write-Host "args: $($argv -join ' ')"
    Write-Host "XDG_DATA_HOME: $DataDir"
    exit 0
}

function Quote([string] $a) { if ($a -match '[\s"]') { '"' + ($a -replace '"', '\"') + '"' } else { $a } }
$proc = Start-Process -FilePath $exe -ArgumentList (($argv | ForEach-Object { Quote $_ }) -join ' ') `
    -WorkingDirectory $Dir -NoNewWindow -PassThru `
    -RedirectStandardInput $stdinFile -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
$started = Get-Date
$startedUtcMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Write-Host "watcher: started pid $($proc.Id) title '$Title' model $Model agent $Agent"

function Find-Session {
    Push-Location $Dir
    try {
        $json = & $exe session list --format json -n 20 2>$null | Out-String
        $rows = $json | ConvertFrom-Json -ErrorAction Stop
        foreach ($r in $rows) {
            if ($r.title -eq $Title) { return $r }
        }
    } catch { } finally { Pop-Location }
    return $null
}

$session = $null
$lastUpdated = $null
$lastAdvance = Get-Date
while (-not $proc.HasExited) {
    Start-Sleep -Seconds 5
    $now = Get-Date
    if (($now - $started).TotalSeconds -gt $TotalSeconds) { Stop-Tree $proc.Id; Finish 'total-timeout' "no end within $TotalSeconds s" }
    if (-not $session) {
        $session = Find-Session
        if ($session) {
            $script:result.session = $session.id
            $lastUpdated = $session.updated; $lastAdvance = $now
            Write-Host "watcher: session $($session.id) started after $([int]($now - $started).TotalSeconds) s"
        } elseif (($now - $started).TotalSeconds -gt $StartupSeconds) {
            Stop-Tree $proc.Id; Finish 'no-session' "no session within $StartupSeconds s"
        }
        continue
    }
    $s = Find-Session
    if ($s -and $s.updated -ne $lastUpdated) { $lastUpdated = $s.updated; $lastAdvance = $now }
    if (($now - $lastAdvance).TotalSeconds -gt $IdleSeconds) {
        Stop-Tree $proc.Id; Finish 'idle-timeout' "session did not advance for $IdleSeconds s"
    }
    $tail = Strip-Ansi ((Get-Content $stdoutFile -Raw -ErrorAction SilentlyContinue) + (Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue))
    if ($tail -match '(?m)^\s*!\s*permission requested: (.+?); auto-rejecting\s*$') {
        # The rejection ends the run; give it a moment to exit, then stop it.
        Start-Sleep -Seconds 3
        if (-not $proc.HasExited) { Stop-Tree $proc.Id }
        Finish 'permission-rejected' $Matches[1]
    }
}
$proc.WaitForExit()
$script:result.exitCode = $proc.ExitCode

$out = Strip-Ansi ((Get-Content $stdoutFile -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue))
if ($out -match '(?m)^\s*!\s*permission requested: (.+?); auto-rejecting\s*$') { Finish 'permission-rejected' $Matches[1] }
# OpenCode prints "> <agent> · <model>" when a run starts. A different agent
# there means the name fell back to the default agent (full permissions).
# Match the banner only: the model's own text must never trigger this.
if ($out -match '(?m)^> (\S+) · ' -and $Matches[1] -ne $Agent) { Finish 'default-agent' "ran as '$($Matches[1])', not '$Agent'" }
if (-not $session) { $session = Find-Session; if ($session) { $script:result.session = $session.id } }
if (-not $session) { Finish 'exited-without-session' "exit code $($proc.ExitCode)" }
if ($proc.ExitCode -ne 0) { Finish 'nonzero-exit' "exit code $($proc.ExitCode)" }

# --- the final assistant message, from the session export ---------------------
Push-Location $Dir
try { $export = & $exe export $session.id 2>$null | Out-String | ConvertFrom-Json -ErrorAction Stop } catch { $export = $null } finally { Pop-Location }
$text = $null
if ($export) {
    $assistant = @($export.messages | Where-Object { $_.info.role -eq 'assistant' })
    if ($assistant.Count) {
        $last = $assistant[-1]
        $text = (($last.parts | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n").Trim()
        if ($last.info.finish -and $last.info.finish -ne 'stop') { Finish 'cut-off' "final message finish=$($last.info.finish)" }
    }
}
if (-not $text) { Finish 'cut-off' 'no final assistant text in the session export' }
$script:result.text = $text
Finish 'ok'
