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
Write-Host "[2/2] Rebuild web container"
docker compose -f docker-compose.selfhost.yml up -d --build web
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. Refresh http://localhost:3000 — scroll up >300px in an issue to see the button."
