<#
  Reads a model's final message into a review the script can post.

  Policy (owner, 2026-10-02): never throw a review away. Only a message with
  NO header anywhere (tool chatter, or nothing: the early-stop case) is a
  failure. A readable review is normalised and acted on. One whose verdict
  cannot be read, or that looks cut off, is still posted, flagged, with no
  label, and the caller decides.

  Read-Review returns { Status; Verdict; Text; Note; Rewrites } with Status one of
    ok                 header, verdict and closing verdict all read
    verdict-unreadable header found, verdict not in the allowed set (or opening
                       and closing verdicts disagree)
    cut-off            header and verdict found, no closing verdict
    none               no header line anywhere
#>

# "**Verdict: Approve.**" -> "approve": the decoration a model puts around a verdict.
function ConvertTo-PlainLine([string] $line) {
    $s = $line.Trim()
    $s = $s -replace '^\s*>+\s*', ''                    # block quote
    $s = $s -replace '^\s*#+\s*', ''                    # heading
    $s = $s -replace '[*_`]+', ''                       # bold / italic / code
    $s = $s -replace '^\s*(verdict|final verdict)\s*[:\-]\s*', '' # "Verdict:" prefix
    $s = $s -replace '[\s.:;!,\-]+$', ''                # trailing punctuation
    return ($s -replace '\s+', ' ').Trim()
}

function Get-VerdictOf([string] $line, [string[]] $verdicts) {
    $p = ConvertTo-PlainLine $line
    foreach ($v in $verdicts) { if ($p -ieq $v) { return $v } }
    return $null
}

function Read-Review {
    param(
        [string] $Text,
        [string] $Header,            # the header this run asked for (used for the posted copy)
        [string[]] $Verdicts
    )
    $r = [pscustomobject]@{ Status = 'none'; Verdict = $null; Text = $null; Note = $null; Rewrites = 0 }
    if (-not $Text) { return $r }
    $t = ($Text -replace "`r`n", "`n").Trim()
    $lines = @($t -split "`n")

    # The header: the first line that, once decoration is stripped, starts with
    # "PR review" or "Release review". Anything before it is preamble.
    $hi = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ((ConvertTo-PlainLine $lines[$i]) -match '^(?i)(pr|release) review\b') { $hi = $i; break }
    }
    if ($hi -lt 0) { return $r }

    $tail = @($lines[$hi..($lines.Count - 1)])
    $headerLine = ConvertTo-PlainLine $tail[0]
    $rest = @()
    if ($tail.Count -gt 1) { $rest = @($tail[1..($tail.Count - 1)]) }

    # A review flattened onto one line: the verdict follows the header text.
    if ($rest.Count -eq 0) {
        $flat = $headerLine
        $hit = $null
        foreach ($v in $Verdicts) {
            if ($flat -match ('(?i)^(.*?\))\s+' + [regex]::Escape($v) + '\b(.*)$')) { $hit = @{ V = $v; Head = $Matches[1]; Body = $Matches[2].Trim() }; break }
        }
        if ($hit) {
            $headerLine = $hit.Head
            $body1 = $hit.Body
            $closing1 = @()
            # The closing verdict is the last word(s) of the one line.
            if ($body1 -match ('(?i)^(.*?)[\s.:;!,\-]*' + [regex]::Escape($hit.V) + '[\s.:;!,\-]*$')) { $body1 = $Matches[1].Trim(); $closing1 = @($hit.V) }
            $rest = @($hit.V, $body1) + $closing1
        }
    }

    $nb = @($rest | Where-Object { $_.Trim() })
    $verdict = $null
    $bodyStart = 0
    if ($nb.Count) { $verdict = Get-VerdictOf $nb[0] $Verdicts }
    # Keep the header the run asked for when it was reproduced; else the model's own.
    $postedHeader = if ($Header -and ($headerLine -like "$($Header.Substring(0, [Math]::Min(12, $Header.Length)))*")) { $Header } else { $headerLine }

    if (-not $verdict) {
        $r.Status = 'verdict-unreadable'
        $r.Note = 'verdict unreadable'
        $r.Text = "$postedHeader`n`n" + (($rest -join "`n").Trim())
        return $r
    }

    # The closing verdict: one of the last three non-empty lines.
    $last3 = @($nb | Select-Object -Last 3)
    $closeIdx = -1
    for ($k = $nb.Count - 1; $k -ge [Math]::Max(1, $nb.Count - 3); $k--) {
        if (Get-VerdictOf $nb[$k] $Verdicts) { $closeIdx = $k; break }
    }
    $body = if ($nb.Count -gt 1) { @($nb[1..($nb.Count - 1)]) } else { @() }
    if ($closeIdx -lt 1) {
        $r.Status = 'cut-off'; $r.Verdict = $verdict; $r.Note = 'may be cut off'
        $r.Text = "$postedHeader`n$verdict`n`n" + ($body -join "`n")
        return $r
    }
    $closing = Get-VerdictOf $nb[$closeIdx] $Verdicts
    if ($closing -ne $verdict) {
        $r.Status = 'verdict-unreadable'; $r.Note = 'verdict unreadable'
        $r.Text = "$postedHeader`n`n" + ($nb[0..($nb.Count - 1)] -join "`n")
        return $r
    }
    $mid = if ($closeIdx -gt 1) { @($nb[1..($closeIdx - 1)]) } else { @() }
    $after = if ($closeIdx -lt $nb.Count - 1) { @($nb[($closeIdx + 1)..($nb.Count - 1)]) } else { @() }
    $out = "$postedHeader`n$verdict`n`n" + ($mid -join "`n") + "`n`n$verdict"
    if ($after.Count) { $out += "`n`n" + ($after -join "`n") }
    $r.Status = 'ok'; $r.Verdict = $verdict; $r.Text = $out
    return $r
}

