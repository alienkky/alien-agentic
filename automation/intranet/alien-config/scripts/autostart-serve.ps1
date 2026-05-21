# AlienAgentic — 로그온 시 Multica 컨테이너를 빌드(dev) 이미지로 가동.
# Task Scheduler "AlienAgentic-Serve" 가 60초 지연 후 호출.
# 빌드 override(docker-compose.selfhost.build.yml)를 함께 써서
# 한국어화 + UI 패치가 적용된 multica-web:dev / multica-backend:dev 를 보장한다.

$ErrorActionPreference = "Continue"

$multicaDir = "e:\AlienAgentic\alien-agentic\automation\intranet\multica"
$logDir = "e:\AlienAgentic\alien-agentic\shared-memory\daily-logs\_scheduled"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir ("aa-serve-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

"=== {0} serve start ===" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Out-File -FilePath $log -Append -Encoding utf8

Set-Location $multicaDir
docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d *>&1 |
    Out-File -FilePath $log -Append -Encoding utf8

"=== exit {0} ===" -f $LASTEXITCODE | Out-File -FilePath $log -Append -Encoding utf8

# HTTPS — Tailscale serve 로 secure context 보장.
# 어느 기기(폰/패드 포함)에서 접속하든 https:// 라 음성 입력·마이크·클립보드
# 등 secure-context 전용 기능이 작동한다. http://IP:3000 은 비보안이라 막힘.
# 전제: Tailscale 관리 콘솔에서 HTTPS 인증서 기능이 켜져 있어야 함
#   (https://login.tailscale.com/admin/dns → "Enable HTTPS").
# tailscale serve 설정은 영구 저장(--bg)이라 매 부팅 재호출해도 idempotent.
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($tailscale) {
    "=== {0} tailscale serve ===" -f (Get-Date -Format "HH:mm:ss") | Out-File -FilePath $log -Append -Encoding utf8
    tailscale serve --bg --https=443 http://localhost:3000 *>&1 |
        Out-File -FilePath $log -Append -Encoding utf8
    "=== serve exit {0} ===" -f $LASTEXITCODE | Out-File -FilePath $log -Append -Encoding utf8
} else {
    "tailscale CLI 없음 — HTTPS serve 건너뜀 (PATH 확인)" | Out-File -FilePath $log -Append -Encoding utf8
}
