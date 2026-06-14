# SPEC-MAP — 기영님 명세(5문서) ↔ 구현 상태

> Gemini 명세 "3D CAD Core Engine Architecture" Part 1~4 + 마스터 가이드(Phase 1~5)를
> 우리 앱 구현에 매핑. "하나씩" 순차 구현 추적표. (문서 추가 시 갱신)
> ✅완료 · 🟡부분 · ⬜미구현

## Part 1 — Foundation & 2D Sketch
| Module | 기능 | 상태 | 우리 구현 |
|---|---|---|---|
| 1.1 GeometryKernel | B-Rep(Vertex/Edge/Face/SolidBody) | 🟡 | OCCT(B-rep) + FAST(메시). 메시가 기본 |
| 1.2 HistoryTreeManager | 피처트리·롤백(rebuildTree) | ⬜ | **미구현 — 큰 백본** |
| 2.1 InputController | 터치=카메라 / 펜=형상 분리 | ✅ | Pointer Events 분기 |
| 2.2 CameraManager | 뷰큐브 alignToAxis(보간) | 🟡 | 표준뷰 즉시전환(보간 0.3s 추가 예정) |
| 2.2 GridSystem | 어댑티브 그리드 + snapToGrid | 🟡 | 격자 스냅 0.5(고정) → 어댑티브 예정 |
| 3.1 SketchPlane | 3점 평면 / 면 위 스케치 | ⬜ | 지면(XZ) 고정 |
| 3.2 CurveEntity | Line/Arc | 🟡 | Line/Rect/Circle (Arc 미구현) |
| **3.3 ProfileDetector** | **닫힌 루프 → 파란 면** | 🟡→✅ | **← 이번 구현 (블루 필)** |

## Part 2 — Solid Generation & Boolean
| Module | 기능 | 상태 | 우리 구현 |
|---|---|---|---|
| 4.1 ExtrudeOperation | 돌출(+taperAngle) | 🟡 | 돌출 O, taper/방향 미구현 |
| 4.2 RevolveOperation | 회전체 | ⬜ | 다음 우선순위 |
| 4.3 LoftOperation | 로프트 | ⬜ | |
| 5.1 BooleanSolver | union/subtract/intersect | ✅ | 메시CSG / OCCT |
| 5.2 AutoContextManager | 돌출 충돌 → 자동 cut/add | ⬜ | **돌출 컷 — 다음 우선** |
| 6.1 ExtrudeCutFilter | 컷 대상 필터(제외 바디) | ⬜ | |

## Part 3 — Constraint & Timeline & PBR
| Module | 기능 | 상태 |
|---|---|---|
| 7 ConstraintManager | 구속(Coincident/Tangent/Distance) + DOF 색상 | ⬜ (PlaneGCS) |
| 8 Timeline/Breakpoint | 피처 재배치·브레이크포인트 타임워프 | ⬜ (1.2 의존) |
| 9 PBR_RenderManager | 면별 재질(roughness/metallic/opacity) | ⬜ |

## Part 4 — Assembly & Export
| Module | 기능 | 상태 |
|---|---|---|
| 10.1 TransformationMatrix | translate/rotate/scale | 🟡 | 이동 O, 회전·스케일 미구현 |
| 10.2 InstanceCopier | 복제/패턴 | ⬜ |
| 11.1 TessellationEngine | chordal/angular 공차 | 🟡 (고정 deflection) |
| 11.2 ToleranceManager | 조립 공극 오프셋 | ⬜ |
| 12 CadAutomationAPI | 스크립트 API | ⬜ |

## UI 셸 (Shapr3D 레이아웃 — 기영님 스크린샷 참고)
| 요소 | 상태 | 비고 |
|---|---|---|
| 상단 메뉴바(파일/편집/항목/뷰/도움말) | ✅ | + 프로젝트명·실행취소·공유 |
| 좌측 항목(Items) 패널 | ✅ | "모든 항목" + 빈 상태 |
| 좌측 툴바(모델링.. / 검색·스케치·삽입·구성·변형·도구) | ✅ | 카테고리 플라이아웃 |
| 우측 내역(History) 패널 | ✅ | 단계 로그(Module 1.2 토대) |
| 우상단 뷰포트 컨트롤(뷰·mm·디스플레이·스샷) | ✅ | |
| 네비큐브(3D) · 메뉴 실제 동작 | ⬜ | 메뉴는 시각 플레이스홀더 |

## 선택 시스템 (모든 편집의 토대 — 기영님 우선순위)
| 기능 | 상태 | 비고 |
|---|---|---|
| **면(face) 탭 선택** | ✅ | triFaceId 역추적, 하이라이트 |
| **모서리(edge) 탭 선택** | ✅ | 개별 Line 픽킹, 하이라이트 |
| **바디(body) 선택** | ✅ | 아이템 패널 행 클릭 |
| 다중 선택(토글) + 빈곳 해제 | ✅ | onPointerMissed |
| 불리언/이동은 선택→부모바디 도출 | ✅ | selectionBodyIds |

## 순차 구현 순서 (다음부터)
1. ✅ ProfileDetector 블루 필 + ✅ 통합 선택(면·모서리·바디)
2. **돌출 컷 + AutoContext** (기존 바디에 구멍, 자동 add/cut)
3. **회전(Revolve)** + 돌출 옵션(방향/대칭)
4. **회전·스케일 기즈모** (Transform 완성)
5. **Shell**(속 비우기) + 필렛/모따기
6. **History 트리 + 롤백** (파라메트릭 백본 — Module 1.2/8)
7. **구속 솔버**(Module 7, PlaneGCS) — DOF 색상
8. **STL 내보내기** + 면별 재질(PBR)
9. 어댑티브 그리드·3점 평면·Arc·Loft·복제

> 원칙: 한 번에 하나, tsc·vitest·build 게이트 통과 후 디바이스 검증.
> 주의: 메시(FAST) 경로로 먼저 구현 → OCCT(B-rep) 정밀화는 디바이스 검증 후.
