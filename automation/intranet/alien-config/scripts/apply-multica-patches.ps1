# Apply Multica UI + backend patches and rebuild containers.
# ASCII-only so PowerShell 5.1 cp949 does not garble.
#
# Usage (from anywhere):
#   E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\apply-multica-patches.ps1
#
# What it does:
#   1. cd into multica/
#   2. git checkout . (reset working tree so patches apply on a clean base)
#   3. git apply 04-scroll-to-bottom-button.patch (UI: sticky input + scroll-to-bottom button)
#   4. git apply 05-ollama-provider.patch          (backend: ollama agent provider on 4090 LLMs)
#   5. docker compose up -d --build web server     (web for UI patch, server for ollama)

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

Write-Host "[2/4] Apply UI patch (04 only — it is a superset of 03)"
# 04-scroll-to-bottom-button.patch already contains 03's sticky-comment-input
# changes (both rewrite the same <div className=mt-4> line). Applying 03 then
# 04 always fails on a clean tree; we apply only 04 with --3way so a small
# upstream drift can still merge cleanly.
$uiPatch = "04-scroll-to-bottom-button.patch"
$uiPatchFull = Join-Path $patches $uiPatch
if (-not (Test-Path $uiPatchFull)) {
    Write-Error "Patch not found: $uiPatchFull"
    exit 1
}
Write-Host "      $uiPatch"
git apply --3way $uiPatchFull
if ($LASTEXITCODE -ne 0) {
    Write-Error "git apply failed on $uiPatch. If the file already contains showScrollToBottom, run fix-button-position.ps1 instead."
    exit 1
}

Write-Host "[3/4] Apply backend patch (05 ollama provider)"
# 05-ollama-provider.patch adds a new server/pkg/agent/ollama.go (HTTP backend
# for 4090 local open LLMs) and registers it in agent.go + models.go. Pure
# additive, so --3way drift handling is straightforward.
$serverPatch = "05-ollama-provider.patch"
$serverPatchFull = Join-Path $patches $serverPatch
if (-not (Test-Path $serverPatchFull)) {
    Write-Error "Patch not found: $serverPatchFull"
    exit 1
}
Write-Host "      $serverPatch"
git apply --3way $serverPatchFull
if ($LASTEXITCODE -ne 0) {
    Write-Error "git apply failed on $serverPatch. Inspect with: git apply --reject ..\alien-config\patches\$serverPatch"
    exit 1
}

Write-Host "[4/4] Rebuild web + server containers"
# web for UI patch, server for ollama backend. Build override is required so
# the customised images (multica-*:dev) are used, not the prebuilt defaults
# (would silently drop both patches). See CLAUDE.md "Multica 빌드 진입점".
$composeArgs = @("-f", "docker-compose.selfhost.yml")
if (Test-Path "docker-compose.selfhost.build.yml") {
    $composeArgs += @("-f", "docker-compose.selfhost.build.yml")
}
$composeArgs += @("up", "-d", "--build", "web", "server")
docker compose @composeArgs
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose failed"; exit 1 }

Write-Host ""
Write-Host "DONE."
Write-Host "  - UI:     scroll up >300px in an issue to see the button."
Write-Host "  - Ollama: create an agent with runtime_config.provider='ollama' to use 4090 LLMs."
Write-Host "            Default URL http://localhost:11434 (override via OLLAMA_URL on the daemon)."
