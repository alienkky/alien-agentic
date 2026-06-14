# PLAN — 웹 기반 3D 모델러 (Shapr3D-like)

> 코드명: **ALIEN SPACE** (가칭) — 브라우저에서 도는 파라메트릭 솔리드 모델러.
> 작성: master-orchestrator · 2026-06-14 · 상태: 설계(Design)
> **소유: Alien Agentic 자체 IP** (클라이언트 납품물 아님 — 자체 제품/플랫폼)
> **타깃 디바이스 우선순위: iPad(Apple Pencil) → Galaxy Tab(S Pen) → Galaxy Z Fold 6(폴더블)**

---

## 0. 한 줄 정의

> iPad의 Shapr3D가 주는 "스케치 → 돌출 → 직접 편집"의 손맛을,
> 설치 없이 **브라우저 탭 하나**에서, 진짜 CAD 커널(B-rep) 위에서,
> **펜·손가락·폴더블 화면 어디서나** 돌린다.

### 0.1 두 가지 확정 전제 (기영님 결정 · 2026-06-14)

1. **AA 자체 IP.** 이건 클라이언트 일이 아니라 우리 제품이다. → 협업/클라우드(Phase 7)는
   "옵션"이 아니라 로드맵의 일부다. AA 브랜드 토큰·네이밍을 Phase 0부터 입힌다.
2. **터치·펜·폴더블 우선.** 데스크톱이 아니라 **태블릿/펜이 본진**이다. → Shapr3D의 본진인
   iPad를 1순위로, Galaxy Tab(S Pen) 2순위, Z Fold 6(접고 펴는 화면) 3순위로 잡는다.
   이 결정은 "입력·디바이스 토대"를 **Phase 6이 아니라 Phase 0으로 끌어올린다**(§2.5 참조).

---

## 1. 무엇을 만드는가 — Shapr3D 핵심 해부

Shapr3D를 단순한 "3D 뷰어"가 아니라 **CAD**로 만드는 본질은 다음 6개다. 이 순서가 곧 우리 개발 순서다.

| # | 기능 | 본질 | 난이도 |
|---|---|---|---|
| 1 | **스케치** | 평면 위 2D 프로파일 (선/호/원/스플라인) + 치수·구속 | ★★★★ |
| 2 | **돌출/회전** (Extrude/Revolve) | 2D 프로파일 → 3D 솔리드 | ★★★ |
| 3 | **직접 편집** (Push/Pull) | 면을 잡아당겨 형상 변형 | ★★★★ |
| 4 | **불리언** (Union/Subtract/Intersect) | 솔리드 합·차·교 | ★★ |
| 5 | **모따기/필렛** (Chamfer/Fillet) | 모서리 다듬기 | ★★★ |
| 6 | **입출력** (STEP/STL/IGES) | 산업 표준 교환 | ★★ |

핵심 통찰: **Shapr3D는 "풀 히스토리 파라메트릭"이 아니라 "직접 모델링(direct modeling) + 가벼운 히스토리"** 하이브리드다. 처음부터 SolidWorks급 완전 히스토리 트리를 노리면 빠져 죽는다. 우리도 **direct-first, history-light**로 간다.

---

## 2. 기술 스택 — 결정과 이유

