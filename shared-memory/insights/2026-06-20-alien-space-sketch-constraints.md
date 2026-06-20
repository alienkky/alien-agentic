# ALIEN SPACE — 스케치 구속조건 UI 1차 (직접 보정)

날짜: 2026-06-20
이슈: ALI-111 (스케치 편집 후속 — 구속조건 접목)

## 문제
구속조건 패널(`SketchConstraintsPanel`)이 라벨만 있고 누르면 "준비 중"만 떴다.
스케치의 선/점에 실제로 구속을 *접목*할 UI가 없었다.

## 한 일
- `kernel/sketchConstraints.ts` — 순수 함수 구속 엔진(직접 보정). PlaneGCS 같은 양방향 솔버가 아니라,
  선택 순서로 기준(고정)을 정하고 대상 끝점만 재배치하는 결정론적 방식.
  - 핵심 6종: 수평·수직(선분1) / 평행·직교·동일(선분2) / 일치(점2).
- 스토어: `constraintSel`(다중 선택) + `toggleConstraintSel` / `clearConstraintSel` / `applySketchConstraint`.
  기준 고정은 `sketchPrefs.anchor`(첫/마지막 선택) 설정을 재사용.
- 뷰포트(`SketchLayer`): **Shift+클릭**으로 선분/점을 구속 대상으로 토글(초록 하이라이트). 일반 클릭은 기존 드래그 유지.
- 키보드: Shift+H/V/A/P/E/N → 구속. 도구 단축키(Shift+A=arc)보다 먼저 가로채 충돌 방지.
- 패널: 실동작 6종(✓=선택 충족) + 추후(GCS) 7종 분리 표기.

## 검증
- typecheck 0 / vitest 131 (엔진 10 + 스토어 4 신규) / vite build OK.
- playwright: 구속 패널 스모크 신규(desktop·ipad·galaxy-tab 3종 통과).

## 교훈
1. **e2e가 reuseExistingServer 로 stale dev 서버를 물면 옛 번들을 검증한다.**
   포트 5173 의 좀비 dev 서버를 죽이고 재실행해야 새 UI 가 반영된다. (이번에 옛 패널이 스냅샷에 찍혀 30분 허비)
2. 기존 smoke.spec 이 UI drift(프리미티브가 "박스 (Box)" 최상위 버튼 → "삽입" 플라이아웃 내 "박스")로
   이미 전 프로젝트 red 였다. 라벨을 현행화해 desktop·ipad 복구. galaxy-tab(좁은 터치)에서 플라이아웃
   액셔너빌리티 이슈 잔존 — 구속 기능과 무관한 반응형 한계로 별도 과제.

## 다음
- 양방향 GCS(PlaneGCS) 도입 시 접선·중간점·동심·대칭이 풀린다. 직접 보정은 폴리라인 연쇄 전파를 안 해
  2점 선분에 최적, 다점 획에선 국소적. 솔버 단계에서 구속 저장(persist)·재적용 구조로 확장 필요.
