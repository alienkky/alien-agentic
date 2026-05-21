# Multica 전체 셋업 — fresh clone 후 이 한 줄이면 우리 커스터마이즈가 다 복원된다.
#   1. 한국어 locale + 브랜딩 복원 (restore-korean-locale.py)
#   2. Alien Plan 설치 (install-alien-plan.py)
#   3. docker rebuild 1회 (build override 포함 — autostart 와 이미지 정합)
#
# 각 단계 스크립트는 자체적으로도 docker 를 띄우지만, 여기서는 Python 부분만
# 순차 실행하고 docker 는 마지막에 *한 번만* 돌려 빌드 시간을 아낀다.
#
# 사용: setup-multica.ps1

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$multica = Join-Path $repo "automation\intranet\multica"
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $multica)) {
    Write-Error "multica folder not found at: $multica  — 먼저 multica 를 clone 하세요."
    exit 1
}

$steps = @(
    @{ name = "한국어 locale + 브랜딩 복원"; script = "restore-korean-locale.py" },
    @{ name = "Alien Plan 설치";            script = "install-alien-plan.py" }
)

$i = 0
foreach ($step in $steps) {
    $i++
    $scriptPath = Join-Path $PSScriptRoot $step.script
    if (-not (Test-Path $scriptPath)) {
        Write-Error "스크립트 없음: $scriptPath"
        exit 1
    }
    Write-Host ""
    Write-Host "========== [$i/$($steps.Count + 1)] $($step.name) =========="
    & $py $scriptPath
    if ($LASTEXITCODE -ne 0) {
        Write-Error "'$($step.name)' 실패. docker 빌드 전에 중단합니다."
        exit 1
    }
}

Write-Host ""
Write-Host "========== [$($steps.Count + 1)/$($steps.Count + 1)] docker rebuild =========="
Set-Location $multica
$composeArgs = @("-f", "docker-compose.selfhost.yml")
if (Test-Path "docker-compose.selfhost.build.yml") {
    $composeArgs += @("-f", "docker-compose.selfhost.build.yml")
    Write-Host "      using build override: docker-compose.selfhost.build.yml"
}
$composeArgs += @("up", "-d", "--build")
docker compose @composeArgs
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "=========================================================="
Write-Host "DONE. Multica 커스터마이즈 전체 복원 완료."
Write-Host "  - 한국어 + 브랜딩 (Alien Agentic)"
Write-Host "  - 사이드바 최상단 'Alien Plan'"
Write-Host "http://localhost:3000 새로고침."
Write-Host "=========================================================="
