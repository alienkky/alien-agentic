# setup-memory-api.ps1 -- Alien Memory API sidecar 빌드 + 가동 + 헬스체크.
#
# 1회 실행. 부팅 후 자동 가동은 autostart-serve.ps1 이 동일 명령을 매번 호출
# (docker compose up -d 는 idempotent).

$ErrorActionPreference = "Stop"

$repo       = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$memoryDir  = Join-Path $repo "automation\intranet\alien-config\memory-api"

if (-not (Test-Path (Join-Path $memoryDir "docker-compose.yml"))) {
    Write-Error "memory-api 폴더 미존재: $memoryDir"
    exit 1
}

Write-Host ""
Write-Host "========== Alien Agentic -- Memory API 셋업 =========="
Write-Host ""

Push-Location $memoryDir
try {
    Write-Host "[1/3] docker compose build + up..."

    # build + up. EAP=Continue 로 풀어 native stderr 가 에러로 안 잡히게.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker compose up -d --build 2>&1 | ForEach-Object { Write-Host "      $_" }
    $upExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    if ($upExit -ne 0) {
        Write-Error "docker compose up 실패 (exit $upExit)"
        exit 1
    }

    Write-Host ""
    Write-Host "[2/3] 컨테이너 가동 대기 (5초)..."
    Start-Sleep -Seconds 5

    Write-Host ""
    Write-Host "[3/3] 헬스체크..."
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 5
        Write-Host "      ok           : $($health.ok)"
        Write-Host "      data_dir     : $($health.data_dir)"
        Write-Host "      mount exists : $($health.data_dir_exists)"
        if (-not $health.data_dir_exists) {
            Write-Warning "마운트가 비어있음 -- shared-memory/agents/ 경로 확인. (셋업은 성공)"
        }

        # 27명 목록 확인
        $agents = Invoke-RestMethod -Uri "http://127.0.0.1:8765/agents" -TimeoutSec 5
        Write-Host "      agents count : $($agents.count)"
        if ($agents.count -gt 0) {
            Write-Host "      샘플 3명:"
            $agents.agents | Select-Object -First 3 | ForEach-Object {
                Write-Host "        - $($_.name)"
            }
        }
    } catch {
        Write-Warning "헬스체크 실패: $_"
        Write-Warning "수동 확인: docker compose -f `"$memoryDir\docker-compose.yml`" logs"
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=========================================================="
Write-Host "DONE. Memory API sidecar 가동 중."
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1. Caddy 라우팅 추가 -- /api/alien-memory/* -> 127.0.0.1:8765"
Write-Host "  2. Multica 사이드바에 메모리 페이지 추가 -- install-memory-page.ps1"
Write-Host "=========================================================="
