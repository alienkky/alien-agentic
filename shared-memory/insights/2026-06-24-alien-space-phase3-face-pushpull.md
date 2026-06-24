---
date: 2026-06-24
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 3 슬라이스 2
author: automation-coder
---

# ALIEN SPACE Phase 3 슬라이스 2 — 면 Push/Pull 교훈

## 한 일
- 선택한 **평면 면 1개**를 면 법선 방향으로 밀고(−)/당겨(+) 형상 변형.
- 순수 커널 `kernel/facePushPull.ts`: 평면 판정·평면 추출·FAST 메시 변형·부피 계산·검증.
- OCCT 경로: `BRepPrimAPI_MakePrism`(면×벡터 압출) + 당기기=Fuse / 밀기=Cut. facade에 `gp_Vec`·`BRepPrimAPI_MakePrism`·`collectFaces` 추가, `occtFacePushPull`.
- FAST 경로: 면이 놓인 평면 위의 **모든** 정점·모서리 점을 법선×거리로 평행이동 → 각형 솔리드가 닫힌 채로 자란다/줄어든다.
- UI: 면 선택 시 ContextBar에 Push/Pull 버튼 + `FacePushPullDialog`(부호 있는 거리) + `FacePushPullDragLayer`(법선 핸들·라이브 프리뷰, 드래그 중 `gizmoDragging`로 카메라/픽킹 차단).
- 검증: tsc strict 0 · vitest 136 (push/pull 신규 11) · build 성공 · e2e 스모크 2/3(galaxy-tab는 선행 깨짐, 아래).

## 교훈

### 1. 메시 push/pull의 핵심은 "면 정점"이 아니라 "평면 위 모든 정점"을 옮기는 것
- 테셀레이션은 면마다 정점을 따로 복제한다(공유 안 함). 선택 면 정점만 옮기면 측벽과 틈이 벌어진다.
- 대신 **선택 면이 놓인 평면 위(off≈0)의 모든 정점**(측벽 위 모서리 포함)을 함께 옮기면 prism이 닫힌 채 자란다 → 부피 변화가 정확. faceId/edgeId/indices는 그대로 두고 좌표만 → 토폴로지 재발급 일관성.
- "평면 위" 허용오차는 면 반지름 비례(`PLANAR_TOL*maxRad`). 반대편 평행 면(간격 더 큼)은 안 건드린다.

### 2. 헤드리스에서 검증 가능한 건 FAST(결정론) 경로 — 그게 단위테스트 대상
- 실제 B-rep 프리즘은 65MB WASM(디바이스 게이트). 그래서 DoD의 2건(오프셋 후 부피↑ / 비평면 거부)을 메시 경로로 못 박았다: 박스 +Z 면 +2 당기기 → 64→96, 구 단일 면 → 비평면 거부.
- 부피는 발산정리(`Σ a·(b×c)/6`)로 결정론 측정. 평면 판정은 정점의 면-평면 편차 최대값.

### 3. OCCT push/pull 부호 = 압출 벡터 부호 (별도 분기 불필요)
- 압출 벡터 = `법선 × distance`. 당기기(+)는 바깥 프리즘→Fuse, 밀기(−)는 안쪽 프리즘→Cut. op만 부호로 가른다.
- 메모리 규약 try-finally 두 겹: 수집 Face 전부·gp_Vec·prism·boolean maker .delete(), 입력 셰이프 소비 → 누수 0.

### 4. ALI-115(필렛) 위에 쌓음 — 같은 커널 편집 경로 충돌 회피
- 베이스 브랜치 `agent/agent/562083c0`(커밋 `1361ce7`) 위에서 분기. 필렛/Shell/로프트 미접촉.
- `collectFaces`는 `collectEdges`와 같은 "순서 계약"(explorer 순회 = faceId N) 재사용 — 별도 레지스트리 없음.

## 남은 것 (디바이스 게이트 — 이월)
- OCCT 토글 → 박스 면 실제 B-rep push/pull 실동작(기영님 디바이스, 65MB WASM).
- e2e 스모크 **galaxy-tab(태블릿 뷰)** 선행 깨짐: 우측 ItemsPanel 오버레이가 "삽입" 플라이아웃의 "박스" 클릭을 가로챔. clean ALI-115 base에서도 동일 재현 → 내 변경과 무관. desktop-chrome·ipad는 통과. 반응형 레이아웃 z-index/포인터 이슈로 별도 처리 필요(스코프 밖).
