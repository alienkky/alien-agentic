# AlienAgentic - daily 08:00 morning routine.
# Task Scheduler "AlienAgentic-Morning" calls this.
#   1) save `aa status` snapshot to _scheduled/morning-{date}.log
#   2) auto-create today's daily-log from template if missing
#
# NOTE: this script is intentionally ASCII-only. PowerShell 5.1 mis-decodes
# BOM-less UTF-8 .ps1 files as cp949, which corrupts Korean string literals.
# Korean text lives in daily-log-template.md and is read via .NET UTF-8.

$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"

$aa = "e:\AlienAgentic\alien-agentic\automation\cli\.venv\Scripts\aa.exe"
$dailyLogs = "e:\AlienAgentic\alien-agentic\shared-memory\daily-logs"
$scriptsDir = "e:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts"
$logDir = Join-Path $dailyLogs "_scheduled"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$today = Get-Date -Format "yyyy-MM-dd"

# 1. aa status snapshot
$statusLog = Join-Path $logDir ("morning-{0}.log" -f $today)
& $aa status *>&1 | Out-File -FilePath $statusLog -Encoding utf8

# 2. auto-create today's daily-log (only if missing)
$logFile = Join-Path $dailyLogs ("{0}.md" -f $today)
if (-not (Test-Path $logFile)) {
    $ko = [System.Globalization.CultureInfo]::GetCultureInfo("ko-KR")
    $wdFull = (Get-Date).ToString("dddd", $ko)   # e.g. Wednesday -> "수요일"
    $wd = $wdFull.Substring(0, 1)                # e.g. "수"
    $tmpl = Join-Path $scriptsDir "daily-log-template.md"
    $content = [System.IO.File]::ReadAllText($tmpl, [System.Text.Encoding]::UTF8)
    $content = $content.Replace("{{DATE}}", $today).Replace("{{WDFULL}}", $wdFull).Replace("{{WD}}", $wd)
    [System.IO.File]::WriteAllText($logFile, $content, (New-Object System.Text.UTF8Encoding $false))
}
