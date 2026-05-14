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
