# tasks/ — 진행 중 업무 목록

진짜 회사의 *Jira / Kanban / Linear* 자리.

## 파일 구조 (ALI-105 이후)

```
shared-memory/tasks/
├── index.md          # ★ scripts/aa-index.py 가 자동 생성 — 손으로 만지지 않음
├── log.md            # ★ scripts/aa-log.py 가 git 이벤트를 append — 손으로 만지지 않음
└── {task-id}.md      # 개별 업무 디테일 (front matter 의 `status` 가 진실의 원본)
```

> 이전의 `_backlog.md` / `_in-progress.md` / `_done.md` / `_blocked.md` 수기 인덱스는
> 폐기됐다. `status` 별 뷰가 필요하면 `index.md` 의 Entry Points 표를 status 로 그룹핑해
> 후처리하거나 `aa task list --status=...` 를 쓴다 (예정).

자동 갱신:
- 작업 종료 시: `python scripts/aa-index.py shared-memory/tasks`
- PR 직전: `scripts/aa-pr.py` 가 `--all` 로 모든 폴더의 index/log 를 재컴파일한 뒤 PR 생성.

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
- 매일 아침 `client-concierge` 가 `aa-index.py shared-memory/tasks` 호출 + dashboard 동기화
