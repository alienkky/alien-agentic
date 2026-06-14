# WORKFLOW — 웹 3D 모델러 개발 워크플로우

> 누가 · 언제 · 무슨 input 을 받아 · 무슨 output 을 내는가.
> 개발 사이클 + 27명 외계 동료 오케스트레이션 + 픽킹/메모리 규약.

---

## 1. 큰 그림 — WHY→HOW→WHAT 깔때기에 얹기

이 제품은 **Alien Agentic 자체 IP**다. 우리 깔때기를 우리 제품에 그대로 적용한다.

```
🌌 WHY   "왜 또 하나의 CAD인가?" — 설치 없이 누구나, 외계의 효율로 3D 사고를 푼다
🛰 HOW   기술 아키텍처 + 페이즈 로드맵 (PLAN.md) — 완료
🚀 WHAT  페이즈별 빌드 (PROMPT.md) — 진행
🌍 운영  배포 → 피드백 → 케이스 축적
```

---

## 2. 개발 사이클 — 한 페이즈를 도는 법

각 페이즈는 아래 7스텝 루프를 돈다. 이게 워크플로우의 심장이다.

```
① 슬라이스 정의      ┌──────────────────────────────────────────┐
   (작게 자른다)     │  PLAN.md 의 페이즈 → "수직 슬라이스" 1개 선택  │
        │            └──────────────────────────────────────────┘
        ▼
② 빌드 프롬프트       PROMPT.md §A(마스터) + §B(해당 페이즈) 조합
        │
        ▼
③ 구현               automation-coder / subagent-builder 가 코드 작성
        │            (커널 워커는 신중히 — 메모리 해제 패턴 준수)
        ▼
④ 검증 (필수 게이트)  tsc(strict) → vitest(커널 단위) → playwright(E2E)
        │            ❌ 실패 시 ③ 으로 되돌아감
        ▼
⑤ QA 시뮬레이션      qa-tester: 정상·예외·악성 3종 시나리오
        │
        ▼
⑥ 커밋 + PR          수직 슬라이스 = 커밋, 페이즈 = PR(draft)
        │
        ▼
⑦ 회고 + 메모리       교훈 → shared-memory/insights/, 실패 → meta/
        │
        └──▶ 다음 슬라이스로 (①)
```

**게이트 원칙**: ④ 검증을 통과 못 하면 절대 ⑥ 으로 못 간다. 특히 `multica` 교훈 — *esbuild 파싱 ≠ tsc 타입체크* — 을 그대로 적용한다. WASM/Three.js 타입 누락은 런타임에서 터지므로 tsc strict 가 1차 방어선.

---

## 3. 27명 외계 동료 — 누가 어디에 붙는가

| 단계 | 에이전트 | input → output |
|---|---|---|
| **HOW 검토** | `integration-specialist` | OCCT/PlaneGCS/Three.js 연동 청사진 검증 |
| | `process-cartographer` | 사용자 모델링 플로우(스케치→돌출→편집) AS-IS 매핑 |
| **WHAT 빌드** | `subagent-builder` | 페이즈 빌드 에이전트 정의 생성 |
| | `automation-coder` | **결정론적** 코드 — 커널 래퍼, 직렬화, 빌드 스크립트 |
| | `mcp-connector` | (옵션) 클라우드 저장 백엔드 MCP |
| | `ui-ux-designer` | 툴바·패널·트리뷰 인터페이스, `aa design` 으로 시안 |
| | `prompt-engineer` | PROMPT.md 페이즈 프롬프트 최적화·갱신 |
| | `qa-tester` | 페이즈 종료 게이트 — 3종 시나리오 |
| **운영/외부** | `content-scout` | 개발 로그 콘텐츠(Threads/LinkedIn "브라우저로 CAD를 짓다") |
| | `case-curator` | 페이즈별 교훈 → 케이스 스터디 (실패가 가장 비싼 자산) |
| | `trend-hunter` | WebGPU·WASM CAD·브라우저 3D 트렌드 추적 |
| | `brand-keeper` | 외부 발행물 톤 검수 |

**호출 원칙(CLAUDE.md §3 계승)**
- 한 작업 동시 호출 **최대 5명**.
- 복잡 추론(아키텍처 결정, 커널 디버깅)만 Opus, 평소 sonnet.
- 에이전트 간 직접 통신 금지 — 모두 `shared-memory` 경유.
- 페이즈 사이엔 항상 **기영님 검토 포인트**.

