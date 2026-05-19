# AlienAgentic — 로그온 시 multica daemon 시작.
# Task Scheduler "AlienAgentic-Daemon" 이 120초 지연 후 호출
# (Multica 서버가 먼저 떠 있어야 daemon 이 연결 가능).
# daemon 이 claude CLI 를 감지해야 하므로 PATH 에 ~/.local/bin 을 보장한다.

$ErrorActionPreference = "Continue"

$env:Path += ";C:\Users\kimto\.local\bin"

$logDir = "e:\AlienAgentic\alien-agentic\shared-memory\daily-logs\_scheduled"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir ("aa-daemon-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

"=== {0} daemon start ===" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Out-File -FilePath $log -Append -Encoding utf8

& "C:\Users\kimto\.multica\bin\multica.exe" daemon start *>&1 |
    Out-File -FilePath $log -Append -Encoding utf8

"=== exit {0} ===" -f $LASTEXITCODE | Out-File -FilePath $log -Append -Encoding utf8
