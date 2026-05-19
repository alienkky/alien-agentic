# Docker Compose Override Drift — 케이스 스터디

> 실패 케이스 = 가장 비싼 자산. 가장 자세하게 기록한다.

---

## 한 줄 요약

수동 빌드와 자동시작 빌드가 **서로 다른 override 조합**을 사용해 두 개의 다른 이미지를 만들었고, 재부팅 후 autostart가 *예전 이미지*를 띄우면서 작업이 사라진 것처럼 보인 환경 정합성 사고.

---

## 타임라인

| 시각 | 이벤트 |
|---|---|
| 5/19 — PR #2 머지 | `bottom-14` → `bottom-24` 스타일 변경 |
| 5/19 — PR #3 머지 | 인라인 편집기 도입, 5단계 디버깅 완료. **수동 빌드로 확인** |
| 5/19 — 재부팅 | OS 재시작. autostart-serve.ps1 자동 실행 |
| 재접속 직후 | sticky 댓글창 + '맨 아래로' 버튼 **둘 다 사라짐** |
| 진단 | autostart는 `selfhost.yml + selfhost.build.yml` 조합으로 빌드. 수동은 `selfhost.yml` 단독 → 서로 다른 이미지 |
| 5/19 — PR #4 머지 | 수동 빌드 스크립트도 override 포함하도록 통일. **종결** |

---

## 근본 원인 — Override 분기

외계 함대가 두 갈래 길로 갈라지는 것과 같다. 같은 기지(소스코드)를 출발해도 항로(override)가 다르면 도착지(이미지)가 달라진다.

```
소스 변경 (PR #2, #3)
        │
        ├─── fix-issue-detail-inline.ps1 (수동)
        │        └─ docker compose -f selfhost.yml
        │                → 이미지 A  ← 변경 반영됨
        │
        └─── autostart-serve.ps1 (재부팅 자동)
                 └─ docker compose -f selfhost.yml -f selfhost.build.yml
                          → 이미지 B  ← 변경 없음 (다른 빌드 경로)

재부팅 → autostart → 이미지 B 실행 → "작업이 사라짐"
```

---

## 재발 방지 패턴 3개

### (a) 유일한 진입점 CLI 강제

`aa serve`, `aa rebuild` 를 **유일한 docker compose 호출 진입점**으로 만든다. 모든 override 조합은 CLI 내부에서만 관리.

```bash
# 앞으로는 이것만
aa serve          # autostart 와 수동 모두 동일 경로
aa rebuild        # 이미지 재빌드
```

### (b) 공통 헬퍼 함수로 리팩터

`autostart-serve.ps1`과 수동 헬퍼들이 **동일한 함수**를 호출하도록 PowerShell 리팩터.

```powershell
# automation/intranet/multica/helpers/compose.ps1
function Invoke-MulticaCompose {
    param([string[]]$ComposeArgs)
    docker compose `
        -f selfhost.yml `
        -f selfhost.build.yml `
        @ComposeArgs
}

# autostart-serve.ps1 와 fix-*.ps1 모두 이것만 호출
Invoke-MulticaCompose "up", "-d", "--build"
```

### (c) 빌드 시간 비교 헬스체크

부팅 시 **떠 있는 이미지의 빌드 시각**과 `multica/` 소스 변경 시각을 비교. 이미지가 소스보다 오래됐으면 경고.

```powershell
# 헬스체크 로직 (자동시작 후 실행)
$imageBuiltAt = docker inspect multica-web:dev `
    --format '{{.Created}}' | Get-Date
$srcLastModified = (Get-ChildItem ./multica -Recurse | `
    Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

if ($srcLastModified -gt $imageBuiltAt) {
    Write-Warning "[multica] 이미지가 소스보다 오래됨. `aa rebuild` 실행 권장."
}
```

---

## 신호 (Early Warning)

비슷한 사고가 또 발생할 때 빠르게 알아채는 방법:

1. **부팅 직후 즉시 확인**: `docker images multica-web:dev` → CREATED 컬럼의 시각이 마지막 PR 머지 이후인지 체크
2. **UI 변경이 안 보일 때 1순위 의심**: "캐시 문제" 전에 먼저 이미지 빌드 시각 확인
3. **스크립트가 2개 이상 docker compose 를 직접 호출하고 있다면**: 즉시 리팩터 신호

---

## 회사 차원 의의

이 사고의 본질은 **환경 정합성 파편화**다. 지금은 기영님 PC 1대지만, Alien Agentic이 클라이언트에게 27명 외계 에이전트 환경을 납품할 때는 **N명 × N환경**으로 곱해진다.

- 클라이언트 A사는 수동으로 빌드했고, 클라이언트 B사는 자동시작으로 띄웠다면?
- 에이전트 X는 override A로 빌드됐고, 에이전트 Y는 override B로 빌드됐다면?

*환경 정합성은 우리가 클라이언트에게 하는 암묵적 약속이다.* "우리가 보여준 것과 당신이 보는 것이 같다"는 약속. 이번 사고는 그 약속이 얼마나 쉽게 깨지는지 가르쳐줬다.

**미래 클라이언트 셋업 가이드 반영 필요**:
- 셋업 문서에서 *직접 docker compose 호출* 안내 제거
- 모든 환경 조작은 `aa` CLI 경유 명시

---

## CLI 강제 정책 제안

### 진입점 일람표

| 목적 | 기존 (deprecated) | 신규 (강제) |
|---|---|---|
| 서버 시작 | `docker compose -f selfhost.yml up -d` | `aa serve` |
| 이미지 재빌드 | `fix-issue-detail-inline.ps1` | `aa rebuild` |
| 서버 중지 | `docker compose down` | `aa stop` |
| 자동시작 | `autostart-serve.ps1` → 직접 compose | `autostart-serve.ps1` → `aa serve` 호출 |

### 진입점 강제 방법

```powershell
# autostart-serve.ps1 최종 형태
# 직접 docker compose 호출 제거, aa CLI 위임
& "$(Get-Command aa).Source" serve
```

### Deprecate 처리 방식

기존 스크립트(`fix-*.ps1`)는 삭제하지 않고 **상단에 deprecated 주석 삽입**:

```powershell
# DEPRECATED: 2026-05-19 이후 `aa rebuild` 사용
# 이 스크립트는 override 조합이 autostart 와 달라 이미지 불일치를 유발함
# 참고: shared-memory/insights/2026-05-19-docker-compose-override-drift.md
Write-Warning "이 스크립트는 deprecated 입니다. `aa rebuild` 를 사용하세요."
```

### 담당: automation-coder

- [ ] `aa serve` / `aa rebuild` / `aa stop` CLI 구현 (`automation/cli/` 하위)
- [ ] `Invoke-MulticaCompose` 헬퍼 함수 작성
- [ ] `autostart-serve.ps1` 리팩터 → `aa serve` 위임
- [ ] 기존 `fix-*.ps1` deprecated 주석 삽입
- [ ] 부팅 후 빌드 시간 비교 헬스체크 스크립트 추가

---

*케이스 등록: 2026-05-19 | 작성: case-curator | PR #4로 종결*