| 레이어 | 선택 | 이유 / 대안 |
|---|---|---|
| **CAD 커널** | **OpenCascade.js** (OCCT 7.8 → WASM) | 진짜 B-rep. 박스/실린더/불리언/필렛/STEP I/O 전부 제공. 대안 Manifold(메시 불리언만, B-rep 없음)는 Phase 후반 성능용 보조로만. |
| **렌더링** | **Three.js** + **react-three-fiber** + **drei** | 사실상 표준. 카메라/기즈모/픽킹 생태계 풍부. |
| **UI 프레임워크** | **React 18 + TypeScript** + **Vite** | 빠른 HMR, WASM 친화. |
| **상태관리** | **Zustand** | 피처 트리·선택 상태를 가볍게. Redux는 과함. |
| **CAD 워커** | **Web Worker** (Comlink) | OCCT WASM은 무겁다 → UI 스레드 블로킹 절대 금지. 모든 커널 호출은 워커에서. |
| **입력 추상화** | **Pointer Events API** | 마우스·터치·펜을 하나의 이벤트 모델로. `pointerType`/`pressure`/`tiltX` 로 분기. |
| **폴더블 대응** | **Viewport Segments API** + **Device Posture API** | Z Fold 6 의 힌지·접힘 상태·화면 분할 대응. CSS `@media (horizontal-viewport-segments: 2)`. |
| **2D 구속 솔버** | **PlaneGCS** (FreeCAD 솔버 → WASM) | Phase 4에서. 초기엔 구속 없는 "자유 스케치"로 시작. |
| **스타일** | **Tailwind** + AA 디자인 토큰 | `aa design` 시스템과 정합. |
| **테스트** | **Vitest** + **Playwright** | 커널 단위테스트 + E2E 뷰포트 검증. |
| **배포** | 정적 SPA (Vercel/Netlify) + WASM CDN | 서버리스. 협업 단계에서만 백엔드 추가. |

### 아키텍처 데이터 흐름

```
[Feature Tree (JSON)]            ← 문서 모델 (저장 단위)
       │ evaluate (worker)
       ▼
[OCCT B-rep Shapes]             ← TopoDS_Shape 들
       │ BRepMesh tessellate
       ▼
[Three.js BufferGeometry + topo metadata]   ← 면/모서리 ID 매핑
       │ render
       ▼
[Viewport] ──pick(raycast)──▶ triangle→faceId/edgeId ──▶ 선택·편집
```

핵심 설계 원칙 4개:
1. **커널은 워커에만 산다.** UI는 메시와 메타데이터만 받는다.
2. **테셀레이션 시 토폴로지 ID를 심는다.** 삼각형 → 어느 면/모서리인지 역추적 가능해야 픽킹·편집이 된다.
3. **문서 = 피처 트리(JSON).** B-rep은 항상 트리에서 재생성 가능한 파생물. (저장은 트리만)
4. **재평가는 dirty 노드만.** 트리 일부 수정 시 전체 재계산 금지.

---

## 2.5 입력·디바이스 전략 — 본진은 펜과 손가락 (전 페이즈 관통)

> 이건 한 페이즈의 기능이 아니라 **모든 페이즈를 관통하는 제약**이다. Phase 0 뷰포트 뼈대를
> 짤 때부터 들어가야 나중에 갈아엎지 않는다. (Shapr3D가 강한 이유의 절반이 입력 설계다.)

### 타깃 3종과 각자의 본성

| 순위 | 디바이스 | 입력 | 화면 특성 | 핵심 대응 |
|---|---|---|---|---|
| 1 | **iPad** (Safari) | Apple Pencil (압력·기울기·hover) + 손가락 | 고정 비율 | Pencil=정밀 그리기, 손가락=궤도/팬 |
| 2 | **Galaxy Tab** (Chrome) | S Pen (압력·hover) + 손가락 | 고정 비율 | Pointer Events 로 iPad 와 통일 |
| 3 | **Galaxy Z Fold 6** (Chrome) | S Pen + 손가락 | **접힘(커버 ~6.3")↔펼침(~7.6")**, 힌지, posture | 펼침/접힘 resize, 화면 분할 레이아웃 |

### 입력 설계 3원칙

1. **Pointer Events 하나로 통일.** 마우스·터치·펜을 `pointerType` 으로 분기하되,
   코드 경로는 하나. `pen`/`mouse` = 정밀(픽셀~2mm), `touch` = 관대(약 10mm 히트 타깃).
   → **픽킹 허용오차(tolerance)를 입력 종류에 따라 동적으로** 둔다. 손가락으로 모서리를
   집으려면 히트 타깃이 두꺼워야 한다.
