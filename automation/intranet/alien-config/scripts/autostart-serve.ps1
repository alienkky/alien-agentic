# AlienAgentic -- 로그온 시 Multica 컨테이너를 빌드(dev) 이미지로 가동.
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

# HTTPS -- Caddy 가 처리한다 (별도 Task: AlienAgentic-Caddy).
# 이전엔 `tailscale serve --bg --https=443 http://localhost:3000` 을 여기서 호출했지만,
# tailscale serve 가 WebSocket Upgrade 를 forward 못 해 Multica 실시간 푸시(받은함
# 카운팅·에이전트 상태·코멘트)가 죽는 사고(2026-05-27) 발생 → Caddy 로 교체.
#
# Caddy 셋업: setup-caddy.ps1 (1회), 가동: AlienAgentic-Caddy Task (로그온 +30초)
# 인증서 갱신: AlienAgentic-CertRefresh Task (매주 일 03:00)
# 자세한 내용: automation/intranet/alien-config/caddy/README.md
#
# 직접 `tailscale serve --https` 다시 호출 금지 -- Caddy 와 443 점유 충돌.
"HTTPS 종결은 Caddy(AlienAgentic-Caddy Task)가 담당 -- 여기서 처리 안 함" |
    Out-File -FilePath $log -Append -Encoding utf8

# Memory API sidecar -- 27명 에이전트 메모리(work/learnings/decisions/mistakes.md)
# 를 Multica UI 에서 보고 편집할 수 있게 하는 자체 컨테이너.
# docker compose up -d 는 idempotent -- 이미 떠 있으면 no-op.
# 자세한 내용: automation/intranet/alien-config/memory-api/README.md
$memoryDir = "e:\AlienAgentic\alien-agentic\automation\intranet\alien-config\memory-api"
if (Test-Path (Join-Path $memoryDir "docker-compose.yml")) {
    "=== {0} memory-api up ===" -f (Get-Date -Format "HH:mm:ss") |
        Out-File -FilePath $log -Append -Encoding utf8
    Push-Location $memoryDir
    try {
        docker compose up -d *>&1 | Out-File -FilePath $log -Append -Encoding utf8
        "=== memory-api exit {0} ===" -f $LASTEXITCODE |
            Out-File -FilePath $log -Append -Encoding utf8
    } finally {
        Pop-Location
    }
} else {
    "memory-api 폴더 없음 -- 스킵" | Out-File -FilePath $log -Append -Encoding utf8
}
