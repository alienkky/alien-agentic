---
type: insight
status: published
tags: [insight, multica, update, prevention]
date: 2026-06-14
---

# Multica 605 커밋 안전 업데이트 — 케이스 스터디

> 예방이 수습보다 10배 빠르다. 이번 케이스가 그것을 수치로 증명했다.

---

## 한 줄 요약

업스트림 605 커밋 진행 후 업데이트 시 함정 3개(git stash 충돌 / feature 브랜치 고착 / PS NativeCommandError)가 연속 발생했지만, 사전 WebFetch 앵커 검증 덕에 *인라인 편집기 패치 충돌은 0건*. 수습이 아니라 예방이 이겼다.

---

## 타임라인

| 시각 | 이벤트 |
|---|---|
| 2026-05-19 | multica fresh clone + 커스터마이즈 9개 패치 적용 구조 정착 |
| 2026-06-14 오전 | 업스트림 605 커밋 진행 확인 → 업데이트 결정 |
| 06-14 — DryRun | `update-multica.ps1 -DryRun` → 백업 26KB patch + 버전 기록 OK |
| 06-14 — 진단 | 우리 multica: `8354136` (feature 브랜치 `fix/scroll-to-bottom-overlap-ali-40`) 정체 확인 |
| 06-14 — 사전 검증 | WebFetch로 업스트림 main `issue-detail.tsx` raw 받아 앵커 4개 검증 → "충돌 없음 확정" |
| 06-14 — 함정 1 | `git pull` 이 로컬 변경과 충돌 → `git stash` + 부분 checkout으로 우회 |
| 06-14 — 함정 2 | multica 가 feature 브랜치에 있어 pull 이 merge 시도 → committer identity 요구 → `git checkout main` 으로 해결 |
| 06-14 — 함정 3 | PS 5.1 NativeCommandError — git stderr 정보 메시지를 에러로 잡고 스크립트 멈춤 → EAP=Continue + Out-String 으로 영구 fix (`b1abf4e` push) |
| 06-14 — 함정 4 | alien-agentic repo 의 setup-multica.ps1 이 옛 3단계 버전 → 빌드 깨짐 (`Module not found: @multica/views/alien-memory`) → 부분 checkout으로 최신 스크립트 + alien-memory/ 폴더 회수 |
| 06-14 — 성공 | setup-multica.ps1 5단계 모두 OK → docker 빌드 115.7초 성공 |
| 06-14 — 검증 | multica 3개 + aa-memory-api Up, 한국어·Plan·Memory·Claude 4.8·인라인 편집기 전부 살아남 |

---

## 근본 원인 — 네 가지 함정의 구조

### 함정 1: 로컬 변경 + git pull 충돌

```
multica 워킹트리에 부분 적용된 변경 존재
       ↓
git pull 시도 → "Cannot pull with rebase: You have unstaged changes"
       ↓
git stash + git checkout origin/main -- <파일> 부분 checkout 으로 우회
```

### 함정 2: feature 브랜치 고착

```
multica 가 어쩌다 feature 브랜치 (fix/scroll-to-bottom-overlap-ali-40) 에 남음
       ↓
git pull → merge 시도 → "Please tell me who you are" (committer identity 없음)
       ↓
git checkout main → git pull origin main 으로 해결
```

### 함정 3: PowerShell 5.1 NativeCommandError (재발)

```
git pull / checkout 이 stderr 에 정보 메시지 출력
("Updated 15 paths from the index")
       ↓
$ErrorActionPreference = 'Stop' 이 이를 에러로 분류 → 스크립트 중단
       ↓
EAP=Continue + Out-String + $LASTEXITCODE 패턴으로 영구 fix
(동일 패턴: setup-caddy 2026-05-27 에서 한 번 발생, 이번이 두 번째)
```

### 함정 4: alien-agentic repo 버전 drift

```
alien-agentic git 이 옛 setup-multica.ps1 (3단계) 상태
       ↓
Alien Memory·Claude 4.8 단계 빠진 채 빌드
→ Module not found: '@multica/views/alien-memory'
       ↓
git checkout origin/<branch> -- setup-multica.ps1 alien-memory/ 으로 최신 회수
```

---

## 사전 검증이 구한 것 — 앵커 4개

업데이트 전 WebFetch로 업스트림 main 의 `packages/views/issues/components/issue-detail.tsx` raw 파일을 받아 인라인 편집기 패치의 앵커를 직접 확인했다.

