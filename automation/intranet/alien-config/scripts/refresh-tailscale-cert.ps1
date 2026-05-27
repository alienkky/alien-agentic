# refresh-tailscale-cert.ps1 -- Tailscale 인증서 30일 이하 남으면 갱신.
# AlienAgentic-CertRefresh Task 가 매주 일요일 03:00 호출.
# 갱신 후 Caddy 가 새 인증서를 자동 리로드한다 (Caddy 는 디스크 변경 감지).

$ErrorActionPreference = "Continue"

$repo     = "e:\AlienAgentic\alien-agentic"
$caddyDir = Join-Path $repo "automation\intranet\alien-config\caddy"
$envFile  = Join-Path $caddyDir ".env"
$certDir  = Join-Path $caddyDir "certs"

$logDir = Join-Path $repo "shared-memory\daily-logs\_scheduled"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir ("aa-cert-refresh-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

"=== {0} cert-refresh start ===" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") |
    Out-File -FilePath $log -Append -Encoding utf8

# .env 에서 hostname 읽기
if (-not (Test-Path $envFile)) {
    "ERROR: .env 없음 -- setup-caddy.ps1 먼저 실행" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}

$tsHost = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^TAILSCALE_HOST=(.+)$') { $tsHost = $matches[1].Trim() }
}
if (-not $tsHost) {
    "ERROR: TAILSCALE_HOST 키 없음 in .env" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}

$certCrt = Join-Path $certDir "$tsHost.crt"
if (-not (Test-Path $certCrt)) {
    "WARN: 기존 인증서 없음 → 신규 발급 시도" | Out-File -FilePath $log -Append -Encoding utf8
    $needsRenew = $true
} else {
    # X509 cert 의 NotAfter 확인
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $certCrt
    $daysLeft = ($cert.NotAfter - (Get-Date)).Days
    "현재 인증서 만료: $($cert.NotAfter) ($daysLeft 일 남음)" |
        Out-File -FilePath $log -Append -Encoding utf8

    if ($daysLeft -gt 30) {
        "30일 초과 -- 갱신 스킵" | Out-File -FilePath $log -Append -Encoding utf8
        "=== exit 0 ===" | Out-File -FilePath $log -Append -Encoding utf8
        exit 0
    }
    $needsRenew = $true
}

if ($needsRenew) {
    "tailscale cert 발급 시도..." | Out-File -FilePath $log -Append -Encoding utf8
    Push-Location $certDir
    try {
        tailscale cert $tsHost 2>&1 | ForEach-Object {
            $_ | Out-File -FilePath $log -Append -Encoding utf8
        }
        if ($LASTEXITCODE -eq 0) {
            "갱신 성공 -- Caddy 가 디스크 변경 감지해 자동 리로드" |
                Out-File -FilePath $log -Append -Encoding utf8
        } else {
            "갱신 실패 (exit $LASTEXITCODE) -- 다음 주 재시도" |
                Out-File -FilePath $log -Append -Encoding utf8
        }
    } finally {
        Pop-Location
    }
}

"=== exit {0} ===" -f $LASTEXITCODE | Out-File -FilePath $log -Append -Encoding utf8