2. **펜 vs 손가락 역할 분리** (Shapr3D 의 핵심 손맛):
   - **펜/정밀 포인터** → 그리기·선택·치수
   - **빈 곳 손가락 드래그** → 궤도(orbit)
   - **두 손가락** → 팬, **핀치** → 줌
   - 손가락만 있는 상황(펜 없음)에선 모드 토글로 그리기/궤도 전환.
3. **압력·기울기 활용 (있을 때만, 우아한 degrade).** 펜 압력 → 스케치 굵기/스냅 강도 힌트.
   hover(Pencil Pro/S Pen) → 스냅 프리뷰. 없는 디바이스에선 그냥 안 쓴다.

### 폴더블(Z Fold 6) 전용 대응

- **펼침/접힘 = resize 이벤트.** 캔버스·레이아웃이 비율 급변에 깨지지 않게 반응형 셸.
- **Viewport Segments API** 로 힌지를 인지 → 펼친 상태에서 **한쪽 세그먼트=뷰포트,
  다른 쪽=툴/스케치 패널**로 분할(태블릿 모드/테이블탑 자세 활용). Shapr3D 의 분할 UX 변주.
- **Device Posture API** (`posture: folded`) 로 자세별 레이아웃. 미지원 브라우저는 단일 화면으로 폴백.
- 접힌 커버 화면(좁고 긴 비율)에선 핵심 도구만 노출하는 컴팩트 모드.

### 모바일/태블릿 성능 예산 (놓치면 본진에서 죽는다)

- **WASM 메모리.** OCCT + (Phase 4)PlaneGCS 두 WASM 이 태블릿 메모리를 압박. iOS Safari 의
  WASM 메모리 한계를 Phase 0에서 실측한다. PlaneGCS 는 **스케치 구속 모드 진입 시 lazy-load**.
- **적응형 테셀레이션 품질.** 태블릿 GPU 부하 관리 — 인터랙션 중엔 거칠게, 정지 시 곱게.
- **워커 풀** 크기를 디바이스 코어 수(`navigator.hardwareConcurrency`)에 맞춰 조절.
- **WebGPU 관망.** Three.js WebGPU 렌더러 성숙 시 태블릿 이득 가능 — Safari 지원 추적
  (`trend-hunter` 분기 과제). 당장은 WebGL2 기준.

---

## 3. 단계별 로드맵 — 7 페이즈

> 시간 추정은 **1.5~2배 보정** 반영 (1인 + AI 페어 기준).

### Phase 0 — 토대 (Foundation) · 약 2~3주
- Vite + React + TS + Three.js + r3f 스캐폴드 + **AA 디자인 토큰**(자체 IP 브랜딩)
- 뷰포트: 궤도 카메라, 그리드, 3점 조명, 기준 평면(XY/YZ/ZX)
- **OCCT WASM을 Web Worker에 로드**, Comlink 브릿지
- **입력·디바이스 토대(§2.5)를 여기서 깐다** — 끌어올린 핵심:
  - **Pointer Events 추상화 레이어** (마우스/터치/펜 통일, `pointerType` 분기)
  - 카메라 조작을 OrbitControls 대신/위에 **펜=정밀 / 손가락 드래그=궤도 / 두손가락=팬 / 핀치=줌** 매핑
  - **반응형 셸** — 폴더블 resize·Viewport Segments 인지(미지원 폴백 포함)
  - **WASM 메모리 실측** — iPad Safari / Galaxy Tab Chrome 에서 OCCT 로딩 한계 측정
- "박스 하나 생성 → 테셀레이션 → 화면 표시" **수직 슬라이스** 완성
- ✅ 완료 기준: **iPad Safari·Galaxy Tab Chrome·Fold 6** 에서 버튼 누르면 OCCT 박스가 뜨고,
  손가락으로 궤도·핀치 줌이 된다 (3종 디바이스 실기/시뮬레이터 확인)

