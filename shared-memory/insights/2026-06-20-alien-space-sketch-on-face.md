---
date: 2026-06-20
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 2 / 슬라이스 5
author: automation-coder
---

# ALIEN SPACE 슬라이스 5 — 면 위 스케치 검수 교훈

## 한 일
- 슬라이스 5(면 위 스케치) 기능 코드는 PR #18("스케치 편집 전반")에 이미 포함돼 가동 중이었음:
  `beginSketch`가 선택 면→`planeFromFace`(법선·원점·직교 basis)→`alignToNormal` 카메라 정렬,
  `SketchLayer`가 평면 basis 행렬로 2D(u,v)↔3D를 일반화(`worldToPlane`/`planeToWorld`),
  `extrudeProfile`가 평면 법선 방향 돌출. 기준면(XY/YZ/XZ) 경로도 유지.
- DoD가 요구한 **평면 변환 단위테스트**가 비어 있어 `kernel/sketchPlane.test.ts` 신규(10건):
  ① 면 법선 평면 — 기울어진 면에서 정규직교 basis(u·v·n 단위·상호직교), origin=정점 centroid,
     Y평행 특이점 회피. ② 좌표 왕복 — 4개 평면에서 (u,v)→world→(u,v) 및 평면 위 점 왕복 보존.
- 낡아 깨져 있던 `tests/e2e/smoke.spec.ts`를 현재 플라이아웃 UI에 맞게 복구.
- 검증: tsc 0 · vitest 127/127 · vite build OK · e2e(desktop-chrome) green.

## 교훈

### 1. "슬라이스가 이미 큰 PR에 흡수됐는지" 먼저 확인 — 중복 구현 방지
- 큰 통합 PR(#18)이 인접 슬라이스 기능을 끌어들이는 일이 잦다. 착수 전 코드/테스트를
  먼저 읽어 "무엇이 이미 되어 있나"를 확정하면, 재구현 대신 **DoD 공백(여기선 전용 단위테스트)**
  만 메우면 된다. 헌법의 "원인→결과, 매듭을 본다"와 같은 결.

### 2. 평면 좌표 왕복 테스트는 "평면 위 점"만 보존된다 — 법선 성분은 소실
- `worldToPlane`는 (u,v) 2성분만 투영하므로 임의 world 점은 왕복 보존되지 않는다.
  테스트는 (u,v)→world→(u,v) 또는 *평면 위* world 점만 검사해야 거짓 실패가 없다.

### 3. UI 리팩터는 e2e 셀렉터를 조용히 썩힌다 — 게이트가 이를 잡아준다
- PR #18이 상단 버튼("박스 (Box)")을 좌측 플라이아웃으로 옮기며 스모크가 깨진 채 방치됐다.
  e2e 게이트가 없었다면 몰랐을 회귀. 셀렉터는 가능한 한 안정적 텍스트(상태 메시지·접근성 이름)에 건다.

## 남은 것 (슬라이스 5 밖)
- **반응형 z-순서 겹침**: 좁은 화면(galaxy-tab/ipad)에서 우측 항목 패널(absolute right-0)이
  좌측 툴바 플라이아웃을 덮어 클릭을 가로챈다 → 태블릿 e2e 매트릭스 실패. 별도 레이아웃 수정 필요.
- 면 위 스케치의 펜/터치 손맛은 기영님 디바이스 검증 대상(헤드리스 한계 동일).
