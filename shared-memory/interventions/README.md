# interventions/ — 기영님의 중간 개입

외계 동료들의 작업 흐름에 *사람이 직접 끼어드는 자리*.

## 언제 쓰나
- 에이전트가 *잘못된 방향*으로 가고 있을 때 — **correction**
- 새로운 *우선순위*를 박을 때 — **direction**
- 작업을 *중단*시킬 때 — **stop**
- 잘하고 있다고 *알릴 때* — **encourage**
- *맥락 보정* (외부 사건/사람 정보) — **context**

## 파일 명명 규칙

```
{YYYYMMDD-HHMM}-{slug}.md
```

예: `20260513-2230-pivot-pause.md`

## 표준 포맷

```markdown
---
from: 기영님
to: {agent-name | all | thread:{slug}}
type: correction | direction | stop | encourage | context
priority: P0 | P1 | P2
status: open | acknowledged | done
created: 2026-05-13T22:30
---

# {제목 — 한 줄로 무엇을 보정}

## 무엇을
{개입의 핵심}

## 왜
{이유 / 배경}

## 다음 행동
- [ ] {에이전트가 할 것}
- [ ] {기영님이 할 것}

## 응답 (수신 에이전트가 채움)
{어떻게 반영했는지}
```

## 작동 원칙
- **다음 세션 시작 시 마스터 오케스트레이터가 *우선* 읽는다.** 새 작업보다 먼저.
- *open* → 처리 시작 → *acknowledged* → 완료 → *done*
- *done* 항목은 분기 archive로 이동 — `interventions/_archive-{YYYY-Q}/`
- **가족 시간엔** 기영님이 *자발적으로* 들어와 적는 경우만. 에이전트가 *intervention 요청*을 먼저 띄우지 않음
- 모바일에서 작성한 메모도 이 폴더로 sync (Obsidian Sync / Syncthing)
