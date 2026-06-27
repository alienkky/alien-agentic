# backup-multica-daily.ps1 — Multica DB + usage 매일 자동 백업 (재발 방지)
#
# 배경 (2026-06-26 84GB 삭제 사고): Docker vhdx 가 삭제되면 multica DB(이슈·
# 코멘트·작업 이력)가 통째로 사라진다. usage JSONL 도 git 커밋 안 하면 vhdx 와
# 함께 날아간다. 이 스크립트는 *매일* 다음을 백업해 그 사고를 영구 차단한다:
#
#   1. multica postgres DB 전체  → pg_dump (E:\AlienAgentic\backups\multica-db\)
#   2. usage JSONL 전부          → git add + commit + push
#   3. shared-memory 전체        → git add + commit + push
#   4. 백업 7일분 보관 (오래된 건 자동 삭제)
#
# 핵심 원칙: vhdx 와 *무관한 자리*(E드라이브 파일 + GitHub) 에 둔다. Docker 가
# 통째로 날아가도 어제까지의 데이터는 항상 복원 가능.
#
# 사용:
#   .\backup-multica-daily.ps1            # 즉시 백업
#   .\backup-multica-daily.ps1 -DbOnly    # DB 만 (git push 생략)
#
# 자동화: Windows 작업 스케줄러에 매일 03:00 등록 (아래 register 블록 주석 참조)

param(
    [switch]$DbOnly,
    [int]$KeepDays = 7
)

$ErrorActionPreference = "Continue"

$repo      = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$backupDir = Join-Path $repo "backups\multica-db"
$pgContainer = "multica-postgres-1"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host ""
Write-Host "========== Multica 일일 백업 ($stamp) ==========" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────
# 1. multica postgres DB 전체 dump
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] multica DB dump..." -ForegroundColor Yellow

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }

# 컨테이너 살아있나 확인
$alive = docker ps --filter "name=$pgContainer" --format "{{.Names}}" 2>$null
if ($alive -ne $pgContainer) {
    Write-Host "  ⚠️ $pgContainer 안 돎 — DB 백업 건너뜀 (multica 가동 후 재시도)" -ForegroundColor Red
} else {
    $dumpFile = Join-Path $backupDir "multica-$stamp.sql.gz"
    # pg_dump 를 컨테이너 안에서 실행 → gzip 압축해서 호스트로
    # (EAP=Continue + $LASTEXITCODE 패턴 — git stderr 함정 회피와 동일)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker exec $pgContainer sh -c "pg_dump -U multica -d multica | gzip" > $dumpFile 2>$null
    $dumpExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    if ($dumpExit -eq 0 -and (Test-Path $dumpFile)) {
        $sizeMB = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
        Write-Host "  OK — $dumpFile ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ pg_dump 실패 (exit $dumpExit)" -ForegroundColor Red
        if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force }  # 빈 파일 정리
    }
}

# ─────────────────────────────────────────────────────────────
# 2. 오래된 백업 정리 (KeepDays 일분만 보관)
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] 오래된 백업 정리 ($KeepDays 일분 보관)..." -ForegroundColor Yellow
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem $backupDir -Filter "multica-*.sql.gz" -ErrorAction SilentlyContinue |
       Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old) {
    $old | ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "  삭제: $($_.Name)" }
} else {
    Write-Host "  정리할 오래된 백업 없음" -ForegroundColor Green
}

if ($DbOnly) {
    Write-Host ""
    Write-Host "[DbOnly] DB 백업만 완료. git push 생략." -ForegroundColor Cyan
    exit 0
}

# ─────────────────────────────────────────────────────────────
# 3. usage JSONL + shared-memory → git
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] usage + shared-memory git 백업..." -ForegroundColor Yellow
Push-Location $repo
try {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    # usage JSONL + shared-memory 변경분 스테이징 (DB dump 는 .gitignore 로 제외 — 용량 큼)
    (git add "shared-memory/usage/" "shared-memory/" 2>&1) | Out-String | ForEach-Object { Write-Host "      $_" }

    # 변경 있을 때만 커밋
    $status = git status --porcelain shared-memory/ 2>$null
    if ($status) {
        $today = Get-Date -Format "yyyy-MM-dd"
        (git commit -m "🔒 일일 백업: usage + shared-memory ($today)" 2>&1) |
            Out-String | ForEach-Object { Write-Host "      $_" }

        $branch = (git branch --show-current 2>$null)
        (git push origin $branch 2>&1) | Out-String | ForEach-Object { Write-Host "      $_" }
        $pushExit = $LASTEXITCODE
        if ($pushExit -eq 0) {
            Write-Host "  git push OK ($branch)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ git push 실패 (exit $pushExit) — 네트워크 확인. 커밋은 로컬에 보존됨." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  변경 없음 (오늘 새 usage·메모리 없음)" -ForegroundColor Green
    }

    $ErrorActionPreference = $prevEAP
} finally {
    Pop-Location
}

# ─────────────────────────────────────────────────────────────
# 4. 요약
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] 백업 현황" -ForegroundColor Yellow
$dumps = Get-ChildItem $backupDir -Filter "multica-*.sql.gz" -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending
Write-Host "  DB 백업 ($($dumps.Count)개):" -ForegroundColor White
$dumps | Select-Object -First 5 | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host "    $($_.Name)  ($mb MB)  $($_.LastWriteTime)"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "DONE. 이제 Docker 가 통째로 날아가도:" -ForegroundColor Green
Write-Host "  - multica DB: backups\multica-db\ 의 .sql.gz 로 복원" -ForegroundColor White
Write-Host "  - usage·메모리: git 에서 복원" -ForegroundColor White
Write-Host ""
Write-Host "복원법: gunzip < multica-YYYY.sql.gz | docker exec -i multica-postgres-1 psql -U multica -d multica" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────
# 자동화 등록 (한 번만 — 관리자 PowerShell):
#
#   $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
#       -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\backup-multica-daily.ps1`""
#   $trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
#   Register-ScheduledTask -TaskName "AlienAgentic-DailyBackup" `
#       -Action $action -Trigger $trigger -Description "Multica DB + usage 매일 백업" -RunLevel Highest
# ─────────────────────────────────────────────────────────────
