# 🛸 BRAND-SYSTEM SQUAD

## 1. 메타

| 필드 | 값 |
|---|---|
| 슬러그 | `brand-system` |
| 상태 | **FORMED** (가동 입력 대기) |
| 결성일 | 2026-05-16 |
| Squad Lead | 심연우 [Why발굴] (`origin-reader`) |
| 본부 이슈 | `ALI-19` — 브랜드 시스템 개발 적합 인력 추천 요청 |
| 본부 이슈 UUID | `5fe3b259-00ff-4589-8be8-83b298342414` |
| 워크스페이스 라벨 | `스쿼드: 브랜드시스템` (`#8b5cf6`) |
| 라벨 UUID | `1c13042d-07c2-411b-ba97-26e43a193ccb` |
| 머신 판독 등록부 | `./squad.toml` (aa CLI 진실원) |
| `aa` 접근 | `aa squad show brand-system` |
| 결성 트리거 | 기영님 코멘트 "관련 인력으로 스쿼드를 만들어줘" (2026-05-16 03:34 UTC) |

---

## 2. Mission

> *"브랜드가 *말로 끝나는 정체성*이 아니라 *매일 행동으로 굴러가는 시스템*이 되도록 직조한다."*

**4단 직조 흐름**

```
WHY (존재 이유)
   → STORY (마스터 내러티브)
      → EXPRESSION (목소리 · 시각 · 채널)
         → OPERATIONS (조직 · 워크플로 · KPI)
```

한 호흡으로 책임진다. 어느 한 단도 빠지지 않는다.

---

## 3. Roster (13명, 3 Cell)

### 🧭 Squad Lead

| 자리 | 담당 | 역할 |
|---|---|---|
| Squad Lead | 심연우 [Why발굴] | 본부 이슈 오너십 · 페이즈 간 인계 조율 · 기영님 단일 창구 |

### 🌌 Phase 1 Cell — 정체성 코어 (Identity Core)

| 코어 멤버 | 에이전트 카탈로그 이름 | Cell 내 역할 |
|---|---|---|
| 심연우 [Why발굴] *(Phase Lead)* | `origin-reader` | 4층 진단서 (표면/작동/신념/매듭) |
| 윤지평 [비전] | `vision-architect` | 5/10년 비전 시나리오 3종 |
| 서가온 [컬쳐] | `culture-linguist` | Culture Code 7~9개 |
| 한벼리 [내러티브] *(Phase 1→2 브릿지)* | `story-weaver` | 30초/3분/30분 마스터 내러티브 |
| 민애린 [페인진단] | `pain-interpreter` | 표면 페인 vs 구조적 페인 |

### 🛰 Phase 2 Cell — 표현 시스템 (Expression System)

| 코어 멤버 | 에이전트 카탈로그 이름 | Cell 내 역할 |
|---|---|---|
| 한벼리 [내러티브] *(Phase Lead, Phase 1에서 이월)* | `story-weaver` | 톤·메시지 일관성 단일 진실원 |
| 백그림 [UI/UX] | `ui-ux-designer` | Visual Identity · 대시보드 적용 |
| 남말씨 [프롬프트] | `prompt-engineer` | System Prompt Voice (AI 에이전트의 *목소리*로서의 브랜드) |
| 노소문 [마케팅] | `content-scout` | Threads/LinkedIn/Substack 채널 포맷 |
| 문지율 [브랜드검수] *(Always-on 가드레일)* | `brand-keeper` | 모든 외부 산출물 톤 검수 — 전 페이즈 상시 |

### 🚀 Phase 3 Cell — 운영 시스템 (Operations System)

| 코어 멤버 | 에이전트 카탈로그 이름 | Cell 내 역할 |
|---|---|---|
| 양터전 [조직설계] *(Phase Lead)* | `org-designer` | 인간+AI 공존 조직도에서 브랜드 책임의 자리 |
| 구도연 [팀설계] | `agent-architect` | 브랜드를 굴리는 에이전트 팀 구성 |
| 류한길 [워크플로] | `workflow-engineer` | 산출물 검수·발행·아카이브 워크플로 |
| 정도량 [KPI] | `kpi-translator` | 브랜드 성과 측정 (North Star → 분기 → 주간) |

