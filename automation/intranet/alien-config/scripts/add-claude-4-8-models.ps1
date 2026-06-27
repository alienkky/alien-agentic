# Multica models.go 에 Claude 4.8 추가 (영구 패치).
# fresh clone 후 setup-multica.ps1 가 자동 호출.

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script  = Join-Path $PSScriptRoot "add-claude-4-8-models.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}

& $py $script
exit $LASTEXITCODE
