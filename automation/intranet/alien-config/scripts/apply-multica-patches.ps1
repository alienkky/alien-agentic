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

Write-Host "[2/3] Apply UI patch (04 only — it is a superset of 03)"
# 04-scroll-to-bottom-button.patch already contains 03's sticky-comment-input
# changes (both rewrite the same <div className=mt-4> line). Applying 03 then
# 04 always fails on a clean tree; we apply only 04 with --3way so a small
# upstream drift can still merge cleanly.
$patchName = "04-scroll-to-bottom-button.patch"
$patchFull = Join-Path $patches $patchName
if (-not (Test-Path $patchFull)) {
    Write-Error "Patch not found: $patchFull"
    exit 1
}
Write-Host "      $patchName"
git apply --3way $patchFull
if ($LASTEXITCODE -ne 0) {
    Write-Error "git apply failed on $patchName. If the file already contains showScrollToBottom, run fix-button-position.ps1 instead."
    exit 1
}

Write-Host "[3/3] Rebuild web container"
docker compose -f docker-compose.selfhost.yml up -d --build web
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. Refresh http://localhost:3000 — scroll up >300px in an issue to see the button."
