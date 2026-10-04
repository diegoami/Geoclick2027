# Which model family a name belongs to, so the implementer's whole family is
# kept out of the reviewer chain (GPT Luna and GPT Sol are both "openai").
$script:ModelFamilies = [ordered]@{
    openai   = 'gpt|luna|\bsol\b|openai|codex'
    glm      = 'glm|z-ai|zai'
    deepseek = 'deepseek'
    claude   = 'claude|sonnet|opus|fable|haiku'
}
function Get-ModelFamilies([string] $text) {
    @($script:ModelFamilies.Keys | Where-Object { $text -match "(?i)$($script:ModelFamilies[$_])" })
}

function Invoke-ReviewerFamilySelfTest {
    $failed = 0
    function Check([string] $name, [bool] $ok) {
        if ($ok) { Write-Host "ok   $name" } else { Write-Host "FAIL $name"; $script:failed++ }
    }
    $script:failed = 0
    Check 'sol is openai' ((Get-ModelFamilies 'openai/gpt-6.1-sol#high') -contains 'openai')
    Check 'a Luna trailer is openai' ((Get-ModelFamilies 'Co-Authored-By: GPT-6 Luna (OpenCode)') -contains 'openai')
    Check 'a model:luna label is openai' ((Get-ModelFamilies 'luna') -contains 'openai')
    Check 'a Sol trailer is openai' ((Get-ModelFamilies 'Co-Authored-By: GPT-6.1 Sol (OpenCode)') -contains 'openai')
    Check 'glm on the coding plan is glm, not openai' (((Get-ModelFamilies 'zai-coding-plan/glm-5.3-flash#high') -join ',') -eq 'glm')
    Check 'deepseek is only deepseek' (((Get-ModelFamilies 'opencode-go/deepseek-v4.1-flash') -join ',') -eq 'deepseek')
    Check 'Claude Sonnet is claude' ((Get-ModelFamilies 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>') -contains 'claude')
    Check 'console is not sol' (-not ((Get-ModelFamilies 'console') -contains 'openai'))
    return $script:failed
}
