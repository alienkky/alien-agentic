# setup-caddy.ps1 — Multica HTTPS 종결을 tailscale serve 에서 Caddy 로 교체.
#
# 배경: tailscale serve 가 WebSocket Upgrade 를 forward 못 해 Multica 실시간 푸시가
#       죽는 사고(2026-05-27). Caddy 가 WS native 프록시 + Tailscale cert 직접 사용.
#
# 1회 실행. 인증서 만료 갱신은 refresh-tailscale-cert.ps1 이 주간 처리.
# 관리자 PowerShell 권장 — Task Scheduler 등록을 위해.

$ErrorActionPreference = "Stop"

$repo      = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$caddyDir  = Join-Path $repo "automation\intranet\alien-config\caddy"
$certDir   = Join-Path $caddyDir "certs"
$logDir    = Join-Path $caddyDir "logs"
$caddyExe  = Join-Path $caddyDir "caddy.exe"
$template  = Join-Path $caddyDir "Caddyfile.template"
$caddyfile = Join-Path $caddyDir "Caddyfile"
$envFile   = Join-Path $caddyDir ".env"

Write-Host ""
Write-Host "========== Alien Agentic — Caddy 셋업 =========="
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 1. 디렉토리 보장
# ─────────────────────────────────────────────────────────────
if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir -Force | Out-Null }
if (-not (Test-Path $logDir))  { New-Item -ItemType Directory -Path $logDir  -Force | Out-Null }

# ─────────────────────────────────────────────────────────────
# 2. caddy.exe 확보
# ─────────────────────────────────────────────────────────────
if (-not (Test-Path $caddyExe)) {
    Write-Host "[1/7] caddy.exe 없음 — 다운로드 시도..."
    $caddyUrl = "https://caddyserver.com/api/download?os=windows&arch=amd64"
    try {
        Invoke-WebRequest -Uri $caddyUrl -OutFile $caddyExe -UseBasicParsing
        Write-Host "      OK: $caddyExe ($([math]::Round((Get-Item $caddyExe).Length / 1MB, 1)) MB)"
    } catch {
        Write-Error @"
caddy.exe 자동 다운로드 실패. 수동 다운로드:
  https://caddyserver.com/download (windows/amd64)
  다운로드한 caddy.exe 를 다음 경로에 두세요:
    $caddyExe
다시 setup-caddy.ps1 실행.
"@
        exit 1
    }
} else {
    Write-Host "[1/7] caddy.exe 존재 — 스킵"
}

# 버전 확인
$caddyVersion = & $caddyExe version 2>&1
Write-Host "      Caddy: $caddyVersion"

# ─────────────────────────────────────────────────────────────
# 3. Tailscale IP + hostname 추출
# ─────────────────────────────────────────────────────────────
Write-Host "[2/7] Tailscale 정보 추출..."

$tsCmd = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $tsCmd) {
    Write-Error "tailscale CLI 없음. https://tailscale.com/download/windows 설치 후 재시도."
    exit 1
}

$tsIP = (tailscale ip --4 2>&1 | Select-Object -First 1).Trim()
if ($tsIP -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
    Write-Error "Tailscale IP 추출 실패: '$tsIP'. 'tailscale up' 먼저 실행했는지 확인."
    exit 1
}

$tsStatus = tailscale status --json | ConvertFrom-Json
$tsHost = $tsStatus.Self.DNSName.TrimEnd('.')
if (-not $tsHost) {
    Write-Error "Tailscale hostname 추출 실패. tailscale 관리 콘솔에서 MagicDNS 활성화 확인."
    exit 1
}

Write-Host "      IP:   $tsIP"
Write-Host "      Host: $tsHost"

# ─────────────────────────────────────────────────────────────
# 4. Tailscale cert 발급
# ─────────────────────────────────────────────────────────────
Write-Host "[3/7] Tailscale 인증서 발급..."

$certCrt = Join-Path $certDir "$tsHost.crt"
$certKey = Join-Path $certDir "$tsHost.key"

