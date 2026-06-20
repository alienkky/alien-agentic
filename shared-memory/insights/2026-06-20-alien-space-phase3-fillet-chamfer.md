---
date: 2026-06-20
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 3 슬라이스 1
author: automation-coder
---

# ALIEN SPACE Phase 3 슬라이스 1 — 모서리 필렛/모따기 교훈

## 한 일
- OCCT 경로: `BRepFilletAPI_MakeFillet`(모서리+반지름) / `BRepFilletAPI_MakeChamfer`(거리)
  facade 추가 + `occtFillet`/`occtChamfer`. 결과 재테셀레이션으로 faceId/edgeId 재발급.
- **edgeId → TopoDS_Edge 역매핑**: 별도 레지스트리를 만들지 않고, 테셀레이션의 모서리 explorer와
  **동일한 순회**(`TopExp_Explorer(shape, TopAbs_EDGE)` + `TopoDS.Edge`)를 재실행해 N번째 = edgeId N.
- FAST(메시) 경로: 임의 모서리 필렛 **명확히 거부** — OCCT WASM import *전에* 백엔드 가드.
- UI: 모서리 선택 시 ContextBar에 필렛/모따기 버튼 + `EdgeFeatureDialog`(단일 수치) + 다중 모서리.
- 검증: tsc strict 0 · vitest 125 (필렛/모따기 신규 8, 기존 117) · build 성공 · e2e 스모크 통과.

## 교훈

### 1. 모서리 역매핑은 "레지스트리"가 아니라 "순서 계약"으로 푼다
- edgeId 는 테셀레이션 때 explorer 순서로 0..N 부여된다. 필렛도 **같은 셰이프에 같은 explorer**를
  돌리면 같은 순서가 보장된다 → 별도 핸들 저장 없이 edgeId 로 TopoDS_Edge 를 되찾는다.
- TopExp_Explorer 는 내부 Map 으로 중복(두 면 공유 모서리)을 제거 → 모서리당 1회, 결정론적.
- 전제: 필렛 수집 루프가 registerAndTessellate 모서리 루프와 **한 글자도 다르면 안 됨**. 주석으로 못 박음.

### 2. "FAST 거부"는 헤드리스에서 검증 가능한 유일한 핵심 — WASM import 전에 가드
- 실제 필렛 기하(BRepFilletAPI)는 65MB WASM 이라 CI/vitest 에서 못 돈다(디바이스 게이트).
- 하지만 "FAST 모드 거부"·"모서리 id 정규화(중복·범위밖 제거)"·"면수 증가 불변식"은 순수 로직 →
  `kernel/edgeFeature.ts` 로 분리해 단위테스트 대상으로 끌어냈다. 워커는 이 가드를 import 전에 호출.
- 둥근 박스(RoundedBox 프리미티브)와 혼동 금지: 거부 메시지에 "둥근 박스가 필요하면 RoundedBox" 명시.

### 3. 메모리 규약은 try-finally 두 겹 — maker + 수집 Edge 전부
- `BRepFilletAPI_*` maker, collectEdges 가 만든 모든 TopoDS_Edge, explorer 를 finally 에서 .delete().
- 입력 셰이프는 불리언과 동일하게 **소비**(결과로 대체) → shapeStore 누수 0.

### 4. 스모크가 UI 진화에 뒤처져 있었다 (스코프 밖이지만 DoD 게이트)
- 기존 e2e 스모크가 옛 버튼 라벨("박스 (Box)")을 찾고 있었다 — 프리미티브가 "삽입" 플라이아웃으로
  이동한 뒤 깨진 채 방치. 이번에 현행 UI(플라이아웃 → 박스/실린더)로 갱신. 내 변경과 무관한 선행 깨짐.

## 남은 것 (디바이스 게이트 — 이월)
- OCCT 토글 → 박스 8모서리 필렛/모따기 **실동작** (기영님 디바이스 런타임, 65MB WASM).
- 필렛 결과 면수 증가·모서리 재발급의 **기하학적 실측**(헤드리스에서 불가, 디바이스에서 확정).
- 다음 슬라이스: 면 push/pull (별도 이슈, 이번 스코프에서 손대지 않음).
