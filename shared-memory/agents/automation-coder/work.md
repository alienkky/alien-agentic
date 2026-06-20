# automation-coder — work (무엇을 했나)

- 2026-06-20 · ALI-115 ALIEN SPACE Phase 3 슬라이스 1 — 모서리 필렛/모따기.
  - `kernel/occt/occtModule.ts`: `BRepFilletAPI_MakeFillet/MakeChamfer` facade + `occtFillet`/`occtChamfer` + `collectEdges`(테셀레이션과 동일 explorer 순서로 edgeId↔TopoDS_Edge 역매핑). 메모리 try-finally 두 겹.
  - `kernel/edgeFeature.ts`(신규): 백엔드 가드(FAST 거부)·`resolveEdgeIds`·`faceCount` 순수 로직.
  - `kernel/types.ts`/`worker.ts`: FilletParams/ChamferParams + fillet/chamfer 디스패치(WASM import 전 가드).
  - `store/useAppStore.ts`: edgeFeatureOpen 상태 + open/close/applyEdgeFeature + selectionEdges 헬퍼.
  - `ui/ContextBar.tsx` 모서리 액션 + `ui/EdgeFeatureDialog.tsx`(신규) + App 마운트.
  - 테스트: `kernel/edgeFeature.test.ts`(8건) + 옛 e2e 스모크 현행 UI로 갱신.
  - 게이트: tsc strict 0 · vitest 125 · build · e2e 스모크 통과. OCCT 실동작은 디바이스 이월.
