#requires -RunAsAdministrator

<#
.SYNOPSIS
    Alien Speech 브릿지를 Windows Task Scheduler 에 부팅 자동 시작으로 등록.

.DESCRIPTION
    - Task 이름: AlienSpeechBridge
    - 트리거: 시스템 부팅 + 1분 지연
    - 실패 시 자동 재시작: 1분 후 3회
    - 로그아웃 상태에서도 실행 (Run whether user is logged on or not)

    설치 후:
        Get-ScheduledTask -TaskName AlienSpeechBridge
        Start-ScheduledTask -TaskName AlienSpeechBridge

    제거:
        Unregister-ScheduledTask -TaskName AlienSpeechBridge -Confirm:$false

.PARAMETER PythonExe
    사용할 python 경로. 비우면 venv 자동 탐지 → PATH 의 python.

.PARAMETER WorkDir
    작업 디렉토리. 기본: 이 스크립트의 상위(automation/alien-speech).

.PARAMETER TaskName
    스케줄러 이름. 기본 AlienSpeechBridge.
#>

param(
    [string]$PythonExe,
    [string]$WorkDir,
    [string]$TaskName = "AlienSpeechBridge"
)

$ErrorActionPreference = "Stop"

if (-not $WorkDir -or $WorkDir.Trim() -eq "") {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $WorkDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
}

if (-not $PythonExe -or $PythonExe.Trim() -eq "") {
    $venvPython = Join-Path $WorkDir ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $PythonExe = $venvPython
    } else {
        $cmd = Get-Command python -ErrorAction SilentlyContinue
        if ($null -eq $cmd) {
            throw "python 을 찾지 못했습니다. -PythonExe 로 명시하거나 venv 생성 후 재실행."
        }
        $PythonExe = $cmd.Source
    }
}

if (-not (Test-Path $WorkDir)) {
    throw "WorkDir 없음: $WorkDir"
}
if (-not (Test-Path $PythonExe)) {
    throw "PythonExe 없음: $PythonExe"
}

Write-Host "Alien Speech 브릿지 Task Scheduler 등록"
Write-Host "  Task     : $TaskName"
Write-Host "  Python   : $PythonExe"
Write-Host "  WorkDir  : $WorkDir"

$action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "-m bridge" `
    -WorkingDirectory $WorkDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT1M"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0)

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Alien Speech 브릿지 — Pala Memo → Alien Plan (ALI-92)"

Write-Host "등록 완료. 다음 부팅 시 자동 시작."
Write-Host "지금 한번 시작하려면: Start-ScheduledTask -TaskName $TaskName"
