---
date: 2026-06-17
project: ALIEN SPACE (웹 3D 모델러, 자체 IP)
phase: Phase 2 — 그리드 & 스케치 설정 슬라이스
author: automation-coder
task: ALI-111 (T-20260614-004)
source: Shapr3D 튜토리얼 "Grid, Sketch Settings, Sketch Constraints"
---

# Shapr3D "그리드 & 스케치 설정" 튜토리얼 — 구현 슬라이스 교훈

## 배경
기영님이 Shapr3D 튜토리얼(grid·sketch settings·constraints) 전체 스크립트를 던지며 "이 기능들 구현해줘".
영상 1편에 ~25개 기능이 섞여 있어, **구속 솔버(PlaneGCS)가 필요한 것**과 **설정/표시만으로 되는 것**을 갈라
*솔버 없이 결정론적으로 완성되는 절반*만 한 슬라이스로 끊어 구현했다. (automation-coder 원칙: 판단=AI, 반복=코드 — 솔버는 별도 에픽)

## 한 일 (솔버 불필요, 전부 결정론적)
1. **직교/원근 투영 토글** (영상 01:56) — store `projection` + `setProjection/toggleProjection`.
   Scene 이 직교일 때만 drei `OrthographicCamera makeDefault` 렌더(언마운트 시 Canvas 원근으로 복원).
   CameraRig 가 매 프레임 `orthoZoom(viewportH, radius)` 로 zoom 을 맞춰 — 직교에서도 마우스 줌이 먹힌다.
2. **그리드 크기 잠금** (영상 02:54) — store `gridLock`. `gridCellSize(radius, lock)` (lock→1, else adaptive).
   Scene·SketchLayer 그리드 양쪽에 적용. ViewportControls 의 "그리드 크기 잠금" 토글이 잘못 `snap.grid` 에
   매여 있던 것을 `gridLock` 으로 바로잡음.
3. **키보드 단축키** (영상 04:20·05:17·05:48) — `resolveShortcut(key, mods, ctx)` 순수 함수 + `useKeyboardShortcuts` 훅.
   스케치 도구 핫키(L/A/I/R/C/G/T)·Ctrl+Z·Ctrl+A·Esc. 입력 포커스/치수 편집 중엔 전면 차단.
4. **단위 → 치수 표기 연동** (영상 02:54) — `units.ts`(formatLength/convertLength/toMm). mm 가 내부 기준,
   표시·입력은 사용자 단위(mm/cm/m/in/ft). SketchLayer·MeasureLayer·ExtrudeDragLayer 라벨 + 편집 입력 전부 연동.

## 교훈

### 1. 영상 1편 = 한 슬라이스 아님. "솔버 경계"로 자른다
- 튜토리얼은 grid·settings·constraints 를 한 호흡에 보여주지만, *접선·수직·평행·일치 자동 구속*과
  *끝점/중점 스냅*, *박스 교차 선택*은 전부 기하 구속 솔버(PlaneGCS, 명세 Module 7)를 전제한다.
  솔버 없이 흉내내면 "되는 척"하다 어긋난다. → **솔버 없는 설정/표시 기능만** 먼저 완결하고, 구속은 별도 에픽으로 정직하게 분리.
- 가른 기준: "같은 입력 → 같은 출력이 코드만으로 자명한가?" 그렇다(투영·그리드·핫키·단위) → 지금. 아니다(구속 만족) → 솔버 에픽.

### 2. 내부 단위는 mm 하나로 고정, 변환은 *경계에서만*
- 좌표·치수·스토어 전부 mm. `formatLength`(표시)·`toMm`(입력 커밋)으로 **표시/입력 경계에서만** 변환.
  이렇게 안 하면 cm 로 저장된 값에 in 로 그린 값이 섞여 도형이 망가진다. 라운드트립 단위테스트로 못 박음.
- 편집 입력도 단위 공간에서 받되 커밋 직전 `toMm`. 거부 정책(음수·0·NaN)은 mm 변환 후에도 그대로 — `toMm(NaN)=NaN`, `toMm(0)=0` 이라 store 거부 로직이 단위와 무관하게 작동.

### 3. 직교 카메라는 거리로 줌이 안 된다 — zoom 으로 흉내
- 구면 카메라(azimuth/polar/radius)는 radius 로 원근 줌을 한다. 직교는 거리와 무관하므로 화면이 안 변한다.
  `zoom = viewportHeight / (2·radius·tan(fov/2))` 로 타깃 평면에서 보이는 세로 범위를 원근과 맞춰, radius 변화가
  그대로 직교 zoom 으로 이어지게 했다. drei OrthographicCamera 의 기본 프러스텀이 픽셀 단위라 zoom 이 px/unit 로 작동.

### 4. drei makeDefault 복원은 "조건부 마운트"로
- 직교 토글 OFF 시 `makeDefault=false` 로 두면 이전 카메라로 안 돌아갈 수 있다.
  `projection==='orthographic' && <OrthographicCamera makeDefault/>` 로 **마운트 자체를 조건부**로 하면
  언마운트 때 drei 가 Canvas 의 원근 카메라를 자동 복원한다. 토글이 깔끔.

## 남은 것 — 구속 솔버 에픽 (다음 큰 덩어리)
영상의 나머지 절반은 전부 PlaneGCS 급 2D 구속 솔버를 전제한다. 별도 에픽으로:
- 자동 구속(auto-constraints): 수평/수직/평행/수직(perpendicular)/접선(tangent)/일치(coincident)
- 스케치 가이드 선(보라색 연장선)·끝점/중점 스냅·스냅핑 힌트 툴팁
- 박스 선택(좌→우 포함 / 우→좌 교차), 끝점을 원점에 끌어다 붙이고 잠금(lock)
- 구속 핫키(Shift+P 등)·항상 구속 표시·구성선(construction line) 변환
- 단면/뷰 큐브(3D nav cube) 인터랙션은 별개 UI 에픽

## 검증
- tsc strict 0 · vitest 114/114 (신규 14: units 4, keyboard 6, cameraMath 2, store 2) · vite build · e2e 슬라이스 4/4.
- 알려진 미해결: `tests/e2e/smoke.spec.ts` 의 "박스 (Box)" 셀렉터가 LeftToolbar 리뉴얼(플라이아웃 "박스") 후 어긋남 — 이 슬라이스 외, 별도 정리 필요.