### Phase 1 — 프리미티브 + 불리언 · 약 2~3주
- 프리미티브: 박스/실린더/구/콘 (`BRepPrimAPI_*`)
- 이동/회전/스케일 기즈모 (TransformControls)
- 불리언: Union/Subtract/Intersect (`BRepAlgoAPI_*`)
- **면/모서리 픽킹** (테셀레이션 토폴로지 ID 기반)
- ✅ 완료 기준: 박스에서 실린더를 빼서 구멍 뚫기

### Phase 2 — 스케치 + 돌출/회전 · 약 3~4주
- 평면 선택 → 스케치 모드 진입
- 2D 툴: 선·사각형·원·호 (구속 없는 자유 스케치)
- 프로파일 닫힘 감지 → wire → face (`BRepBuilderAPI_MakeFace`)
- 돌출(`BRepPrimAPI_MakePrism`) / 회전(`BRepPrimAPI_MakeRevol`)
- ✅ 완료 기준: 사각형 스케치 → 돌출 → 박스, 원 스케치 → 회전 → 원기둥

### Phase 3 — 직접 편집 · 약 3~4주
- 면 Push/Pull (오프셋·이동으로 형상 변형)
- 필렛/모따기 (`BRepFilletAPI_MakeFillet` / `MakeChamfer`)
- 선택 세트 관리(다중 면/모서리), 호버 하이라이트
- ✅ 완료 기준: 박스 모서리 8개 필렛, 면 하나 잡아당겨 키우기

### Phase 4 — 스케치 구속 · 약 3~4주
- PlaneGCS WASM 통합
- 구속: 수평/수직/평행/수직/동심/일치 + 치수(길이·각도·반지름)
- 구속 위반 시각화, 언더/오버 구속 상태 표시
- ✅ 완료 기준: 치수 바꾸면 스케치가 파라메트릭하게 갱신

### Phase 5 — 저장 + 입출력 · 약 2주
- 문서 저장/로드 (피처 트리 JSON, IndexedDB + 파일 다운로드)
- STEP/IGES 익스포트·임포트 (`STEPControl_*` / `IGESControl_*`)
- STL 익스포트 (3D 프린팅)
- 실행취소/다시실행 (트리 스냅샷 or 커맨드 패턴)
- ✅ 완료 기준: 모델 저장 → 닫기 → 다시 열기, STEP 내보내 외부 CAD에서 열림

### Phase 6 — 마감 + 디바이스 완성 · 약 3~4주
> 입력 토대는 Phase 0에 깔렸으므로, 여기선 **각 디바이스의 본성을 끝까지 살리는 마감**.
- 재질/PBR 머티리얼, HDRI 환경광, 측정 도구
- **펜 고급 입력**: Apple Pencil/S Pen 압력·기울기·hover 스냅 프리뷰
- **폴더블 분할 UX 완성**: Z Fold 6 펼침 시 세그먼트 분할(뷰포트↔툴), posture별 레이아웃
- **접힌 커버 화면 컴팩트 모드**
- 성능: 적응형 LOD, 메시 캐시, 워커 풀(코어 수 적응)
- 온보딩, 단축키, 다국어(ko/en)
- ✅ 완료 기준: iPad(Pencil)·Galaxy Tab(S Pen)·Fold 6(접고 펴기) 3종에서 스케치→돌출→필렛 전 과정 수행

### Phase 7 — 협업/클라우드 (자체 IP 핵심, 옵션 아님)
> AA 자체 제품이므로 이건 로드맵의 일부. 제품을 "도구"에서 "플랫폼"으로 만드는 자리.
- 실시간 공동 편집(CRDT), 클라우드 저장, 버전 관리, 공유 링크
- AA 계정/워크스페이스, 권한, 갤러리
- (사업 모델: 구독/시트 — `finance-tracker`·`sales-closer` 연계)

**총 추정: MVP(Phase 0~3) 약 10~14주, 완성형(~Phase 6) 약 19~26주** (1인+AI, 1.5~2배 보정 포함.
디바이스 토대 Phase 0 선반영으로 Phase 0 +1주, Phase 6 부담 감소 — 총량은 비슷)

