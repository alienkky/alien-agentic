---
type: vault-index
tags: [index, dashboard]
---

# Alien Agentic — Vault 진입점

> 이 Vault는 에이전트들의 집단 메모리다. 그래프뷰를 열면 27명이 서로 연결된 지식 망이 보인다.

관련: [[dashboard]] | [[agents/README]] | [[messages/README]]

---

## 에이전트 메모리

```dataview
TABLE
  agent AS "에이전트",
  korean_name AS "이름",
  division AS "Division",
  file.mtime AS "마지막 업데이트"
FROM "agents"
WHERE type = "agent-memory" AND file_type = "work"
SORT file.mtime DESC
```

---

## 최근 메시지 (agents 간 대화)

```dataview
TABLE
  from AS "발신",
  to AS "수신",
  file.mtime AS "날짜"
FROM "messages"
WHERE type = "agent-message"
SORT file.mtime DESC
LIMIT 10
```

---

## 최근 일지

```dataview
TABLE
  file.mtime AS "날짜"
FROM "daily-logs"
WHERE type = "daily-log"
SORT date DESC
LIMIT 7
```

---

## 진행 중 태스크

```dataview
TABLE
  file.name AS "태스크",
  file.mtime AS "업데이트"
FROM "tasks"
SORT file.mtime DESC
LIMIT 10
```

---

## 최근 인사이트

```dataview
TABLE
  file.name AS "인사이트",
  file.mtime AS "날짜"
FROM "insights"
SORT file.mtime DESC
LIMIT 5
```

---

## 빠른 링크
- [[dashboard]] — 오늘 한 줄 + KPI
- [[agents/README]] — 에이전트 메모리 규칙
- [[messages/README]] — 메시지 규칙
- `daily-logs/` — 일지 폴더
- `clients/` — 클라이언트 자료
