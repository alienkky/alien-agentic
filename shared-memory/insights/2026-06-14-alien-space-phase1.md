---
date: 2026-06-14
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 1
author: master-orchestrator
---

# ALIEN SPACE Phase 1 — 프리미티브 + 불리언 교훈

## 한 일
- 결정론적 프리미티브: 실린더(면3·모서리2)·구(면1·적도) 테셀레이터 + 메타데이터 불변식 테스트
- OCCT 백엔드 확장: **셰이프 레지스트리**(불리언이 B-rep 핸들을 유지해야 함) + 프리미티브 +
  불리언(Fuse/Cut/Common) + 모서리 추출(BRepAdaptor_Curve 샘플링)
- 셰이프 선택(불리언 대상 2개) + 모서리 LineSegments 렌더 + 틴트
- 검증: tsc 0 · vitest 32/32 · build 성공

## 교훈

### 1. 불리언은 "메시"가 아니라 "B-rep 핸들"에서 일어난다 → 워커에 셰이프 레지스트리 필수
- Phase 0 는 makeBox 가 메시를 만들고 셰이프를 버렸다. 불리언은 원본 TopoDS_Shape 끼리
  연산하므로 워커가 셰이프를 id 로 **보관**해야 한다. occtModule 에 shapeStore Map 추가.
- 결정론적 백엔드엔 B-rep 이 없다 → **불리언을 명확히 거부**(에러 메시지로 OCCT 토글 유도).
  이 경계를 흐리지 않은 게 중요. "왜 안 되지?"를 사용자가 바로 안다.

### 2. 백엔드 간 프리미티브 배치가 다르다 (OCCT 함정)
- OCCT `BRepPrimAPI_MakeBox(dx,dy,dz)` 는 **코너가 원점**(중심 X), MakeCylinder 는 **Z축 0..h**.
  우리 결정론적 박스/실린더는 원점 중심·Y축. → 같은 "박스"라도 두 백엔드에서 위치가 다르다.
- Phase 1 데모(구멍 뚫기)는 OCCT 전용이라, OCCT 배치 기준으로 보면 된다. 다만 깔끔한
  중심 관통 구멍은 gp_Trsf 이동이 필요 → Phase 1.5/디바이스 보정으로 이월.

### 3. 헤드리스 한계는 그대로 — OCCT 런타임은 여전히 디바이스 게이트
- Phase 0 "아주 잘됨"은 결정론적 경로. 불리언은 OCCT 가 실제로 돌아야 증명된다.
  이번에도 tsc/build 까지만 보장하고, "박스에서 실린더 빼기"는 기영님 디바이스에서 확정.

## 남은 것
- OCCT 불리언 런타임 검증(기영님) + 프리미티브 배치 보정(gp_Trsf)
- 모서리 폴리라인 OCCT 실측
- 이동/회전 기즈모(TransformControls) — Phase 1 잔여 또는 Phase 2 초입