---

## 4. 리스크 — 미리 알고 들어간다

| 리스크 | 영향 | 대응 |
|---|---|---|
| **OCCT WASM 번들 크기** (~30MB+) | 첫 로딩 느림 | 워커 lazy-load, gzip/brotli, CDN, 스플래시 로딩 |
| **OCCT 메모리 누수** (C++ 객체 수동 해제) | 장시간 세션 크래시 | 모든 `new`에 `.delete()` 래퍼, 객체 풀, 워커 주기적 재시작 |
| **2D 구속 솔버 난이도** | Phase 4 지연 | 구속 없는 자유 스케치로 MVP, 구속은 후순위 |
| **픽킹 토폴로지 매핑 복잡** | 편집 불가 | Phase 1에서 테셀레이션 메타데이터 표준 먼저 확정 |
| **모바일 성능** | iPad 발열·끊김 | 워커 풀, 적응형 테셀레이션 품질 |
| **태블릿 WASM 메모리 한계** | OCCT+PlaneGCS 동시 로드 시 크래시 | Phase 0 실측, PlaneGCS lazy-load, 워커 재시작 |
| **폴더블 레이아웃 깨짐** | 접고 펼 때 캔버스/UI 붕괴 | Phase 0 반응형 셸, Viewport Segments, posture 폴백 |
| **손가락 픽킹 부정확** | 모서리 선택 불가 | 입력별 동적 허용오차(터치 ~10mm), 펜 정밀 모드 |

핵심: **Phase 0~1에서 "커널 워커 + 테셀레이션 메타데이터 + 픽킹 + 입력 추상화" 네 기둥을 못 세우면 그 위는 못 올린다.** 여기에 시간을 아끼지 않는다. 특히 입력·디바이스 토대(§2.5)는 나중에 끼워넣을 수 없다 — 처음부터 깐다.

---

## 5. 디렉토리 구조 (예정)

```
projects/web-3d-modeler/
├── PLAN.md            # 이 문서
├── PROMPT.md          # 빌드 프롬프트 (Claude Code / 에이전트용)
├── WORKFLOW.md        # 개발 워크플로우 + 27명 오케스트레이션
└── app/               # (Phase 0에서 생성될 실제 코드)
    ├── src/
    │   ├── viewport/      # Three.js / r3f 뷰포트, 카메라, 기즈모
    │   ├── input/         # Pointer Events 추상화, 펜/터치/마우스 분기, 제스처, 픽킹 허용오차
    │   ├── device/        # 폴더블(Viewport Segments)·posture·반응형 셸·성능 예산
    │   ├── kernel/        # OCCT 워커 브릿지 (Comlink), 커널 API 래퍼
    │   │   ├── worker.ts
    │   │   └── occt/      # 박스/불리언/스케치/필렛 함수
    │   ├── document/      # 피처 트리 모델, 평가기, 직렬화
    │   ├── tools/         # 스케치/돌출/불리언 등 도구 상태머신
    │   ├── ui/            # 패널, 툴바, 트리뷰 (React + Tailwind + AA 토큰)
    │   └── store/         # Zustand 스토어
    ├── public/wasm/       # occt.wasm, planegcs.wasm
    └── tests/             # Vitest + Playwright
```

---

## 6. 다음 액션 (Phase 0 착수)

1. `app/` Vite 스캐폴드 생성 + 의존성 설치 + AA 디자인 토큰
2. OCCT WASM 워커 로딩 PoC (박스 하나)
3. 테셀레이션 메타데이터 포맷 v0 확정 → `WORKFLOW.md` §픽킹 규약에 반영
4. **Pointer Events 입력 추상화 + 반응형 셸** PoC — iPad/Galaxy Tab/Fold 6 에서 궤도·핀치 확인
5. **태블릿 WASM 메모리 실측** — 한계와 폴백 전략 확정

> AA 시스템 등록: `shared-memory/tasks/T-20260614-001` (Phase 0 마일스톤). 인덱스 `_backlog.md`.
