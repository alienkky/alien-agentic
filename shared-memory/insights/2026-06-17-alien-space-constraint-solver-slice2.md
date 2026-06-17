# ALIEN SPACE — 구속 솔버 슬라이스 2 (스케치 연결 · 수평/수직 적용)

날짜: 2026-06-17
이슈: ALI-111 (Phase 2)
브랜치: `agent/agent/6a9cad5a`
요청: 기영님 "쉐이퍼 3D 구속조건과 동일하게 만들어줘"

## 핵심 — 데이터 모델의 매듭
스케치는 **독립 폴리라인**(`SketchPoint[][]`)으로 저장된다. 정점이 공유되지 않아, 원래는 한 변을 펴도 옆 변이 안 따라온다. Shapr3D 파라메트릭 구속의 본질은 **공유 코너**다.

→ 풀이: 솔버에 넘기기 직전 **가까운 정점을 한 점으로 병합**하는 브릿지(`extractVertices`, tol 0.6). 코너가 한 솔버 점이 되니, 한 변을 수평으로 풀면 붙은 변이 코너를 따라 같이 움직인다. 되쓰기(`applyToStrokes`)는 전역 정점 인덱스로 모든 스트로크에 동기 반영.

## 무엇을 만들었나
- `kernel/sketchConstraints.ts` (순수): `extractVertices`(공유정점 병합) · `applyToStrokes`(되쓰기) · `buildSegmentSolve`(세그먼트 H/V + 앵커) · `autoSegKind`(각도로 H/V 자동).
- store `applySketchConstraint(kind: 'horizontal'|'vertical'|'auto')`: 선택 세그먼트를 자체 솔버로 재해. 앵커(첫 점) 고정 → 예측 가능하게 펴짐.
- `SketchConstraintsPanel`: "수평/수직"(⇧V) 버튼을 **실제 동작**으로 연결. 나머지(평행·접선·일치 등)는 정직하게 "준비 중" 회색.

## 결정 / 정직함
- **이번은 apply-on-demand**: 버튼 누르면 그 순간 풀어 좌표를 굳힌다. Shapr3D 처럼 *구속이 영구 저장돼 드래그마다 라이브 재해*되는 건 다음 슬라이스(영구 구속 스토어 + 드래그 훅). "되는 척" 안 하려고 명시 분리.
- **자동 구속(그릴 때 H/V 자동 부여)는 이번에 안 넣음** — 커밋 경로를 건드리면 typed-dim e2e(드래그→사각형) 회귀 위험. 다음 슬라이스에서 게이팅과 함께.

## 검증
tsc strict 0 · vitest **155/155**(신규 7: 브릿지) · vite build · e2e desktop(구속 신규 1 포함).
커밋: (이 작업)

## 다음 (슬라이스 3+)
- **영구 구속 스토어**: `sketchConstraints: AppliedConstraint[]` + 드래그 중 라이브 재해(잡은 점 fixed).
- 자동 구속 추론(커밋 시 H/V/일치) — prefs.auto 게이팅, 회귀 테스트 추가.
- 다중 선택 → 평행·수직(직각)·동일(길이)·대칭. 구속 글리프 렌더(showConstraints).
- 구속 핫키(⇧A/⇧P/⇧T…), 구성선 변환, 박스 선택.
