# update-multica.ps1 — Multica 안전 업데이트 오케스트레이터.
#
# 원본 Multica 를 새 버전으로 올리면서 우리 커스터마이즈를 재적용한다.
# 전략 문서: docs/guides/multica-update-strategy.md
#
# 흐름: 백업 → working tree 리셋 → 업스트림 pull → setup-multica.ps1(패치 재적용
#       + 빌드) → 검증 체크리스트.
#
# 사용:
#   .\update-multica.ps1                 # main 브랜치로 업데이트
#   .\update-multica.ps1 -Ref v1.2.3     # 특정 태그로
#   .\update-multica.ps1 -DryRun         # 백업·진단만, 실제 변경 X

param(
    [string]$Ref = "main",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repo      = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$multica   = Join-Path $repo "automation\intranet\multica"
$backupDir = Join-Path $repo "automation\intranet\alien-config\_backup"
$setupMulti = Join-Path $PSScriptRoot "setup-multica.ps1"

if (-not (Test-Path $multica)) {
    Write-Error "multica 폴더 없음: $multica  -- 먼저 clone 하세요."
    exit 1
}
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host ""
Write-Host "========== Multica 안전 업데이트 =========="
Write-Host "  대상 ref : $Ref"
Write-Host "  DryRun   : $DryRun"
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 1. 현재 상태 백업
# ─────────────────────────────────────────────────────────────
Write-Host "[1/5] 현재 상태 백업..."
Push-Location $multica
try {
    $beforeCommit = (git log --oneline -1) 2>&1
    $diffPatch = Join-Path $backupDir "multica-before-$stamp.patch"
    git diff > $diffPatch
    $verFile = Join-Path $backupDir "multica-version-$stamp.txt"
    "ref before: $beforeCommit" | Out-File $verFile -Encoding utf8
    (docker images multica-backend:dev --format "{{.ID}} {{.CreatedSince}}") 2>&1 |
        Out-File $verFile -Append -Encoding utf8
    $diffSize = (Get-Item $diffPatch).Length
    Write-Host "      현재 커밋  : $beforeCommit"
    Write-Host "      diff 백업  : $diffPatch ($diffSize bytes)"
    Write-Host "      버전 기록  : $verFile"
} finally {
    Pop-Location
}
Write-Host ""

if ($DryRun) {
    Write-Host "[DryRun] 여기서 멈춤. 실제 업데이트는 -DryRun 빼고 재실행."
    Write-Host ""
    Write-Host "업데이트 전 권장: https://multica.ai/changelog 에서 다음 영역 변경 확인:"
    Write-Host "  - i18n/types.ts (SupportedLocale)   ← 한국어화 패치"
    Write-Host "  - app-sidebar.tsx (NavKey 등)       ← Alien Plan/Memory 패치"
    Write-Host "  - issue-detail.tsx                  ← 인라인 편집기 패치"
    Write-Host "  - server/pkg/agent/models.go        ← Claude 4.8 패치"
    exit 0
}

# ─────────────────────────────────────────────────────────────
# 2. 사용자 확인
# ─────────────────────────────────────────────────────────────
Write-Host "[2/5] 확인"
Write-Host "  working tree 를 리셋하고 '$Ref' 로 업데이트합니다."
Write-Host "  우리 커스터마이즈는 setup-multica.ps1 가 재적용합니다."
$ans = Read-Host "  계속할까요? (yes/N)"
if ($ans -ne "yes") {
    Write-Host "중단됨. 백업은 보존됨: $backupDir"
    exit 0
}
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 3. 업스트림 가져오기
# ─────────────────────────────────────────────────────────────
Write-Host "[3/5] 업스트림 pull..."
Push-Location $multica
try {
    # working tree 리셋 (우리 패치는 스크립트로 재생성되므로 버려도 안전)
    git checkout . 2>&1 | ForEach-Object { Write-Host "      $_" }
    # 우리가 복사한 자립 폴더 제거 (업스트림에 없는 것)
    git clean -fd packages/views/alien-plan packages/views/alien-memory 2>&1 |
        ForEach-Object { Write-Host "      $_" }

    git fetch origin 2>&1 | ForEach-Object { Write-Host "      $_" }
    git pull origin $Ref 2>&1 | ForEach-Object { Write-Host "      $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "git pull 실패. 백업으로 롤백 가능: $backupDir"
        exit 1
    }
    $afterCommit = (git log --oneline -1) 2>&1
    Write-Host "      새 커밋: $afterCommit"
} finally {
    Pop-Location
}
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 4. 우리 커스터마이즈 재적용 + 빌드
# ─────────────────────────────────────────────────────────────
Write-Host "[4/5] 커스터마이즈 재적용 (setup-multica.ps1)..."
Write-Host "      패치 실패 시 즉시 멈춥니다 -- 어떤 앵커가 깨졌는지 위에 표시됨."
Write-Host ""
& $setupMulti
$setupExit = $LASTEXITCODE
if ($setupExit -ne 0) {
    Write-Host ""
    Write-Error @"
setup-multica.ps1 실패 (exit $setupExit).
업스트림이 앵커 줄을 바꿔 패치가 깨졌을 가능성.

수선:
  1. 위 출력에서 'FAIL (앵커 없음)' 패치 확인
  2. docs/guides/multica-update-strategy.md 의 4단계(깨진 패치 수선) 참조
  3. 해당 패치 스크립트의 anchor 를 새 코드에 맞게 수정 → setup-multica.ps1 재실행

롤백 (이전 버전으로):
  cd $multica
  git checkout (백업의 ref before -- $backupDir 의 version 파일 참조)
  .\..\alien-config\scripts\setup-multica.ps1
"@
    exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────
# 5. 검증 안내
# ─────────────────────────────────────────────────────────────
Write-Host "[5/5] 검증"
Write-Host ""
docker ps --filter "name=multica" --format "table {{.Names}}`t{{.Status}}"
Write-Host ""
Write-Host "=========================================================="
Write-Host "DONE. 브라우저에서 확인:"
Write-Host "  [ ] 한국어 UI (사이드바·설정)"
Write-Host "  [ ] 사이드바 Alien Plan · Alien Memory"
Write-Host "  [ ] 설정 → 언어 → 한국어 옵션"
Write-Host "  [ ] 모델 picker → Claude Opus 4.8"
Write-Host "  [ ] 이슈 상세 인라인 편집기 + '맨 아래로' 버튼"
Write-Host "  [ ] 실시간 푸시 (받은함 카운팅 자동)"
Write-Host ""
Write-Host "문제 시 롤백: $backupDir 의 version 파일 참조"
Write-Host "=========================================================="
