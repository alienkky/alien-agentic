# Install Alien Memory (외계인 메모리) into Multica -- native page + sidebar.
# 그 다음 build override 와 함께 web 컨테이너 재빌드.

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$multica = Join-Path $repo "automation\intranet\multica"
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script  = Join-Path $PSScriptRoot "install-alien-memory.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}

Write-Host "[1/2] Install Alien Memory ($py)"
& $py $script
if ($LASTEXITCODE -ne 0) {
    Write-Error "Installer reported failures. Aborting before docker rebuild."
    exit 1
}

if (-not (Test-Path $multica)) {
    Write-Error "multica folder not found at: $multica"
    exit 1
}

Set-Location $multica
Write-Host ""
Write-Host "[2/2] Rebuild containers with build override (matches autostart-serve.ps1)"
$composeArgs = @("-f", "docker-compose.selfhost.yml")
if (Test-Path "docker-compose.selfhost.build.yml") {
    $composeArgs += @("-f", "docker-compose.selfhost.build.yml")
    Write-Host "      using build override: docker-compose.selfhost.build.yml"
}
$composeArgs += @("up", "-d", "--build")
docker compose @composeArgs
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. https://<tailnet>/<workspaceSlug>/alien-memory -- 사이드바 'Brain' 아이콘"
Write-Host "      (Caddyfile 의 /api/alien-memory 라우팅 + memory-api sidecar 도 가동 필요)"