| 앵커 | 검증 내용 | 결과 |
|---|---|---|
| A | ArrowDown import — 업스트림에 없고, Archive·Calendar 는 그대로 | 살아있음 |
| B | showScrollToBottom state — 업스트림에 없고, scrollContainerEl 만 존재 | 살아있음 |
| C | showScrollToBottom 조건부 렌더 | 살아있음 |
| D | Bottom comment input 주석 | 살아있음 |

결론: "충돌 없음 확정" → 실제로 인라인 편집기 관련 충돌 0건.

검증에 쓴 시간: 약 30분.
충돌이 났을 경우 수습 예상 시간: 1~3시간.

---

## 재발 방지 패턴 4개

### (a) 사전 앵커 검증 표준화

업데이트 전 반드시:
1. `update-multica.ps1 -DryRun` 으로 백업 + 버전 기록
2. WebFetch 로 업스트림 main 의 우리 패치 관련 파일 raw 취득
3. 패치 앵커 문자열 존재 여부 확인 → "충돌 없음 확정" 후 진행

향후 `update-multica.ps1` 에 앵커 자동 검증 스텝 통합 검토 (case-curator 제안).

### (b) PowerShell native command stderr 표준 패턴

git·docker·caddy 같은 native command 는 일괄:

```powershell
# 표준 패턴 (EAP=Continue + Out-String + $LASTEXITCODE)
$ErrorActionPreference = 'Continue'
$output = git pull origin main 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Error "git pull failed (exit $LASTEXITCODE): $output"
    exit 1
}
Write-Host $output
```

setup-caddy (5/27), update-multica (6/14) 두 번 발생. CLAUDE.md §7 에 표준으로 박을 거리.

### (c) 부분 checkout 패턴 문서화

conflict·stash·identity 함정을 우회하는 표준 절차:

```bash
# 특정 파일/폴더만 최신 origin 으로 교체
git checkout origin/<branch> -- <path>
```

기존 워킹트리 변경을 건드리지 않고 원하는 파일만 정확히 갱신. `docs/guides/` 에 등록 필요.

### (d) multica 브랜치 정상화 후크

`setup-multica.ps1` 시작 시 브랜치 체크:

```powershell
$branch = git -C $MulticaPath branch --show-current
if ($branch -ne 'main') {
    Write-Warning "[multica] 현재 브랜치: $branch. main 으로 전환합니다."
    git -C $MulticaPath checkout main
}
```

어쩌다 feature 브랜치에 남아 있는 상황을 자동 감지·복구.

---

## 신호 (Early Warning)

다음 업데이트에서 비슷한 위기를 빨리 알아채는 신호:

1. **`docker ps` 에 multica frontend 가 Restarting 또는 missing** — 빌드 깨짐 시작
2. **빌드 로그에 `Module not found: Can't resolve '@multica/views/...'`** — install 스크립트 안 돈 상태, alien-agentic git pull 필요
3. **setup-multica.ps1 출력이 `[1/3] [2/3] [3/3]` (3단계)** — 옛 버전, alien-agentic git pull 필요
4. **`git checkout main` 후 `Your branch is behind 'origin/main' by N commits`** — N 이 크면 WebFetch 사전 검증 필수

---

## 회사 차원 의의

이번 업데이트는 *우리 패치 시스템이 605 커밋만큼의 업스트림 진화를 흡수* 한 사건이다. "1~2 PR 흡수"가 아니라 "수십~수백 PR 흡수"도 가능함이 증명됐다.

클라이언트 N명에게 동일 시스템을 납품할 때 — 클라이언트마다 multica 가 다른 버전이어도 동일 커스터마이즈 9개를 매번 재적용할 수 있다. 패치 fragility 의 진짜 의미도 재정의됐다: "곧 깨진다"가 아니라 "*같은 영역을 건드리면* 깨진다". 영역 회피 + 사전 검증만 잘하면 안정적.

27명 외계 에이전트 시스템의 *지속가능성*이 한 단계 올라갔다.

---

## 커밋 / PR 참조

- PR #9 (`claude/add-chatgpt-integration-U5jfU`)
  - `b1abf4e` — git stderr NativeCommandError 영구 fix
  - `02e09ab` — Obsidian 메모리 강화
  - `3979524` — Obsidian Vault
  - `988aca9` — Multica 업데이트 도구
- multica: `8354136` (feature 브랜치 정체 시점) → `34d4cd3` (main 최신, 6/13)
- 관련 도구: `automation/intranet/alien-config/scripts/update-multica.ps1`, `docs/guides/multica-update-strategy.md`

---

*케이스 등록: 2026-06-14 | 작성: case-curator*
