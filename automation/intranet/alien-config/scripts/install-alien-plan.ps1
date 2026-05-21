# Install Alien Plan into Multica (native page + sidebar), then rebuild the
# web container WITH the build override so the image matches what
# autostart-serve.ps1 launches at next logon.

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$multica = Join-Path $repo "automation\intranet\multica"
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script  = Join-Path $PSScriptRoot "install-alien-plan.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}

Write-Host "[1/2] Install Alien Plan ($py)"
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
Write-Host "DONE. Refresh http://localhost:3000 — 'Alien Plan' appears at the top of the sidebar."
