# Direct in-place fix for the "scroll to bottom" button overlapping the
# comment input. The 04 patch is already applied to the live file in
# multica/, so we bypass git apply and just swap the one Tailwind class
# that controls vertical position: bottom-14 (56px) -> bottom-24 (96px).
#
# Idempotent: detects if already at bottom-24 and skips the write.
# ASCII-only so PowerShell 5.1 cp949 does not garble.
#
# Usage (from anywhere):
#   E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\fix-button-position.ps1

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$file = Join-Path $repo "automation\intranet\multica\packages\views\issues\components\issue-detail.tsx"

if (-not (Test-Path $file)) {
    Write-Error "issue-detail.tsx not found at: $file"
    exit 1
}

$old = "sticky bottom-14 z-20"
$new = "sticky bottom-24 z-20"

$bytes = [System.IO.File]::ReadAllBytes($file)
$text  = [System.Text.Encoding]::UTF8.GetString($bytes)

if ($text.Contains($new)) {
    Write-Host "[1/2] Already at bottom-24. No file edit needed."
} elseif ($text.Contains($old)) {
    $patched = $text.Replace($old, $new)
    $enc = New-Object System.Text.UTF8Encoding($false)   # no BOM
    [System.IO.File]::WriteAllText($file, $patched, $enc)
    Write-Host "[1/2] Replaced '$old' -> '$new'"
} else {
    Write-Error "Neither 'bottom-14' nor 'bottom-24' found in issue-detail.tsx. The 04 patch may not be applied — investigate the file state manually."
    exit 1
}

Set-Location (Join-Path $repo "automation\intranet\multica")
Write-Host "[2/2] Rebuilding web container (docker compose up -d --build web)..."
docker compose -f docker-compose.selfhost.yml up -d --build web
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE. Refresh http://localhost:3000. The button should sit ~40px higher above the comment input."
