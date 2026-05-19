# Wrapper: run the Python in-place editor (handles UTF-8 + Korean cleanly),
# then rebuild the web container. ASCII-only so PS 5.1 cp949 stays safe.
#
# Use this when 'git apply' fails because upstream Multica drifted past the
# patch base. The Python script anchors on unique strings, so line numbers
# can move freely.

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$multica = Join-Path $repo "automation\intranet\multica"
$venvPy  = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script  = Join-Path $PSScriptRoot "fix-issue-detail-inline.py"

# Prefer venv Python (UTF-8 + already on disk). Fall back to PATH 'python'.
if (Test-Path $venvPy) {
    $py = $venvPy
} else {
    $py = "python"
}

if (-not (Test-Path $script)) {
    Write-Error "Python script not found: $script"
    exit 1
}

Write-Host "[1/2] Run inline editor ($py)"
& $py $script
if ($LASTEXITCODE -ne 0) {
    Write-Error "Inline editor reported failures. Aborting before docker rebuild."
    exit 1
}

if (-not (Test-Path $multica)) {
    Write-Error "multica folder not found at: $multica"
    exit 1
}

Set-Location $multica
Write-Host ""
Write-Host "[2/2] Rebuild containers with build override (matches autostart-serve.ps1)"
# autostart-serve.ps1 launches `docker compose -f selfhost.yml -f selfhost.build.yml up -d`.
# If we build without the .build.yml override here, autostart later starts a
# different (older) image that does not contain our edits. Use the override
# when it exists so the image our script builds is the same one autostart
# launches at next logon. --build forces a fresh layer even if cached.
$composeArgs = @("-f", "docker-compose.selfhost.yml")
if (Test-Path "docker-compose.selfhost.build.yml") {
    $composeArgs += @("-f", "docker-compose.selfhost.build.yml")
    Write-Host "      using build override: docker-compose.selfhost.build.yml"
} else {
    Write-Host "      no build override found; using selfhost.yml only"
}
$composeArgs += @("up", "-d", "--build")
docker compose @composeArgs
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. Refresh http://localhost:3000 — scroll up >300px in an issue to see the button."
Write-Host "Note: on next logon, autostart-serve.ps1 will start the SAME image just built."
