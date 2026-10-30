param([string]$CreCommand = 'cre')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$creRoot = Join-Path $projectRoot 'cre'
$evidenceRoot = Join-Path $projectRoot 'evidence'
$targets = @(
  @{ Name='local-settings'; Expected='"publishStatus"' },
  @{ Name='onchain-settings'; Expected='read-only registry check; no transaction sent' },
  @{ Name='onchain-stale-settings'; Expected='registry current epoch mismatch' },
  @{ Name='bad-hash-settings'; Expected='content hash mismatch' },
  @{ Name='bad-root-settings'; Expected='root mismatch' },
  @{ Name='stale-settings'; Expected='version or dataset mismatch' },
  @{ Name='invalid-schema-settings'; Expected='schema' },
  @{ Name='unavailable-settings'; Expected='dataset HTTP 404' }
)
$failed = $false
Push-Location $creRoot
try {
  foreach ($target in $targets) {
    $name = $target.Name
    $log = Join-Path $evidenceRoot "cre-$name.txt"
    $ErrorActionPreference = 'Continue'
    $output = & $CreCommand workflow simulate .\listproof --target $name --non-interactive --trigger-index 0 2>&1 | Out-String
    $exit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    Set-Content -LiteralPath $log -Value $output -Encoding UTF8
    $matched = $output.Contains($target.Expected)
    $complete = $output.Contains('Simulation complete')
    $pass = if ($name -in @('local-settings','onchain-settings')) { $exit -eq 0 -and $complete -and $matched } else { $matched -and (-not $complete -or $exit -ne 0) }
    if (-not $pass) { $failed = $true }
    Write-Host "$name : $(if ($pass) {'PASS'} else {'FAIL'}) (exit=$exit; expected=$($target.Expected); log=$log)"
  }
} finally { Pop-Location }
if ($failed) { exit 1 }
