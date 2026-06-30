# migrate-docker-to-e.ps1 — Docker 데이터를 C→E 로 *안전하게* 이동.
#
# 2026-06-26 84GB 삭제 사고의 반성: 그때는 "이동" 대신 "삭제" 를 했고 백업이
# 없었다. 이 스크립트는 정반대 원칙으로 동작한다:
#
#   1. 이동 *전* DB + 볼륨 완전 백업 (E드라이브). 백업 없이는 한 발도 안 나감.
#   2. Docker Desktop disk image location 변경은 *사용자가 GUI로* (Docker 공식 마이그레이션).
#   3. 이동 *후* 27명·스킬·DB 살아있는지 검증.
#   4. 검증 실패 시 백업에서 즉시 복원.
#   5. **옛 vhdx 수동 삭제 절대 없음.** Docker 가 새 자리를 쓰면 옛 건 그대로 두고,
#      검증·안정화가 충분히 끝난 뒤 사용자가 직접 판단해 정리.
#
# 사용 (순서대로):
#   .\migrate-docker-to-e.ps1 -Backup     # [1] 완전 백업 (이동 전 필수)
#   (GUI: Docker Desktop → Settings → Resources → Advanced
#         → Disk image location → E:\Docker → Apply & Restart)
#   .\migrate-docker-to-e.ps1 -Verify     # [2] 이동 후 27명·스킬·DB 검증
#   .\migrate-docker-to-e.ps1 -Restore    # [3] (검증 실패 시만) 백업에서 DB 복원

param(
    [switch]$Backup,
    [switch]$Verify,
    [switch]$Restore
)

$ErrorActionPreference = "Continue"

$pg        = "multica-postgres-1"
$backupDir = "E:\AlienAgentic\backups\docker-migration"
$multica   = "E:\AlienAgentic\alien-agentic\automation\intranet\multica"
$compose   = "docker-compose.selfhost.yml"

function Test-Pg {
    $st = docker ps --filter "name=$pg" --format "{{.Status}}" 2>$null
    return ($st -match "Up")
}

function Get-Counts {
    $a = (docker exec $pg psql -U multica -d multica -t -A -c "SELECT count(*) FROM agent;" 2>$null).Trim()
    $s = (docker exec $pg psql -U multica -d multica -t -A -c "SELECT count(*) FROM skill;" 2>$null).Trim()
    $sk = (docker exec $pg psql -U multica -d multica -t -A -c "SELECT count(*) FROM agent_skill;" 2>$null).Trim()
    return @{ agent = $a; skill = $s; agent_skill = $sk }
}

