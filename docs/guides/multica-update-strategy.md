# Multica 안전 업데이트 전략 — 커스터마이즈 유지

> 원본 Multica 를 새 버전으로 올리면서 우리 커스터마이즈(한국어화·Alien Plan·
> Alien Memory·Claude 4.8 모델·인라인 편집기)를 **잃지 않고** 적용하는 절차.

---

## 한 줄 요약

우리 커스터마이즈는 multica 소스에 *직접* 박혀 있지 않다. **alien-config 의
패치 스크립트가 매번 재적용**하는 구조다. 그래서 업데이트는:

```
현재 백업 → 업스트림 pull → 우리 패치 재적용(setup-multica.ps1) → 깨진 패치 수선 → 빌드·검증
```

핵심 위험은 **앵커 기반 패치 9개** 가 업스트림이 그 코드 줄을 바꾸면 깨지는 것.
그래서 *패치 실패를 조용히 넘기지 않고 즉시 멈추게* 설계돼 있다 (drift 방지).

---

## 왜 이 구조인가 — 커스터마이즈가 사는 곳

| 커스터마이즈 | 사는 곳 | multica 에는 |
|---|---|---|
| 한국어화 + 브랜딩 | `alien-config/scripts/restore-korean-locale.py` | 패치로 *재생성* |
| Alien Plan | `alien-config/alien-plan/` + `install-alien-plan.py` | 복사 + 패치로 *재생성* |
| Alien Memory | `alien-config/alien-memory/` + `install-alien-memory.py` | 복사 + 패치로 *재생성* |
| Claude 4.8 모델 | `add-claude-4-8-models.py` | 패치로 *재생성* |
| 인라인 편집기 | `fix-issue-detail-inline.py` | 패치로 *재생성* |

`automation/intranet/multica/` 자체는 `.gitignore` 처리 → fresh clone 하면
우리 변경 *전부 사라짐* → 그래서 `setup-multica.ps1` 가 한 방에 재적용한다.

**결론**: multica 를 새 버전으로 갈아끼워도, `setup-multica.ps1` 만 다시 돌리면
우리 커스터마이즈가 *재생성* 된다. 단, 앵커가 살아있어야 한다.

---

## 위험 지도 — 앵커 fragility 9개

업스트림이 다음 *파일·코드 줄* 을 바꾸면 해당 패치가 깨진다 (FAIL):

| 패치 | 대상 파일 | 앵커 | 위험 |
|---|---|---|---|
| F1·F2 | `packages/core/i18n/types.ts` | `SupportedLocale = "en" \| "zh-Hans"` | 🔴 언어 추가/구조 변경 시 |
| F3 | `apps/web/app/layout.tsx` | `HTML_LANG` 객체 | 🟡 |
| F4·F5 | `packages/views/locales/index.ts` | `import ... squads.json` / `RESOURCES` | 🔴 네임스페이스 추가 시 |
| F6 | `settings/components/preferences-tab.tsx` | language picker 배열 | 🟡 |
| P1 | `packages/views/package.json` | `"./agents": "./agents/index.ts"` | 🟢 |
| P2 | `packages/core/paths/paths.ts` | `issues: () => ...` | 🟡 |
| P3·P4·P5·P6 | `packages/views/layout/app-sidebar.tsx` | `NavKey`·`NavLabelKey`·`workspaceNav` | 🔴 사이드바 리팩터 시 |
| P7·P9 | `locales/{en,ko,zh-Hans}/layout.json` | `nav` 객체 | 🟢 |
| 인라인편집 | `issues/components/issue-detail.tsx` | `Archive, Calendar` import·`scrollContainerEl` state | 🔴 가장 활발히 변경 |
| 4.8 모델 | `server/pkg/agent/models.go` | `claude-opus-4-7` 줄 | 🟡 |

🔴 = 업스트림이 자주 건드리는 영역. 🟢 = 안정적.

---

## 안전 업데이트 절차 (단계별)

### 0. 사전 준비 — changelog 읽기

브라우저에서 https://multica.ai/changelog (또는 GitHub releases) 를 보고,
위 표의 🔴 영역(i18n·sidebar·issue-detail·models.go)에 변경이 있는지 확인.
있으면 그 패치는 *깨질 것을 예상* 하고 수선 준비.

### 1. 현재 상태 백업

