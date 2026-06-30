@echo off
REM start-alien.bat - Alien Agentic stack launcher (double-click)
REM Docker -> multica -> Caddy, then opens browser. Runs hidden (no leftover window).
REM Auto-requests admin (needed for Caddy Task).

set "PS_SCRIPT=E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\start-alien.ps1"

REM admin check -> self-elevate, hidden, no pause
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%PS_SCRIPT%\" -OpenBrowser'"
    exit /b
)

REM already admin -> run hidden (window closes when done, no pause)
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PS_SCRIPT%" -OpenBrowser
exit /b
