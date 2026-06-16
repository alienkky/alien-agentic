---
date: 2026-06-16
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 2 슬라이스 3
author: automation-coder
task: ALI-111 (T-20260614-004)
---

# Phase 2 슬라이스 3 — 드래그 후 W×H/⌀ 타이핑 입력 교훈

## 한 일
- 스토어 상태 `sketchDimEdit` 추가: 드래그 종료 직후 `{ strokeIndex, kind, start, current, dimAt }` 로
  편집 세션을 열어두고, 입력이 들어오기 전까지 카메라/픽킹/선분 편집을 모두 묶어 둔다.
- `commitSketchDim(values)` / `cancelSketchDim()` — 정상값은 `regenStrokeByDim` 으로 stroke 재생성·교체,
  음수·0·NaN 은 거부하고 드래그 결과 그대로 유지. 같은 정책을 e2e 와 vitest 양쪽에서 검증.
- `SketchLayer` 의 `DimensionEditor` 오버레이 — rectangle/ellipse 는 W·H 두 칸, circle/polygon 은 ⌀ 한 칸.
  Tab 으로 칸 이동, Enter 커밋, Esc 취소. 입력 동안 pointer/key 이벤트 stopPropagation 으로 r3f 카메라 차단.
- `useCameraInput` 에 `sketchDimEdit` 가드 추가 — 단일 손가락/휠/포인터 이동 전부 차단.
- 새 도형 드래그가 편집 중 끼어들지 못하도록 `sketchDragStart` 와 `selectSketchSegment` 에도 가드.
- 테스트: vitest `useAppStore — 드래그 직후 W×H/⌀ 타이핑 입력` 6건(정상 rect, 정상 circle, 거부 음수/0/NaN,
  Esc 취소, 드래그 차단, 선분 편집 차단). 합계 100건 모두 그린.
- e2e: `tests/e2e/sketch-typed-dim.spec.ts` 2건 — 정상 입력으로 도형 갱신, 거부값에서 도형 유지.
  dev 전용 `window.__alienStore` 노출로 캔버스 3D 드래그를 결정론적 store 호출로 대체. 입력/포커스 자체는 실제 DOM 으로 검증.

## 교훈

### 1. r3f 안에 떠 있는 Html 입력은 "포커스 트랩"을 store 한 곳에서 다 해야 한다
- `<Html>` 은 캔버스 부모 div 의 자손이라 React 합성 이벤트가 그대로 위로 올라간다.
  처음엔 입력 onPointerDown 만 stopPropagation 했는데, `useCameraInput` 이 다른 손가락/휠로 들어오면 카메라가 움직이며
  포커스를 빼앗아 입력값이 날아갔다. → store 의 `sketchDimEdit` 플래그 한 줄을 카메라·드래그·선분 편집 모두가 보게 하니
  모든 입력 경로가 한 자리에서 차단된다. **"입력 위젯마다 stopPropagation"이 아니라 "활성 상태 한 자리에서 게이팅"**.

### 2. 거부 정책을 입력 컴포넌트가 아니라 store 에 박는다
- `parseFloat(text)` 검증을 입력 컴포넌트에서만 했으면, Tab/Blur/Enter 의 세 경로에서 정책이 미세하게 어긋났다.
  대신 `regenStrokeByDim(edit, values)` 가 정책 단일 출처가 되도록 했다. 컴포넌트는 그저 `commit([a,b])` 만 호출.
  단위테스트도 store 한 곳만 보면 끝. 컴포넌트 테스트는 DOM/포커스 같은 행동만 검증.

### 3. dev-only `window.__alienStore` — 캔버스 3D 좌표를 e2e 에 노출하지 말고 store 를 직접 찌른다
- r3f 캔버스 위에서 평면 픽킹 → 드래그를 좌표로 시뮬레이트하면 카메라 각도·뷰포트 사이즈가 살짝만 변해도 깨진다.
  도형 *생성 단계*는 store 액션으로 결정론적으로 만들고, 검증할 *UI 자체*(입력 박스 등장, Tab/Enter, 상태 갱신)는
  실제 DOM 으로 보는 분할이 안정적이다. `import.meta.env.DEV` 가드로 프로덕션에는 새지 않는다.

### 4. 기존 dev 서버가 다른 워크트리에서 5173 을 잡고 있을 때
- playwright `reuseExistingServer: true` 가 이미 떠 있는(다른 코드의) 서버를 그대로 잡았다 → 새 코드가 안 보였다.
  `PLAYWRIGHT_PORT` 환경변수로 포트를 분리할 수 있게 config 를 손봤다. 실수 비용이 크진 않지만, 자기 워크트리의 빌드가
  반영되는지 한 번 더 확인하는 습관이 필요하다.

## 남은 것 (슬라이스 4·5)
- 슬라이스 4: 끝점·중점 스냅 — 드래그 중 다른 획의 노드를 자동 흡착.
- 슬라이스 5: 면 위 스케치 자동화·디바이스 검증(터치/펜의 입력 박스 포커스).
- 단위 토글(mm/cm/in) 연동 — 지금은 mm 가정. TopMenuBar 우상단 토글이 들어오면 입력값 표시·파싱을 함께 변환.
- 기존 `tests/e2e/smoke.spec.ts` 의 "박스 (Box)" 라벨이 LeftToolbar 리뉴얼 후 "박스" 로 바뀌어 셀렉터가 어긋남 — 슬라이스 외 정리 필요.
