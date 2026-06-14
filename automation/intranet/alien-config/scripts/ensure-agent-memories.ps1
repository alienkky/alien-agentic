# 27명 에이전트의 메모리 디렉토리 + 4 빈 파일 보장.
# setup-memory-api.ps1 가 컨테이너 가동 전에 자동 호출.

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script  = Join-Path $PSScriptRoot "ensure-agent-memories.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}

& $py $script
exit $LASTEXITCODE