---

## 4. Squad Operating Norms

1. **단일 본부** — 모든 스쿼드 활동은 본부 이슈 `ALI-19` 또는 그 sub-issue 위에서. 직접 통신 금지, 협업은 `shared-memory/messages/` 경유.
2. **페이즈 게이트** — Phase N의 산출물이 기영님 승인을 받기 전엔 Phase N+1을 시작하지 않는다. (헌법 WHY→HOW→WHAT 도그마와 동일.)
3. **호출 상한** — 한 작업당 동시 호출 최대 5명. 페이즈를 잘게 쪼개서 지킨다.
4. **mention 규율** — 다른 멤버를 단순 *참조*할 때 mention 링크 금지. *실제로 일을 시작할 때*만 한 명씩 mention.
5. **상시 가드** — 문지율 [브랜드검수] (`brand-keeper`) 는 모든 외부 발행 직전 자동 호출.
6. **메모리 누적** — 모든 페이즈 산출물은 `clients/{brand-name}/{WHY|HOW|WHAT}/` 표준 경로에 저장. 익명화 메타 사본은 `shared-memory/clients/{brand-name}/` 에 별도.

---

## 5. Activation Conditions

스쿼드는 *결성 완료* 상태(FORMED)이며, 다음 입력 중 하나를 받으면 즉시 ACTIVE 로 전환:

- **A. Alien Agentic 자체 브랜드** — `clients/_self-alien-agentic/`
- **B. 첫 실제 클라이언트 브랜드** — 클라이언트 식별자 + First Contact 결과
- **C. 가상 케이스** — 시뮬레이션용 가상 브랜드 (예: "10인 디자인 스튜디오")
- **D. 별도 지정 브랜드**

가동 시 첫 sub-issue: `"Phase 1: 정체성 코어 직조 - {브랜드명}"`

---

## 6. Activation Log

| 일자 | 대상 브랜드 | 페이즈 | 결과 | 회고 링크 |
|---|---|---|---|---|
| _(없음 — 가동 전)_ | | | | |

가동 시 각 행은 `_activations/{YYYY-MM-DD}-{brand-slug}.md` 와 연결.

---

## 7. Cell Deliverable Map

페이즈별 표준 산출물 경로 (`{brand}` = 가동 시 결정되는 브랜드 슬러그).

### Phase 1 — Identity Core

```
clients/{brand}/WHY/
├── origin-diagnosis-4layer.md      # 심연우
├── pain-diagnosis.md               # 민애린
├── vision-3scenarios.md            # 윤지평
├── culture-code-draft.md           # 서가온
└── master-narrative.md             # 한벼리 (3 버전: 30초/3분/30분)
```

### Phase 2 — Expression System

```
clients/{brand}/HOW/brand-expression/
├── voice-tone-guide.md             # 한벼리 (Lead)
├── visual-system.md                # 백그림
├── prompt-voice-spec.md            # 남말씨
├── channel-format-templates/       # 노소문
│   ├── threads.md
│   ├── linkedin.md
│   └── substack.md
└── brand-keeper-review-log.md      # 문지율 (상시)
```

### Phase 3 — Operations System

```
clients/{brand}/HOW/brand-operations/
├── brand-org-chart.md              # 양터전
├── brand-agent-team.md             # 구도연
├── brand-workflow.md               # 류한길
└── brand-kpi-dashboard.md          # 정도량
```

---

## 8. Change Log

| 일자 | 변경 | 작성자 |
|---|---|---|
| 2026-05-16 | 스쿼드 결성 · FORMED 상태로 등록 | 심연우 [Why발굴] |
| 2026-05-16 | `aa` 시스템에 1급 시민으로 등록 — `squad.toml` 생성 + `aa squad` 명령군 추가 | 심연우 [Why발굴] |
