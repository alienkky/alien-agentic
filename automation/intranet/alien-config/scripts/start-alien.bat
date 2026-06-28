@echo off
REM start-alien.bat - Alien Agentic 전체 스택 한 방 가동 (더블클릭용)
REM Docker -> multica -> Caddy 순서로 띄우고 브라우저까지 염.
REM 관리자 권한 자동 요청 (Caddy Task / setup 에 필요).

set "PS_SCRIPT=E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\start-alien.ps1"

REM 관리자 권한 확인 — 아니면 self-elevate
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 관리자 권한으로 다시 실행합니다...
    powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%PS_SCRIPT%\" -OpenBrowser'"
    exit /b
)

REM 이미 관리자 — 바로 실행
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -OpenBrowser
pause
