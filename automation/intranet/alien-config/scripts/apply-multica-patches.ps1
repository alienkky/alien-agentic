# Apply Multica UI patches and rebuild the web container.
# ASCII-only so PowerShell 5.1 cp949 does not garble.
#
# Usage (from anywhere):
#   E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\apply-multica-patches.ps1
#
# What it does:
#   1. cd into multica/
#   2. git checkout . (reset working tree so patches apply on a clean base)
#   3. git apply 03-sticky-comment-input.patch
#   4. git apply 04-scroll-to-bottom-button.patch
#   5. docker compose up -d --build web

$ErrorActionPreference = "Stop"

$repo    = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$patches = Join-Path $repo "automation\intranet\alien-config\patches"
$multica = Join-Path $repo "automation\intranet\multica"

if (-not (Test-Path $multica)) {
    Write-Error "multica folder not found at: $multica"
    exit 1
}

Write-Host "[1/3] Reset multica working tree"
Set-Location $multica
git checkout .
if ($LASTEXITCODE -ne 0) { Write-Error "git checkout failed"; exit 1 }

Write-Host "[2/3] Apply UI patches"
$patchFiles = @(
    "03-sticky-comment-input.patch",
    "04-scroll-to-bottom-button.patch"
)
foreach ($name in $patchFiles) {
    $full = Join-Path $patches $name
    if (-not (Test-Path $full)) {
        Write-Error "Patch not found: $full"
        exit 1
    }
    Write-Host "      $name"
    git apply $full
    if ($LASTEXITCODE -ne 0) {
        Write-Error "git apply failed on $name. Possibly already applied — try 'git checkout .' then rerun."
        exit 1
    }
}

Write-Host "[3/3] Rebuild web container"
docker compose -f docker-compose.selfhost.yml up -d --build web
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. Refresh http://localhost:3000 — scroll up >300px in an issue to see the button."