```powershell
cd e:\AlienAgentic\alien-agentic\automation\intranet\multica
# 현재 우리가 적용한 모든 변경을 patch 로 백업 (혹시 모를 수동 변경 보존)
git diff > ..\alien-config\_backup\multica-before-update-$(Get-Date -Format yyyyMMdd).patch
git log --oneline -1 > ..\alien-config\_backup\multica-version-before.txt
docker images multica-backend:dev --format "{{.ID}} {{.CreatedSince}}" >> ..\alien-config\_backup\multica-version-before.txt
```

### 2. 업스트림 가져오기

```powershell
# working tree 리셋 (우리 패치는 스크립트로 재생성되므로 버려도 안전)
git checkout .
git clean -fd packages/views/alien-plan packages/views/alien-memory   # 우리가 복사한 폴더 제거

# 새 버전 pull
git fetch origin
git pull origin main          # 또는 특정 태그: git checkout v1.2.3
```

### 3. 우리 커스터마이즈 재적용

```powershell
# setup-multica.ps1 가 모든 패치를 순서대로 재적용 + 빌드까지
cd ..\alien-config\scripts
.\setup-multica.ps1
```

`setup-multica.ps1` 의 각 단계는 **패치 실패 시 즉시 멈춘다** (`exit 1`).
어떤 패치가 `FAIL (앵커 없음)` 인지 화면에 정확히 표시된다.

### 4. 깨진 패치 수선

`FAIL (앵커 없음)` 이 떴다면 — 업스트림이 그 앵커 줄을 바꾼 것.

```powershell
# 깨진 패치의 대상 파일에서 새 코드 구조 확인
# 예: F1 깨짐 → types.ts 의 SupportedLocale 새 형태 확인
Select-String -Path packages\core\i18n\types.ts -Pattern "SupportedLocale" -Context 1,1
```

→ 해당 패치 스크립트(`restore-korean-locale.py` 등)의 **anchor 문자열을
새 코드에 맞게 수정** → 다시 `setup-multica.ps1`.

> 💡 앵커 수정은 alien-config 의 *스크립트* 를 고치는 것 — multica 소스가 아님.
> 한 번 고치면 다음 업데이트에도 적용된다 (영구).

### 5. 빌드·검증

`setup-multica.ps1` 가 마지막에 docker 재빌드까지 한다 (build override 포함).
검증:

```powershell
# 컨테이너 가동
docker ps --filter "name=multica" --format "table {{.Names}}\t{{.Status}}"
```

브라우저에서:
- [ ] 한국어 UI (사이드바·설정 한글)
- [ ] 사이드바에 Alien Plan · Alien Memory (🛸·🧠)
- [ ] 설정 → 언어 → 한국어 옵션
- [ ] 모델 picker 에 Claude Opus 4.8
- [ ] 이슈 상세 인라인 편집기 + '맨 아래로' 버튼
- [ ] 실시간 푸시 (받은함 카운팅 자동)

### 6. 실패 시 롤백

수선이 오래 걸리거나 빌드가 깨지면 이전 버전으로:

```powershell
cd e:\AlienAgentic\alien-agentic\automation\intranet\multica
git checkout multica-version-before  # 1단계에서 기록한 커밋
.\..\alien-config\scripts\setup-multica.ps1
```

이전 이미지가 살아있으면 그냥 재가동:
```powershell
docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d
```

---

## 업데이트 빈도 권장

- **매번 따라가지 않는다.** 우리는 운영 중인 시스템 — 안정성 > 최신.
- 업데이트 트리거: ① 우리가 필요한 새 기능 ② 보안 패치 ③ 분기 1회 정기.
- 업데이트 전 **반드시 changelog 의 🔴 영역 확인** → 깨질 패치 예측.

## 미래 개선 (조사 결과 기반)

1. **앵커 다중화**: 단일 문자열 → 정규식 다중 패턴 (업스트림 변형 흡수)
2. **버전 호환 매트릭스**: 각 패치에 "이 multica 버전 범위에서 검증됨" 기록
3. **upstream diff 자동 감지**: 업데이트 전 `git diff` 로 🔴 파일 변경 자동 경고

상세 조사: 이 전략은 2026-06-14 alien-config 패치 시스템 전수조사 기반.

---

*케이스 등록: 2026-06-14 | 작성: master-orchestrator*
