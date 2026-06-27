# Obsidian Vault 부트스트랩 — shared-memory/ 를 AI 양방향 기억 Vault 로.
# Obsidian 앱이 없으면 winget 으로 설치 안내.

$ErrorActionPreference = "Stop"

$repo   = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$venvPy = Join-Path $repo "automation\cli\.venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "setup-obsidian-vault.py"

if (Test-Path $venvPy) { $py = $venvPy } else { $py = "python" }

# 1) Vault 부트스트랩 (설정·템플릿·MOC)
& $py $script
if ($LASTEXITCODE -ne 0) { Write-Error "Vault 부트스트랩 실패"; exit 1 }

# 2) Obsidian 앱 설치 확인 (없으면 winget 안내)
Write-Host ""
$obsidian = Get-Command obsidian -ErrorAction SilentlyContinue
$obsidianInstalled = $obsidian -or (Test-Path "$env:LOCALAPPDATA\Obsidian\Obsidian.exe")
if ($obsidianInstalled) {
    Write-Host "Obsidian 앱 설치됨 -- OK"
} else {
    Write-Host "Obsidian 앱 미설치. 설치 방법:"
    Write-Host "  winget install -e --id Obsidian.Obsidian"
    Write-Host "  또는 https://obsidian.md/download 에서 다운로드"
    Write-Host ""
    $ans = Read-Host "지금 winget 으로 설치할까요? (y/N)"
    if ($ans -eq "y" -or $ans -eq "Y") {
        winget install -e --id Obsidian.Obsidian
    }
}

Write-Host ""
Write-Host "Vault 경로 (Obsidian 에서 '폴더를 보관함으로 열기'):"
Write-Host "  $repo\shared-memory"
