# start-alien.ps1 — 재부팅 후 전체 스택 한 방 가동 + 검증.
#
# 재부팅 후 외부 접속(https://...ts.net) 이 안 되는 근본 원인은 *순서·타이밍*:
#   - Caddy Task 는 로그온 +30초에 뜨는데
#   - Docker Desktop + multica 컨테이너는 더 늦게(또는 자동시작 꺼져서 안) 뜸
#   - → Caddy 가 떠도 뒤에 multica 가 없어 404/502
#
# 이 스크립트는 올바른 순서로 각 단계를 *기다리며* 가동한다:
#   [1] Docker Desktop 시작 + daemon 준비 대기
#   [2] multica 컨테이너 up + postgres healthy 대기
#   [3] Caddy 가동 (Task 있으면 Task, 없으면 setup-caddy)
#   [4] 443·외부 접속 검증
#   [5] (옵션) 브라우저 열기
#
# 사용:
#   .\start-alien.ps1                # 전체 가동 + 검증
#   .\start-alien.ps1 -OpenBrowser   # 끝나면 브라우저까지 염
#   (또는 바탕화면 start-alien.bat 더블클릭 — 관리자 권한 자동)

param(
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Continue"

$repo      = "E:\AlienAgentic\alien-agentic"
$multica   = Join-Path $repo "automation\intranet\multica"
$scripts   = Join-Path $repo "automation\intranet\alien-config\scripts"
$composeFile = "docker-compose.selfhost.yml"
$externalUrl = "https://alien-4090.taile7f882.ts.net/alienagentic/issues"
$dockerExe   = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "========== Alien Agentic 전체 스택 가동 ==========" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────
# [1] Docker Desktop 시작 + daemon 준비 대기
# ─────────────────────────────────────────────────────────────
Step "1/5" "Docker Desktop 확인..."
$dockerReady = $false
if (docker info 2>$null) {
    Write-Host "  이미 가동 중" -ForegroundColor Green
    $dockerReady = $true
} else {
    if (Test-Path $dockerExe) {
        Write-Host "  Docker Desktop 시작 중..." -ForegroundColor Cyan
        Start-Process $dockerExe
    } else {
        Write-Host "  ⚠️ Docker Desktop 실행파일 못 찾음: $dockerExe" -ForegroundColor Red
    }
    # 최대 3분 대기 (daemon 준비)
    for ($i = 0; $i -lt 36; $i++) {
        Start-Sleep -Seconds 5
        if (docker info 2>$null) {
            $dockerReady = $true
            Write-Host "  Docker 준비 완료 ($($i*5)초)" -ForegroundColor Green
            break
        }
        if ($i % 4 -eq 0) { Write-Host "  대기 중... ($($i*5)초)" -ForegroundColor DarkGray }
    }
}
if (-not $dockerReady) {
    Write-Host "  ❌ Docker 가 안 뜸. 수동으로 Docker Desktop 실행 후 재시도." -ForegroundColor Red
    return
}

# ─────────────────────────────────────────────────────────────
# [2] multica 컨테이너 up + postgres healthy 대기
# ─────────────────────────────────────────────────────────────
Step "2/5" "Multica 컨테이너 가동..."
Push-Location $multica
try {
    docker compose -f $composeFile up -d 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} finally {
    Pop-Location
}
# postgres healthy 대기 (최대 90초)
Write-Host "  postgres healthy 대기..." -ForegroundColor Cyan
$pgReady = $false
for ($i = 0; $i -lt 18; $i++) {
    $st = docker ps --filter "name=multica-postgres" --format "{{.Status}}" 2>$null
    if ($st -match "healthy") {
        $pgReady = $true
        Write-Host "  multica 준비 완료" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 5
}
if (-not $pgReady) {
    Write-Host "  ⚠️ postgres healthy 확인 안 됨 — 계속 진행 (느린 시작일 수 있음)" -ForegroundColor Yellow
}
docker ps --filter "name=multica" --format "table {{.Names}}`t{{.Status}}"

# ─────────────────────────────────────────────────────────────
# [3] Caddy 가동
# ─────────────────────────────────────────────────────────────
Step "3/5" "Caddy 가동..."
$caddyTask = Get-ScheduledTask -TaskName "AlienAgentic-Caddy" -ErrorAction SilentlyContinue
$caddyRunning = [bool](Get-Process caddy -ErrorAction SilentlyContinue)

if ($caddyRunning) {
    Write-Host "  Caddy 이미 가동 중 — 재시작으로 multica 새 상태 반영" -ForegroundColor Cyan
    Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    $caddyRunning = $false
}

if ($caddyTask) {
    Start-ScheduledTask -TaskName "AlienAgentic-Caddy"
    Write-Host "  AlienAgentic-Caddy Task 가동" -ForegroundColor Green
} else {
    Write-Host "  Task 없음 — setup-caddy.ps1 실행 (최초 셋업)" -ForegroundColor Cyan
    $setup = Join-Path $scripts "setup-caddy.ps1"
    if (Test-Path $setup) { & $setup }
    else { Write-Host "  ❌ setup-caddy.ps1 못 찾음" -ForegroundColor Red }
}
Start-Sleep -Seconds 6

# ─────────────────────────────────────────────────────────────
# [4] 검증 — 443 + 외부 접속
# ─────────────────────────────────────────────────────────────
Step "4/5" "검증..."
$caddyProc = Get-Process caddy -ErrorAction SilentlyContinue
if ($caddyProc) {
    Write-Host "  ✅ Caddy 가동 (PID $($caddyProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ❌ Caddy 프로세스 없음" -ForegroundColor Red
}

$port443 = Get-NetTCPConnection -LocalPort 443 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Name } |
    Select-Object -Unique
if ($port443 -contains "caddy") {
    Write-Host "  ✅ 443 포트 = caddy" -ForegroundColor Green
} elseif ($port443 -contains "tailscaled") {
    Write-Host "  ⚠️ 443 을 tailscaled 가 점유! tailscale serve reset 필요" -ForegroundColor Red
    Write-Host "     실행: tailscale serve reset; 그 후 이 스크립트 재실행" -ForegroundColor Yellow
} else {
    Write-Host "  ⚠️ 443 점유: $($port443 -join ', ')" -ForegroundColor Yellow
}

# localhost + 외부 HTTP 코드
$localCode = try { (Invoke-WebRequest "http://localhost:3000/alienagentic/issues" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
Write-Host "  multica localhost 응답: $localCode"
$extCode = try { (Invoke-WebRequest $externalUrl -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop).StatusCode } catch {
    if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "연결 실패: $($_.Exception.Message)" }
}
Write-Host "  외부 접속 응답: $extCode"

# ─────────────────────────────────────────────────────────────
# [5] 결과 + 브라우저
# ─────────────────────────────────────────────────────────────
Step "5/5" "완료"
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
if ($extCode -eq 200 -or $extCode -eq 304) {
    Write-Host "✅ 전체 스택 가동 완료 — 외부 접속 정상" -ForegroundColor Green
} else {
    Write-Host "⚠️ 외부 접속 아직 ($extCode) — multica 가 더 떠야 할 수 있음. 30초 후 브라우저 새로고침." -ForegroundColor Yellow
}
Write-Host "  외부: $externalUrl"
Write-Host "  로컬: http://localhost:3000"
Write-Host "==========================================================" -ForegroundColor Cyan

if ($OpenBrowser) {
    Start-Sleep -Seconds 3
    Start-Process $externalUrl
}
