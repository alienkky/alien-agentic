# ALIEN SPACE — 네비큐브 (Shapr3D "View Controls" 튜토리얼 슬라이스)

날짜: 2026-06-17
이슈: ALI-111 (Phase 2)
브랜치: `agent/agent/6a9cad5a`

## 맥락
기영님 요청: "다음 튜토리얼 영상 참조하여 미구현된 것 진행". 직전 영상(grid·sketch settings·constraints)의 마지막 자막이 *"Come back next for view controls."* → 다음 챕터 = **View Controls**. 영상 1편이 이미 뷰 오리엔테이션 큐브 동작을 충분히 묘사(면/모서리/꼭짓점 클릭, 더블클릭=기본뷰, 화살표 스핀, 드래그=Space Mouse)했기에 별도 자막 없이 구현.

## 무엇을 만들었나
- `viewport/navCubeData.ts` (순수): 6면 + 8꼭짓점 방향 데이터, `cubeTransform(az,polar)` CSS-3D 회전, `cornerTransform`.
- `viewport/cameraMath.ts`: `viewDirection(state, dir)` — 임의 바깥 방향에서 타깃 바라봄(면=축1·모서리=축2·꼭짓점=축3 공통). `spinView(state, dir)` — 90° 단위 스핀.
- store: `setViewDir` / `spinView` 액션.
- `viewport/NavCube.tsx`: CSS-3D 큐브 위젯. 면/꼭짓점 클릭→스냅, 드래그→orbit, 더블클릭→기본 뷰, 둘레 4화살표→스핀. 큐브가 카메라 방향을 거울처럼 반영.

## 결정 / 교훈
1. **클릭 매핑을 방향 벡터 하나로 통일** — 면·모서리·꼭짓점을 `viewDirection` 한 함수로 처리. ViewPreset 열거에 모서리/꼭짓점을 끼워넣는 것보다 확장성·테스트성이 높다.
2. **짐벌락 가드는 수평성분으로** — `Math.hypot(d[0],d[2]) < eps` 일 때만 azimuth 유지. 처음엔 `sinP < eps` 로 했다가 polar 클램프(0.02) 때문에 순수 위/아래에서 방위각이 0으로 튀는 버그. (단위테스트가 잡음)
3. **CSS-3D 위젯 + Playwright** — 합성 클릭의 *좌표 히트테스트*가 3D 큐브 래퍼에 가려 면/화살표 클릭이 래퍼로 흘러 무반응. force 클릭도 좌표 기반이라 동일. 해결: e2e 는 `locator.dispatchEvent("click")` 로 **대상 엘리먼트에 직접 디스패치**(배선만 검증), 기하/가시성은 `navCubeData` 단위테스트가 담당. 실브라우저는 preserve-3d 네이티브 히트테스트라 사용자 클릭 정상.

## 검증
- tsc strict 0 · vitest **134/134** (신규 10: navCubeData 면/꼭짓점/스핀/CSS변환) · vite build
- playwright desktop-chrome: 슬라이스 4 + **navcube 2** = 6/6
- (pre-existing: 레거시 `smoke.spec` 의 "박스 (Box)" 라벨은 현 UI(플라이아웃)와 어긋나 baseline 에서도 실패 — 이 슬라이스 무관. baseline 대조로 확인.)

## 남은 것 (이 영상 챕터 내)
- 모서리(12) 클릭 핸들 — 데이터는 있으나 위젯엔 면+꼭짓점만 노출.
- 표준 뷰 네이밍 리스트(이미 ViewportControls 팝업에 존재), Space Mouse 하드웨어.
- **여전히 분리 대기**: 2D 구속 솔버 에픽(planegcs vs 자체) — 자동구속 지속성·박스선택·구성선.
