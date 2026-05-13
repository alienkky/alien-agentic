# tasks/ — 진행 중 업무 목록

진짜 회사의 *Jira / Kanban / Linear* 자리.

## 파일 구조

```
shared-memory/tasks/
├── _backlog.md       # 미시작 업무
├── _in-progress.md   # 진행 중 (담당 + 마감)
├── _done.md          # 완료 + 회고
├── _blocked.md       # 막힌 자리 + 해결 후보
└── {task-id}.md      # 개별 업무 디테일
```

`_*.md` 파일들은 *인덱스*. 디테일은 개별 `{task-id}.md` 안에.

## 업무 표준 포맷

```markdown
---
id: T-20260513-001
title: {짧은 제목}
owner: {agent-name | 기영님}
client: {client-name | _self}
priority: P0 | P1 | P2 | P3
due: 2026-05-15
status: backlog | in-progress | done | blocked
created: 2026-05-13T15:30
---

# {Task Title}

## 목표
{무엇을 달성하나}

## 산출물
- `{path}` — {뭐가 들어 있는지}

## 의존성
- T-... (다른 업무 ID)
- {외부 자료/사람}

## 진척 로그
- 2026-05-13 15:30 · 시작
- ...

## 회고 (완료 시 채움)
- 잘된 자리:
- 어긋난 자리:
- 다음에 다르게:
```

## 우선순위

| 등급 | 의미 |
|---|---|
| **P0** | 오늘 (가족 시간 침범 X 한도 내) |
| **P1** | 이번 주 |
| **P2** | 이번 분기 |
| **P3** | 백로그 |

## 작동 원칙
- 한 사람(에이전트)이 동시에 P0 *2개 이상* 가지지 않음 — 컨텍스트 스위칭 비용
- *blocked* 자리는 24시간 안에 해결 또는 escalation
- 매일 아침 `client-concierge` 가 인덱스 갱신
