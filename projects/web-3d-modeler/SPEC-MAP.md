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
| 2.2 CameraManager | 뷰큐브 alignToAxis(보간) | 🟡 | 표준뷰 즉시전환 + **면 법선 자동 정렬**(alignToNormal). 보간 0.3s 예정 |
| 2.2 GridSystem | 어댑티브 그리드 + snapToGrid | ✅ | 거리에 따라 셀 10배 단계 세분(월드+스케치평면) + 격자 스냅 |
| 3.1 SketchPlane | 3 표준평면 + 면 위 스케치 | ✅ | XY/YZ/XZ + **면 클릭→그 면 평면**(planeFromFace). 3점 커스텀평면은 다음 |
| 3.2 CurveEntity | Line/Arc | 🟡 | Line/Rect/Circle/타원/다각형 (Arc·스플라인 미구현) |
| **3.3 ProfileDetector** | **닫힌 루프 → 파란 면** | 🟡→✅ | **← 이번 구현 (블루 필)** |

## Part 2 — Solid Generation & Boolean
| Module | 기능 | 상태 | 우리 구현 |
|---|---|---|---|
| 4.1 ExtrudeOperation | 돌출(+taperAngle) | ✅ | 높이입력 + 새바디/빼기/합치기(AABB 겹침) + **드래그 핸들 실시간 높이**. taper 미구현 |
| 4.2 RevolveOperation | 회전체 | ✅ | 각도+축 Lathe 회전 + 새바디/빼기/합치기(combineTools 공유). 축지정선택 다음 |
| 4.3 LoftOperation | 로프트 | ⬜ | |
| 5.1 BooleanSolver | union/subtract/intersect | ✅ | 메시CSG / OCCT |
| 5.2 AutoContextManager | 돌출 충돌 → 자동 cut/add | 🟡 | 돌출 빼기/합치기(AABB 겹침 자동). 면 위 스케치 연동은 다음 |
| 6.1 ExtrudeCutFilter | 컷 대상 필터(제외 바디) | ⬜ | |

## Part 3 — Constraint & Timeline & PBR
| Module | 기능 | 상태 |
|---|---|---|
| 4.x Fillet/Chamfer | 모깎기/모따기 | 🟡 | **둥근 박스 프리미티브**(RoundedBox). 임의-모서리 fillet 은 B-rep(OCCT) 트랙 — 메시론 미보장 |
| 7 ConstraintManager | 구속(Coincident/Tangent/Distance) + DOF 색상 | ⬜ (PlaneGCS) |
| 8 Timeline/Breakpoint | 피처 재배치·브레이크포인트 타임워프 | ⬜ (1.2 의존) |
| 9 PBR_RenderManager | 면별 재질(roughness/metallic/opacity) | ⬜ |

## Part 4 — Assembly & Export
| Module | 기능 | 상태 |
|---|---|---|
| 10.1 TransformationMatrix | translate/rotate/scale | ✅ | 이동(기즈모) + 회전·스케일·미러(중심기준 다이얼로그) |
| 10.2 InstanceCopier | 복제/패턴 | ✅ | 선형(축·간격) + 원형(축·각도) 배열. transformMesh(이동/회전) |
| 11.1 TessellationEngine | chordal/angular 공차 | 🟡 (고정 deflection) |
| 11.2 ToleranceManager | 조립 공극 오프셋 | ⬜ |
| 12 CadAutomationAPI | 스크립트 API | 🟡 | `buildMouse` 데모(스케치→돌출→불리언 코드 파이프라인) |
| STL Export | 바이너리 STL 내보내기 | ✅ | `meshesToStl` + 파일메뉴(이동 오프셋 반영). STEP 미구현 |
| STL Import | STL 불러오기 | ✅ | `parseStl`(바이너리/ASCII) + 파일메뉴 |
| 측정 Measure | 두 점 거리 | ✅ | 측정 모드 → 두 점 클릭 → 거리(mm). 각도·모서리스냅 다음 |

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

## 스케치 워크플로우 (2026-06-15 수정 — 기영님 지적)
- 스케치 = **평면 선택 → 그 면에 새 스케치 생성 → 그림 → 스케칭 종료(항목 저장)**
- **돌출은 스케치 안에 없음** — 스케치는 독립 항목으로 저장되고, **도구→돌출**에서 선택해 입체화
- 스케치 버튼은 플라이아웃 없이 바로 스케치 모드 진입 / SketchBar(스케치 내 돌출) 제거됨

## 미구현 스텁 — 순차 구현 대기 (기영님 "기억해줘")
> 좌측 메뉴·팝업 항목은 자리 잡혀 있고, 아래는 실제 동작 구현이 남은 것들.

**우상단 팝업 (다음 우선):**
- 단위 팝업(밀리미터/cm/m/인치/피트 + 그리드 크기 잠금 + 각도 포맷)
- 뷰 팝업(기본/평면/저면/정면/배면/우측/좌측 + 저장된 보기)
- 셰이더 팝업(와이어프레임/X-Ray/음영/시각화 + 곡면분석 + 에지/숨긴모서리/데칼)
- 구속조건 설정 팝업(자동 구속조건 + 가시성 + 앵커 처음/마지막)

**스케치 도구:** 호 · 스플라인 · 모서리 오프셋 · 미러 · 패턴 · 투상 · 텍스트 · **자르기(trim)** · 삭제 · 구속조건 솔버(Module 7) _(타원·다각형 완료. 다음 2차: 자르기·면분할·점 드래그 편집)_
**변형:** 스케일 · 평행이동 · 패턴 · 축둘레회전 · 정렬 · 미러 · 회전 기즈모
**도구(3D):** 면 오프셋 · 모따기/모깎기 · 셸 · 로프트 · 바디분할 · 회전(Revolve) · 스윕 · 면교체 · 모서리오프셋 · 투상 · 랩&엠보스 · 시각화
**삽입:** 변수/이미지/파일/프로젝트 가져오기
**구성:** 평면 · 축 / **메뉴:** 파일·항목 다수 항목 / **돌출 옵션:** 높이 입력·드래그·컷돌출
**저장/입출력:** STEP/STL · 프로젝트 저장 / **히스토리:** 롤백·재배치·브레이크포인트(Module 8)

## 순차 구현 순서 (다음부터)
0. ✅ 스케치 워크플로우 수정(평면→스케치 항목, 돌출은 도구로)
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