Push-Location $certDir
try {
    # tailscale cert 는 현재 디렉토리에 <host>.crt, <host>.key 를 만든다
    tailscale cert $tsHost 2>&1 | ForEach-Object { Write-Host "      $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Error @"
tailscale cert 실패. 다음 확인:
  - Tailscale 관리 콘솔 → DNS → 'Enable HTTPS' 가 켜져 있는가
    (https://login.tailscale.com/admin/dns)
  - 이 머신이 tailnet 에 로그인되어 있는가 (tailscale status)
"@
        exit 1
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $certCrt)) {
    Write-Error "인증서 파일 생성 안됨: $certCrt"
    exit 1
}
Write-Host "      OK: $certCrt"

# ─────────────────────────────────────────────────────────────
# 5. Caddyfile 생성 (템플릿 치환)
# ─────────────────────────────────────────────────────────────
Write-Host "[4/7] Caddyfile 생성..."

if (-not (Test-Path $template)) {
    Write-Error "템플릿 없음: $template"
    exit 1
}

# 경로는 Caddy 가 forward slash 를 선호 — Windows 경로 변환
$certDirFwd = $certDir.Replace('\', '/')
$logDirFwd  = $logDir.Replace('\', '/')

$content = Get-Content $template -Raw
$content = $content -replace '\{\{HOST\}\}',          $tsHost
$content = $content -replace '\{\{TAILSCALE_IP\}\}',  $tsIP
$content = $content -replace '\{\{CERT_DIR\}\}',      $certDirFwd
$content = $content -replace '\{\{LOG_DIR\}\}',       $logDirFwd

# UTF-8 (BOM 없이) — Caddy 가 BOM 을 못 읽음
[System.IO.File]::WriteAllText($caddyfile, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "      OK: $caddyfile"

# Caddyfile 검증
$validation = & $caddyExe validate --config $caddyfile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error @"
Caddyfile 검증 실패:
$validation
"@
    exit 1
}
Write-Host "      validate: OK"

# .env 저장 (refresh-tailscale-cert.ps1 가 hostname 알아야 함)
@"
TAILSCALE_IP=$tsIP
TAILSCALE_HOST=$tsHost
CADDY_DIR=$caddyDir
CERT_DIR=$certDir
"@ | Out-File -FilePath $envFile -Encoding utf8 -Force

# ─────────────────────────────────────────────────────────────
# 6. tailscale serve 해제 (443 점유 풀기)
# ─────────────────────────────────────────────────────────────
Write-Host "[5/7] tailscale serve 해제 (443 점유 풀기)..."
tailscale serve reset 2>&1 | ForEach-Object { Write-Host "      $_" }

# 자동시작 스크립트의 tailscale serve 줄을 막아둔다 (이미 patch 됐을 수도)
$autostart = Join-Path $PSScriptRoot "autostart-serve.ps1"
if (Test-Path $autostart) {
    $autostartContent = Get-Content $autostart -Raw
    if ($autostartContent -match 'tailscale serve --bg --https=443') {
        Write-Warning "autostart-serve.ps1 에 아직 'tailscale serve --https=443' 호출이 남아 있음."
        Write-Warning "이 PR 의 autostart-serve.ps1 패치를 함께 배포하세요 (이미 했다면 무시)."
    }
}

# ─────────────────────────────────────────────────────────────
# 7. Task Scheduler 등록
# ─────────────────────────────────────────────────────────────
Write-Host "[6/7] Task Scheduler 등록..."

$runCaddy   = Join-Path $PSScriptRoot "run-caddy.ps1"
$refreshScr = Join-Path $PSScriptRoot "refresh-tailscale-cert.ps1"

# (a) AlienAgentic-Caddy — 로그온 시 Caddy 가동
$caddyTaskName = "AlienAgentic-Caddy"
Unregister-ScheduledTask -TaskName $caddyTaskName -Confirm:$false -ErrorAction SilentlyContinue

$caddyAction  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runCaddy`""
$caddyTrigger = New-ScheduledTaskTrigger -AtLogOn
$caddyTrigger.Delay = "PT30S"   # 30초 지연 — Tailscale 준비 시간
$caddySettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask `
    -TaskName $caddyTaskName `
    -Action $caddyAction `
    -Trigger $caddyTrigger `
    -Settings $caddySettings `
    -Description "Alien Agentic — Caddy reverse proxy (Multica HTTPS + WS)" `
    -RunLevel Highest `
    -Force | Out-Null
Write-Host "      등록: $caddyTaskName (로그온 +30초)"

# (b) AlienAgentic-CertRefresh — 매주 일요일 03:00
$certTaskName = "AlienAgentic-CertRefresh"
Unregister-ScheduledTask -TaskName $certTaskName -Confirm:$false -ErrorAction SilentlyContinue

$certAction  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$refreshScr`""
$certTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 03:00
$certSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable
Register-ScheduledTask `
    -TaskName $certTaskName `
    -Action $certAction `
    -Trigger $certTrigger `
    -Settings $certSettings `
    -Description "Alien Agentic — Tailscale cert 30일 이하 남으면 갱신" `
    -RunLevel Highest `
    -Force | Out-Null
Write-Host "      등록: $certTaskName (매주 일 03:00)"

# ─────────────────────────────────────────────────────────────
# 8. Caddy 즉시 가동
# ─────────────────────────────────────────────────────────────
Write-Host "[7/7] Caddy 가동..."
Start-ScheduledTask -TaskName $caddyTaskName
Start-Sleep -Seconds 3

$caddyProc = Get-Process caddy -ErrorAction SilentlyContinue
if ($caddyProc) {
    Write-Host "      PID $($caddyProc.Id) 가동 중"
} else {
    Write-Warning "Caddy 프로세스 미확인. logs/access.log 와 Task Scheduler 'AlienAgentic-Caddy' 마지막 실행 결과 확인."
}

# ─────────────────────────────────────────────────────────────
# 완료
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================================="
Write-Host "DONE. Caddy 셋업 완료."
Write-Host ""
Write-Host "검증:"
Write-Host "  1. 브라우저 → https://$tsHost"
Write-Host "  2. F12 → 네트워크 → 'ws?' 항목 → 응답 헤더 '101 Switching Protocols'"
Write-Host "  3. 받은함 카운팅·에이전트 상태가 새로고침 없이 자동 갱신되는지"
Write-Host ""
Write-Host "롤백 (Caddy 깨졌을 때):"
Write-Host "  Stop-ScheduledTask -TaskName 'AlienAgentic-Caddy'"
Write-Host "  Get-Process caddy | Stop-Process -Force"
Write-Host "  tailscale serve --bg --https=443 http://localhost:3000"
Write-Host "=========================================================="
