# automation-coder — learnings (무엇을 배웠나)

- 2026-06-20 · ALI-115 · **모서리 역매핑은 레지스트리가 아니라 "순서 계약"으로.** edgeId 는 테셀레이션
  explorer 순서로 부여된다 → 같은 셰이프에 같은 `TopExp_Explorer(shape, TopAbs_EDGE)`를 재실행하면
  N번째 = edgeId N. 별도 핸들 저장 없이 TopoDS_Edge 복원. (TopExp_Explorer 는 내부 Map 으로 공유 모서리 중복 제거 → 결정론적.)
- 2026-06-20 · ALI-115 · **헤드리스에서 검증 가능한 부분만 순수 함수로 분리.** OCCT 기하(65MB WASM)는 CI 불가지만
  "FAST 거부·id 정규화·면수 불변식"은 순수 로직 → `edgeFeature.ts` 로 빼서 단위테스트. 가드는 WASM import *전에* 호출.
