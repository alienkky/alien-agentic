# PLAN — 웹 기반 3D 모델러 (Shapr3D-like)

> 코드명: **Nebula** (가칭) — 브라우저에서 도는 파라메트릭 솔리드 모델러.
> 작성: master-orchestrator · 2026-06-14 · 상태: 설계(Design)

---

## 0. 한 줄 정의

> iPad의 Shapr3D가 주는 "스케치 → 돌출 → 직접 편집"의 손맛을,
> 설치 없이 **브라우저 탭 하나**에서, 진짜 CAD 커널(B-rep) 위에서 돌린다.

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

## 3. 단계별 로드맵 — 7 페이즈

> 시간 추정은 **1.5~2배 보정** 반영 (1인 + AI 페어 기준).

### Phase 0 — 토대 (Foundation) · 약 1.5~2주
- Vite + React + TS + Three.js + r3f 스캐폴드
- 뷰포트: 궤도 카메라(OrbitControls), 그리드, 3점 조명, 기준 평면(XY/YZ/ZX)
- **OCCT WASM을 Web Worker에 로드**, Comlink 브릿지
- "박스 하나 생성 → 테셀레이션 → 화면 표시" **수직 슬라이스** 완성
- ✅ 완료 기준: 버튼 누르면 워커가 OCCT 박스를 만들어 화면에 뜬다

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

### Phase 6 — 마감 + 모바일 · 약 3~4주
- 재질/PBR 머티리얼, HDRI 환경광, 측정 도구
- 터치/펜 입력 (iPad 대응 — Shapr3D의 본진)
- 성능: LOD, 메시 캐시, 워커 풀
- 온보딩, 단축키, 다국어(ko/en)
- ✅ 완료 기준: 아이패드 사파리에서 손가락으로 모델링

### (옵션) Phase 7 — 협업/클라우드
- 실시간 공동 편집(CRDT), 클라우드 저장, 버전 관리, 공유 링크

**총 추정: MVP(Phase 0~3) 약 9~13주, 완성형(~Phase 6) 약 18~25주** (1인+AI 기준, 1.5~2배 보정 포함)

---

## 4. 리스크 — 미리 알고 들어간다

| 리스크 | 영향 | 대응 |
|---|---|---|
| **OCCT WASM 번들 크기** (~30MB+) | 첫 로딩 느림 | 워커 lazy-load, gzip/brotli, CDN, 스플래시 로딩 |
| **OCCT 메모리 누수** (C++ 객체 수동 해제) | 장시간 세션 크래시 | 모든 `new`에 `.delete()` 래퍼, 객체 풀, 워커 주기적 재시작 |
| **2D 구속 솔버 난이도** | Phase 4 지연 | 구속 없는 자유 스케치로 MVP, 구속은 후순위 |
| **픽킹 토폴로지 매핑 복잡** | 편집 불가 | Phase 1에서 테셀레이션 메타데이터 표준 먼저 확정 |
| **모바일 성능** | iPad 발열·끊김 | 워커 풀, 적응형 테셀레이션 품질 |

핵심: **Phase 0~1에서 "커널 워커 + 테셀레이션 메타데이터 + 픽킹" 세 기둥을 못 세우면 그 위는 못 올린다.** 여기에 시간을 아끼지 않는다.

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
    │   ├── kernel/        # OCCT 워커 브릿지 (Comlink), 커널 API 래퍼
    │   │   ├── worker.ts
    │   │   └── occt/      # 박스/불리언/스케치/필렛 함수
    │   ├── document/      # 피처 트리 모델, 평가기, 직렬화
    │   ├── tools/         # 스케치/돌출/불리언 등 도구 상태머신
    │   ├── ui/            # 패널, 툴바, 트리뷰 (React + Tailwind)
    │   └── store/         # Zustand 스토어
    ├── public/wasm/       # occt.wasm, planegcs.wasm
    └── tests/             # Vitest + Playwright
```

---

## 6. 다음 액션 (Phase 0 착수)

1. `app/` Vite 스캐폴드 생성 + 의존성 설치
2. OCCT WASM 워커 로딩 PoC (박스 하나)
3. 테셀레이션 메타데이터 포맷 v0 확정 → `WORKFLOW.md` §픽킹 규약에 반영
