---
agent: {{title}}
type: agent-memory
tags: [agent]
---

# {{title}} — 메모리 허브

> 이 에이전트가 직접 쓴 4파일을 한곳에서 본다. AI 가 쓰고, 기영님이 보강하면
> 다음 호출에서 AI 가 읽는다 (양방향 순환).

## 📂 4파일

- 🛠 [[work]] — 진행·완료 작업
- 💡 [[learnings]] — 배움·통찰
- 🧭 [[decisions]] — 의사결정
- ⚠️ [[mistakes]] — 실패·교훈

## 최근 변경

```dataview
TABLE file.mtime AS "수정"
FROM "agents/{{title}}"
SORT file.mtime DESC
```
