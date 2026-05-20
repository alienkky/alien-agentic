# Alien Agentic 자산을 Open Design 본진에 이식 (alien-config → open-design).
# fresh clone 후에도 이 한 줄이면 우리 브랜드 디자인 시스템·스킬이 복원된다.
#
# open-design 데몬은 pnpm 프로세스라 docker 처럼 자동 재시작이 어렵다 →
# 복사만 하고 재시작은 안내. (데몬이 폴더를 부팅 시 스캔하므로 재시작 필요)

$ErrorActionPreference = "Stop"

$repo       = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$openDesign = Join-Path $repo "automation\intranet\open-design"
$venvPy     = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script     = Join-Path $PSScriptRoot "install-open-design.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}
if (-not (Test-Path $openDesign)) {
    Write-Error "open-design not found at: $openDesign  — 먼저 clone 하세요 (docs/guides/open-design-setup.md)."
    exit 1
}

Write-Host "[1/1] Install Alien Agentic assets into Open Design ($py)"
& $py $script
if ($LASTEXITCODE -ne 0) {
    Write-Error "이식 실패."
    exit 1
}

Write-Host ""
Write-Host "다음: open-design 데몬 재시작 (Ctrl+C → pnpm tools-dev run web) → 피커에서 'Alien Agentic' 선택."
