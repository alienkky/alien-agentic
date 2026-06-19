# ALIEN SPACE — 구속 슬라이스 4: 정점 포인터-그랩 + 다중선택 구속 (4-에이전트 병렬 + 리뷰)

날짜: 2026-06-17
이슈: ALI-111 (Phase 2)
브랜치: `agent/agent/6a9cad5a`
요청: 기영님 "1,2,3 모두 진행" (정점 그랩 UI + 다중선택 + 5명 병렬, 빌더 코멘트 금지)

## 협업 — 3 빌더 + 1 리뷰어 (코멘트 0)
- 빌더: `vertexPick.ts`(근접 정점, 5테스트) · `multiConstraintSolve.ts`(두 선분 구속 풀이, 4테스트) · `vertexHandles.ts`(핸들 마커, 4테스트). 전부 독립 새 파일, 이슈 코멘트 0.
- 통합은 내가. 그 다음 **cavecrew-reviewer** 가 통합 diff 감수.
- 리뷰어가 잡은 진짜 버그 4건(잔상 hover 3 + 스테일 pair 1) 즉시 수정. 이게 멀티에이전트의 진짜 값 — 만든 사람과 보는 사람을 분리.

## #1 정점 포인터-그랩 (캔버스 직접 조작)
- store: `sketchHoverVertex`/`sketchDraggingVertex` + `setSketchHoverVertex`/`beginVertexDrag`/`endVertexDrag`/`pickSketchVertex`.
- SketchLayer 포인터: pointerdown 이 기존 정점 근처(pickTol=max(0.3, cell*0.6))면 `beginVertexDrag` → 그리기 대신 그랩. move 는 `dragSketchVertex`(구속 유지 재해). 핸들 구(球) 렌더(호버 노랑/드래그 분홍).
- 그리기와 모호: 정점 근처일 때만 그랩(없으면 정상 그리기). 트림/삭제/점도구 제외.

## #2 다중선택 구속 (평행/직각/일치)
- `selectSketchSegment` 가 최근 2선분을 링버퍼(`sketchSegPair`, 중복제외)로 유지.
- store `applyMultiConstraint(parallel|perpendicular|coincident)`: 앵커=첫 선분 두 정점 고정, 둘째 정렬, 영구 보관.
- 패널 평행/수직/일치 버튼 + ⇧A/⇧P/⇧N 핫키 연결.

## 리뷰 수정
- `beginVertexDrag` 가 `sketchSegPair` 도 비움 — 그랩 후 ⇧A 로 옛 쌍에 오적용 방지.
- SketchLayer: 그리는 중이면 hover 해제(잔상 방지).

## 검증
tsc 0 · vitest **195/195**(신규 13 모듈 + 핫키 테스트 갱신) · build · e2e desktop 11/11(다중/그랩 신규 2).

## 다음
- 정점 그랩의 실캔버스 손맛은 수동 확인 필요(자동테스트 한계) — 기영님 피드백 대기.
- 인덱스 remap(스트로크 추가/삭제 후 구속 유지)·접선/동일/대칭·구성선·박스선택.
