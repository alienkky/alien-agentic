# ALIEN SPACE — 구속 슬라이스 3 (영구 구속+드래그 라이브 재해) · 5-에이전트 병렬 빌드

날짜: 2026-06-17
이슈: ALI-111 (Phase 2)
브랜치: `agent/agent/6a9cad5a`
요청: 기영님 "너 혼자 하지말고 최대 5명까지 같이 진행"

## 협업 방식 — 충돌 없는 5-에이전트 팬아웃
구속 작업은 store/panel/SketchLayer 가 얽혀 단순 병렬 편집은 머지 지옥. 그래서 **독립 새 파일**로만 분해해 충돌을 0으로:
- 에이전트 1 (builder): `kernel/constraintsMulti.ts` — 다중 세그 평행/직각/일치 빌더 (8 테스트)
- 에이전트 2 (builder): `kernel/dragResolve.ts` — 정점 드래그 라이브 재해 코어 (3 테스트)
- 에이전트 3 (builder): `viewport/constraintGlyphs.ts` — 구속 배지 위치 계산 (6 테스트)
- 에이전트 4 (builder): `input/constraintHotkeys.ts` — ⇧A/⇧P/⇧V… 매핑 (7 테스트)
- 에이전트 5 (Explore): store/SketchLayer 와이어링 지점 정밀 조사 (읽기전용 플랜)

각 builder 는 *기존 파일 편집 금지·git 금지*, 자기 파일만 vitest. 결과 24 테스트 전부 그린. 그 다음 **내가(automation-coder) 통합** — 충돌 0.

교훈: 멀티 에이전트 병렬의 핵심은 **파일 소유권 분리**. 같은 파일을 여러 에이전트가 만지면 토큰만 태우고 머지에서 깨진다. "새 파일 + 순수 모듈 + 자체 테스트" 계약이 병렬을 안전하게 만든다. (단점: 에이전트들이 이슈에 결과 코멘트를 남겨 약간의 노이즈 — 다음엔 "코멘트 금지" 명시.)

## 통합으로 켜진 것 (slice 3)
- store `sketchConstraints: Constraint[]` 영구 보관 (begin/cancel/finish 리셋).
- `applySketchConstraint`/`autoConstrainStroke` 가 적용 구속을 **영구 저장**.
- store `dragSketchVertex(vertexIdx, target)` — 잡은 점 고정, 영구 구속 유지하며 재해 (dragResolve 사용). **Shapr3D 핵심 동작.**
- SketchLayer: `showConstraints` ON 일 때 구속 글리프 배지 렌더.
- ⇧V 핫키 → 선분 선택 시 H/V 자동 구속.

## 정직한 경계
- **정점을 캔버스에서 직접 잡아끄는 포인터 UI 는 보류** — 그리기 드래그와 모호하고 캔버스 e2e 로 검증 불가(수동 확인 필요). store 액션은 완성·테스트됨(주입 e2e). 포인터 그랩은 다음 슬라이스에서 호버 감지와 함께.
- 다중 선택(평행/직각/일치) 빌더는 준비됐으나 두-세그 선택 UI 미연결 → 패널 회색 유지.
- 구속 인덱스 remap(스트로크 추가/삭제 시)도 다음 — 현재는 구조 불변 드래그만.

## 검증
tsc 0 · vitest **182/182**(신규 24: 4 모듈) · build · e2e desktop(드래그 재해 신규 1 포함).