---

## 4. 픽킹 / 테셀레이션 메타데이터 규약 (전 페이즈 공유)

이 규약을 Phase 0~1 에서 확정하고 **절대 흔들지 않는다**. 이게 흔들리면 편집 기능 전체가 무너진다.

워커가 반환하는 테셀레이션 페이로드 표준 포맷:

```ts
interface TessellatedMesh {
  positions: Float32Array;   // xyz 평탄 배열
  normals:   Float32Array;
  indices:   Uint32Array;    // 삼각형 인덱스
  // 토폴로지 역추적 — 핵심
  triFaceId: Uint32Array;    // 삼각형 i → 소속 faceId
  faceRanges: { faceId: number; start: number; count: number }[]; // 면별 삼각형 범위
  edges: { edgeId: number; polyline: Float32Array }[];            // 모서리 폴리라인
  shapeId: string;           // 소속 솔리드 ID
}
```

- **삼각형 → faceId**: raycast 적중 삼각형 인덱스로 `triFaceId` 조회.
- **모서리 픽킹**: `edges` 폴리라인에 별도 라인 지오메트리, 화면거리 임계로 선택.
- **faceId/edgeId 안정성**: OCCT `TopExp_Explorer` 순회 순서를 결정론적으로 고정.
  같은 형상이면 같은 ID 가 나와야 편집이 일관된다.

---

## 5. 메모리 / 산출물 위치

| 무엇 | 어디 |
|---|---|
| 코드 | `projects/web-3d-modeler/app/` |
| 페이즈 교훈 | `shared-memory/insights/{date}-nebula-phaseN.md` |
| 실패 케이스 | `shared-memory/meta/` (가장 비싼 자산) |
| 일일 진행 | `shared-memory/daily-logs/{date}.md` |
| UI 시안 | `content/designs/` (`aa design --system alien-agentic`) |
| 개발 로그 콘텐츠 | `content/` |

---

## 6. 정의 완료(Definition of Done) — 페이즈 공통 체크리스트

페이즈를 "끝났다"고 부르려면 **전부** 충족:

- [ ] tsc strict 통과 (any 0건)
- [ ] vitest 커널 단위테스트 통과
- [ ] playwright E2E 통과 (수직 슬라이스 실제 동작)
- [ ] OCCT 객체 해제 누락 0건 (메모리 점검)
- [ ] **디바이스 매트릭스 통과** — iPad Safari · Galaxy Tab Chrome · Z Fold 6(접힘+펼침)
      에서 해당 페이즈 기능 동작 (실기 또는 시뮬레이터/반응형 모드)
- [ ] **입력 매트릭스 통과** — 마우스 · 손가락 · 펜(Pencil/S Pen) 각각에서 조작 확인
- [ ] qa-tester 3종 시나리오(정상·예외·악성) 통과
- [ ] PR(draft) 생성 + 페이즈 완료 기준 충족
- [ ] 교훈 1개 이상 `shared-memory/insights/` 기록

---

## 7. 첫 스프린트 — 지금 당장 (Phase 0)

| 순서 | 작업 | 담당 |
|---|---|---|
| 1 | `app/` Vite 스캐폴드 + 의존성 + AA 디자인 토큰 | automation-coder |
| 2 | 뷰포트(카메라·그리드·조명·기준평면) | automation-coder + ui-ux-designer |
| 3 | **입력 추상화(Pointer Events) + 반응형 셸** | automation-coder |
| 4 | OCCT WASM 워커 로딩 + makeBox PoC | automation-coder |
| 5 | 테셀레이션 메타데이터 포맷 v0 확정 (§4) | (기영님 검토 포인트) |
| 6 | **태블릿 WASM 메모리 실측** (iPad/Galaxy Tab) | automation-coder |
| 7 | "Add Box" 수직 슬라이스 완성 + 디바이스/입력 게이트 | qa-tester |

> 한 번에 너무 많이 욱여넣지 않는다 (ADHD 시작 마찰). 1번부터, 박스 하나 띄우는 것까지가 첫 목표.
> 단, 이번엔 그 박스가 **세 디바이스에서 손가락으로 돌아가는 것**까지가 Phase 0 의 끝이다.