# ════════════════════════════════════════════════════════════
# [1] BACKUP — 이동 전 완전 백업
# ════════════════════════════════════════════════════════════
if ($Backup) {
    Write-Host ""
    Write-Host "========== [1] Docker 이동 전 완전 백업 ==========" -ForegroundColor Cyan

    if (-not (Test-Pg)) {
        Write-Host "❌ multica-postgres 안 돎. multica 가동 후 재시도." -ForegroundColor Red
        return
    }
    if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"

    # 현재 데이터 양 기록 (검증 기준)
    $c = Get-Counts
    Write-Host "  현재 데이터: agent=$($c.agent) skill=$($c.skill) agent_skill=$($c.agent_skill)" -ForegroundColor White
    "agent=$($c.agent) skill=$($c.skill) agent_skill=$($c.agent_skill) at $stamp" |
        Out-File "$backupDir\counts-$stamp.txt" -Encoding utf8

    # (a) DB 전체 pg_dump → gzip
    Write-Host "  [a] DB pg_dump..." -ForegroundColor Yellow
    $dbFile = "$backupDir\multica-db-$stamp.sql.gz"
    docker exec $pg sh -c "pg_dump -U multica -d multica | gzip" > $dbFile 2>$null
    if ((Test-Path $dbFile) -and (Get-Item $dbFile).Length -gt 1000) {
        $mb = [math]::Round((Get-Item $dbFile).Length/1MB, 2)
        Write-Host "      OK: $dbFile ($mb MB)" -ForegroundColor Green
    } else {
        Write-Host "      ❌ DB 백업 실패 — 중단. 이동하지 마세요." -ForegroundColor Red
        if (Test-Path $dbFile) { Remove-Item $dbFile -Force }
        return
    }

    # (b) 볼륨 백업 (multica_pgdata, backend_uploads) → tar.gz
    Write-Host "  [b] 볼륨 백업..." -ForegroundColor Yellow
    foreach ($vol in @("multica_pgdata", "multica_backend_uploads")) {
        $exists = docker volume ls --format "{{.Name}}" 2>$null | Select-String -SimpleMatch $vol
        if (-not $exists) { continue }
        $volFile = "$backupDir\$vol-$stamp.tar.gz"
        docker run --rm -v "${vol}:/data" -v "${backupDir}:/backup" alpine `
            tar czf "/backup/$vol-$stamp.tar.gz" -C /data . 2>$null
        if (Test-Path $volFile) {
            $mb = [math]::Round((Get-Item $volFile).Length/1MB, 2)
            Write-Host "      OK: $vol ($mb MB)" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "✅ 백업 완료: $backupDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "이제 GUI 로 Docker 이동 (Docker 공식 마이그레이션):" -ForegroundColor White
    Write-Host "  1. Docker Desktop → ⚙ Settings → Resources → Advanced" -ForegroundColor Cyan
    Write-Host "  2. Disk image location → Browse → E:\Docker → 선택" -ForegroundColor Cyan
    Write-Host "  3. Apply & Restart (Docker 가 데이터를 E 로 옮김, 5~30분)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ⚠️ 이동 후 반드시:  .\migrate-docker-to-e.ps1 -Verify" -ForegroundColor Yellow
    Write-Host "  ⚠️ 옛 C 자리 vhdx 는 검증 끝까지 *절대 수동 삭제 금지*" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
    return
}

# ════════════════════════════════════════════════════════════
# [2] VERIFY — 이동 후 데이터 살아있나
# ════════════════════════════════════════════════════════════
if ($Verify) {
    Write-Host ""
    Write-Host "========== [2] 이동 후 검증 ==========" -ForegroundColor Cyan

    # docker 가 어느 disk 를 쓰나
    Write-Host "  Docker disk image 위치:" -ForegroundColor Yellow
    Get-ChildItem "E:\Docker","$env:LOCALAPPDATA\Docker" -Filter "docker_data.vhdx" -Recurse -Force -EA SilentlyContinue |
        ForEach-Object { Write-Host "    $([math]::Round($_.Length/1GB,2)) GB  $($_.FullName)" }

    if (-not (Test-Pg)) {
        Write-Host "  ❌ multica 안 돎 — docker compose up 먼저:" -ForegroundColor Red
        Write-Host "     cd $multica; docker compose -f $compose up -d" -ForegroundColor Cyan
        return
    }

    $c = Get-Counts
    Write-Host ""
    Write-Host "  데이터: agent=$($c.agent) skill=$($c.skill) agent_skill=$($c.agent_skill)" -ForegroundColor White
    $local = try { (Invoke-WebRequest "http://localhost:3000/" -UseBasicParsing -TimeoutSec 8).StatusCode } catch { "실패" }
    Write-Host "  localhost:3000: $local"

    Write-Host ""
    if ([int]$c.agent -ge 27 -and [int]$c.skill -ge 10) {
        Write-Host "  ✅ 데이터 정상 (27명·스킬 살아있음) — 이동 성공!" -ForegroundColor Green
        Write-Host "  옛 C 자리 vhdx 는 Docker 가 더 안 쓰면 비어감. 며칠 안정 후 사용자 판단으로 정리." -ForegroundColor White
    } else {
        Write-Host "  ⚠️ 데이터 비었거나 부족 (agent=$($c.agent), skill=$($c.skill))" -ForegroundColor Red
        Write-Host "  → GUI 마이그레이션이 데이터를 안 가져온 것. 백업에서 복원:" -ForegroundColor Yellow
        Write-Host "     .\migrate-docker-to-e.ps1 -Restore" -ForegroundColor Cyan
    }
    return
}

# ════════════════════════════════════════════════════════════
# [3] RESTORE — 백업에서 DB 복원 (검증 실패 시만)
# ════════════════════════════════════════════════════════════
if ($Restore) {
    Write-Host ""
    Write-Host "========== [3] 백업에서 DB 복원 ==========" -ForegroundColor Cyan

    if (-not (Test-Pg)) {
        Write-Host "  ❌ multica 안 돎. docker compose up 먼저." -ForegroundColor Red
        return
    }

    # 최신 백업 찾기
    $latest = Get-ChildItem "$backupDir\multica-db-*.sql.gz" -EA SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Host "  ❌ 백업 파일 없음: $backupDir" -ForegroundColor Red
        return
    }
    Write-Host "  복원 대상: $($latest.Name) ($([math]::Round($latest.Length/1MB,2)) MB)" -ForegroundColor White
    Write-Host "  5초 후 복원 (현재 DB 위에 덮어씀). Ctrl+C 취소..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # gunzip → psql 로 복원
    $tmp = "$env:TEMP\multica-restore.sql"
    docker cp "$($latest.FullName)" "${pg}:/tmp/restore.sql.gz" 2>$null
    docker exec $pg sh -c "gunzip -f /tmp/restore.sql.gz && psql -U multica -d multica -f /tmp/restore.sql" 2>&1 |
        Select-Object -Last 10 | ForEach-Object { Write-Host "    $_" }

    $c = Get-Counts
    Write-Host ""
    Write-Host "  복원 후: agent=$($c.agent) skill=$($c.skill) agent_skill=$($c.agent_skill)" -ForegroundColor Green
    return
}

# 인자 없으면 도움말
Write-Host ""
Write-Host "Docker C→E 안전 이동 — 순서:" -ForegroundColor Cyan
Write-Host "  1. .\migrate-docker-to-e.ps1 -Backup    # 완전 백업 (필수)" -ForegroundColor White
Write-Host "  2. GUI 로 disk location E 변경 + Apply & Restart" -ForegroundColor White
Write-Host "  3. .\migrate-docker-to-e.ps1 -Verify    # 데이터 검증" -ForegroundColor White
Write-Host "  4. (실패 시) .\migrate-docker-to-e.ps1 -Restore" -ForegroundColor White
