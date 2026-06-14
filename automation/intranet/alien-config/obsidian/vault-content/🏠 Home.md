---
type: moc
tags: [home, moc]
---

# 🏠 Alien Agentic — 기억의 집

> `shared-memory/` 를 Obsidian 으로 보는 진입점.
> AI 에이전트가 쓰고, 기영님이 보강하고, 다시 AI 가 읽는다 — **양방향 기억 순환**.

## 🧭 빠른 이동

| 허브 | 무엇 |
|---|---|
| [[🧠 에이전트 메모리]] | 27명 외계 동료의 work·learnings·decisions·mistakes |
| [[📅 데일리 로그]] | 매일의 활동 기록 (Calendar 플러그인으로 시각화) |
| [[💡 인사이트]] | 주간·월간 통찰 + 실패 케이스 스터디 |
| [[🛸 대시보드]] | 오늘 한 줄 + KPI + 위험 깃발 |

## 🔥 최근 활동 (최근 변경 10개)

```dataview
TABLE file.folder AS "위치", file.mtime AS "수정"
FROM "agents" OR "daily-logs" OR "insights"
SORT file.mtime DESC
LIMIT 10
```

> 💡 위 표가 비어 보이면 — Obsidian 설정 → 커뮤니티 플러그인 → **Dataview** 설치·활성화 후 새로고침.

## ⚠️ 가장 비싼 자산 — 실패 모음

```dataview
LIST
FROM "agents"
WHERE file.name = "mistakes"
```

## 🧩 양방향 순환이 작동하는 법

1. **AI → 기억**: 에이전트가 `aa call` 또는 Multica 로 일하면 `agents/<이름>/*.md` 에 자동 기록
2. **Obsidian 반영**: 같은 폴더를 Vault 로 열었으니 *즉시* 보임 (Obsidian 이 외부 파일 변경 자동 감지)
3. **기영님 보강**: Obsidian 에서 메모를 고치거나 백링크·태그 추가
4. **기억 → AI**: 다음 에이전트 호출이 그 파일을 *그대로 읽음* → 보강된 맥락 반영

> 같은 파일을 AI 와 사람이 함께 본다. 그래서 순환은 *자동*이다.
