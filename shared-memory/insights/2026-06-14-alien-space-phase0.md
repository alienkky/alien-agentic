---
date: 2026-06-14
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 0
author: master-orchestrator
---

# ALIEN SPACE Phase 0 — 토대 착수 교훈

## 한 일
`projects/web-3d-modeler/app/` 에 Phase 0 수직 슬라이스를 풀 스크립트로 구현:
- 입력 토대(Pointer Events 추상화·제스처·입력별 픽킹 허용오차)
- 디바이스 토대(폴더블 posture/세그먼트 감지 + 폴백, 워커 풀 크기)
- 커널 워커(Comlink) + 브릿지 + 백엔드 스위치(결정론적 / OCCT)
- 뷰포트(three/r3f, 구면 카메라, 그리드, 조명) + 면 픽킹 하이라이트
- AA 디자인 토큰, 툴바/상태바

## 검증 (헤드리스 컨테이너에서 가능한 범위)
- tsc strict: **0 에러** (noUncheckedIndexedAccess 포함)
- vitest: **23/23 통과** (박스 메타데이터 포맷·제스처·카메라·폴더블)
- vite build: **성공** — 워커 분리 번들, OCCT wasm 지연 청크(65MB)

## 교훈 3가지

### 1. opencascade.js 1.1.1 은 타입이 없고 wasm 이 65MB다
- `.d.ts` 미제공 → 우리가 호출하는 부분만 facade 인터페이스로 좁혀 캐스팅 격리(`occtModule.ts`).
- 65MB wasm → **동적 import 로 지연 로드**. OCCT 백엔드를 켤 때만 청크를 가져온다.
  기본 백엔드는 결정론적 테셀레이터 — OCCT 없이 전 디바이스 즉시 동작.
- 팩토리는 emscripten 모듈(`export default opencascade`). vite 의 바보 같은 함정:
  패키지 index.js 의 bare `.wasm` import 는 vite 에서 URL 이 아니라 init 함수를 줘서 깨진다
  → index.js 우회, `?url` 로 직접 wasm 경로를 잡고 `locateFile` 로 주입.

### 2. 헤드리스 컨테이너 = 브라우저/OCCT 런타임 검증 불가
- chromium 다운로드·apt 의존성이 네트워크 정책에 막힘(403). Playwright E2E 와
  OCCT WASM 실행은 **디바이스/CI 단계**로 분리해야 한다.
- 그래서 Phase 0 설계 시 "검증 가능한 것(입력·디바이스·픽킹 파이프라인)"과
  "디바이스에서만 검증되는 것(OCCT 실렌더·터치·폴더블)"을 처음부터 갈라두는 게 옳았다.
- **결정론적 백엔드를 기본으로 둔 판단이 핵심** — 이게 없었으면 Phase 0 를 여기서
  전혀 증명 못 했을 것이다. 진짜 CAD(OCCT)는 swap-in 으로 남긴다.

### 3. 입력·디바이스를 Phase 0 로 끌어올린 결정이 맞았다
- 카메라 조작을 OrbitControls 가 아니라 우리 Pointer Events 추상화 위에 직접 올렸다.
  덕분에 펜/손가락/마우스 분기와 입력별 허용오차가 처음부터 한 코드 경로에 들어갔다.
- 나중에 끼웠으면 카메라·픽킹을 전부 재작업해야 했다. (REVIEW F1 의 실증)

## 남은 것 (다음)
- **디바이스 매트릭스 (기영님 실기)**: iPad/Galaxy Tab/Z Fold 6 에서 렌더·터치·접고펴기 확인
- OCCT 백엔드 런타임 검증 (박스 실제로 뜨는지) + facade 시그니처 보정
- 모서리 폴리라인을 OCCT 경로 faceRanges 에 채우기(TopAbs_EDGE 탐색)
- 태블릿 WASM 메모리 실측 (실기 필요)