# GitHub closes issues from PR bodies and commits, not comments, but a review that
# says "fixes #12" still reads like an instruction: rewrite it, and say so.
function Protect-ClosingKeywords([string] $text) {
    $n = 0
    $new = [regex]::Replace($text, '(?i)\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(#\d+)', { param($m) $script:rewrites++; "see $($m.Groups[2].Value)" })
    return $new
}

function Invoke-ReviewParserSelfTest {
    $V = @('approve after named fixes', 'approve', 'rework', 'user decision')
    $H = 'PR review (DeepSeek V4.1 Flash)'
    $body = "Where I reviewed: x`n`nR1 - a.ts:3 - non-blocking. A real finding."
    $cases = @(
        @{ n = 'plain';                   t = "$H`napprove`n`n$body`n`napprove";                                  s = 'ok';                 v = 'approve' },
        @{ n = 'blank lines';             t = "$H`n`napprove`n`n`n$body`n`n`napprove";                              s = 'ok';                 v = 'approve' },
        @{ n = 'preamble';                t = "Here is my review.`n`n$H`nrework`n$body`nrework";                    s = 'ok';                 v = 'rework' },
        @{ n = 'markdown header+verdict'; t = "**$H**`n**Verdict: Approve.**`n$body`n**approve**";                  s = 'ok';                 v = 'approve' },
        @{ n = 'heading + backticks';     t = "# $H`n``user decision```n$body`n``user decision``";                  s = 'ok';                 v = 'user decision' },
        @{ n = 'lowercase header';        t = "pr review (deepseek v4.1 flash)`napprove after named fixes`n$body`napprove after named fixes"; s = 'ok'; v = 'approve after named fixes' },
        @{ n = 'signed off';              t = "$H`napprove`n$body`napprove`n`n- Reviewer (OpenCode)";               s = 'ok';                 v = 'approve'; signed = $true },
        @{ n = 'one line';                t = "$H approve R1 none. Checked a, b, c. approve";                       s = 'ok';                 v = 'approve' },
        @{ n = 'closing keyword';         t = "$H`napprove`nThis fixes #12 and closes #13.`napprove";               s = 'ok';                 v = 'approve'; rewrite = 2 },
        @{ n = 'no closing verdict';      t = "$H`napprove`n$body";                                                  s = 'cut-off';            v = 'approve' },
        @{ n = 'verdict unreadable';      t = "$H`nlooks good to me`n$body`nlooks good to me";                       s = 'verdict-unreadable'; v = $null },
        @{ n = 'tool chatter only';       t = "> git -C wt rev-parse HEAD`nabc123`nReading the diff...";             s = 'none';               v = $null },
        @{ n = 'nothing';                 t = '';                                                                    s = 'none';               v = $null }
    )
    $fail = 0
    foreach ($c in $cases) {
        $r = Read-Review -Text $c.t -Header $H -Verdicts $V
        $text = $r.Text
        $script:rewrites = 0
        if ($text) { $text = Protect-ClosingKeywords $text }
        $ok = ($r.Status -eq $c.s) -and ($r.Verdict -eq $c.v)
        if ($ok -and $c.rewrite) { $ok = ($script:rewrites -eq $c.rewrite) -and ($text -notmatch '(?i)\b(fixes|closes) #\d+') }
        if ($ok -and $c.s -eq 'ok') { $ok = ($text.StartsWith($H, 'OrdinalIgnoreCase')) -and ($c.signed -or $text.TrimEnd().EndsWith($c.v)) }
        '{0,-5} {1,-24} -> {2}' -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $c.n, $r.Status
        if (-not $ok) { $fail++ }
    }
    if ($fail) { Write-Host "$fail of $($cases.Count) cases failed"; return 1 }
    Write-Host "all $($cases.Count) cases pass"
    return 0
}
