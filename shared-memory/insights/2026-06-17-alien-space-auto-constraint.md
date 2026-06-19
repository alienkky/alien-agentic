# ALIEN SPACE — 자동 구속 (그릴 때 H/V 자동 정렬)

날짜: 2026-06-17
이슈: ALI-111 (Phase 2)
브랜치: `agent/agent/6a9cad5a`
요청: 기영님 "2,3번 진행" → Q2(다음 구속) 중 **자동 구속** 선택 + Q3(npm run dev 방법 안내).

## 무엇을 만들었나
선(line) 도구로 그린 폴리라인을 확정하는 순간, **축에 가까운(±8°) 세그먼트를 자체 솔버로 정확히 수평/수직 정렬**. Shapr3D "자동 구속조건"(설정 토글 이미 존재, `prefs.auto`)과 결을 맞춤.
- `kernel/sketchConstraints.ts`: `nearAxisKind`(8° 이내만 H/V, 대각 null) · `buildAutoConstraints`(스트로크의 축 근접 세그먼트 → 구속).
- store `autoConstrainStroke(strokeIdx)`: 갓 확정한 선만 정렬. 호출 시점 — `sketchClickPoint`(끝점 재클릭 확정) + `finishLine`, `tool==='line' && prefs.auto` 게이팅.

## 핵심 결정 — 곡선 파괴 방지 (가장 중요한 함정)
스케치는 원/호/스플라인도 **전부 폴리라인**으로 저장된다. 자동 구속을 스케치 전체에 돌리면 곡선의 축 근접 미세 세그먼트가 직선으로 스냅돼 **곡선이 망가진다.**
→ 방어 2겹:
1. **line 도구 스트로크만** autoConstrainStroke 호출 (호/스플라인/사각형/원 제외).
2. 솔버에 넘길 때 **다른 모든 스트로크의 정점을 고정(fixed)** + 이 선의 첫 정점(앵커) 고정. 곡선·기존 도형은 한 점도 안 움직이고, 새 선의 자유 끝점만 H/V 로 정렬.
   - 공유 코너(새 선이 기존 도형에 붙은 점)는 기존 쪽 소유라 고정 → 기존 도형 불변, 새 선이 그 코너 기준으로 정렬.

## 회귀 안전
typed-dim e2e(사각형 드래그→W×H)는 rectangle 도구라 autoConstrainStroke 미호출 → 무영향. 확인됨.

## 검증
tsc strict 0 · vitest **158/158**(신규 3: nearAxisKind·buildAutoConstraints·자동풀이) · vite build · e2e desktop(자동구속 신규 1 포함).
커밋: (이 작업)

## 다음
- **다중 선택 관계 구속**(평행·직각·일치·동일) — 선택 모델을 단일→복수로 확장 필요(현재 dim 라벨 클릭=단일).
- **영구 구속 + 드래그 라이브 재해**(슬라이스 3) — Shapr3D "동일"의 마지막 핵심.
- 구속 글리프 렌더(showConstraints), 구속 핫키.
