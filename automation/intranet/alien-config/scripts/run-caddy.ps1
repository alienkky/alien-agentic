# run-caddy.ps1 — AlienAgentic-Caddy Task Scheduler 가 로그온 +30초에 호출.
# Caddy 를 포어그라운드로 실행 (Task 가 lifecycle 관리).
# 자체 로그는 caddy 가 logs/access.log 와 stderr 로 떨군다.

$ErrorActionPreference = "Continue"

$repo     = "e:\AlienAgentic\alien-agentic"
$caddyDir = Join-Path $repo "automation\intranet\alien-config\caddy"
$caddyExe = Join-Path $caddyDir "caddy.exe"
$cfg      = Join-Path $caddyDir "Caddyfile"
$logDir   = Join-Path $repo "shared-memory\daily-logs\_scheduled"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir ("aa-caddy-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

"=== {0} caddy start ===" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Out-File -FilePath $log -Append -Encoding utf8

# 사전 점검 — Caddyfile + caddy.exe 둘 다 있어야 함
if (-not (Test-Path $caddyExe)) {
    "ERROR: caddy.exe 없음 — setup-caddy.ps1 먼저 실행" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}
if (-not (Test-Path $cfg)) {
    "ERROR: Caddyfile 없음 — setup-caddy.ps1 먼저 실행" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}

# 기존 caddy 프로세스 정리 (중복 실행 방지)
Get-Process caddy -ErrorAction SilentlyContinue | ForEach-Object {
    "기존 caddy 프로세스 PID $($_.Id) 종료" | Out-File -FilePath $log -Append -Encoding utf8
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# Caddy 가동 (포어그라운드 — Task 가 살아있는 동안 살아있음)
Set-Location $caddyDir
& $caddyExe run --config $cfg --adapter caddyfile *>&1 |
    Out-File -FilePath $log -Append -Encoding utf8

"=== exit {0} at {1} ===" -f $LASTEXITCODE, (Get-Date -Format "HH:mm:ss") |
    Out-File -FilePath $log -Append -Encoding utf8
