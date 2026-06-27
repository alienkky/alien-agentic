---
agent: {agent-name}
korean_name: {한국어 이름}
role: {역할 한 줄}
division: {why|how|what|ctrl|rd}
type: agent-memory
file_type: work
tags: [agent, work, {division}]
---

# Work — 진행 중·완료된 작업 기록

관련: [[_index]] | [[agents/README]]

## 표준 항목

```
### 2026-MM-DD HH:MM · {slug}
- 호출자: {who triggered — 기영님 / agent-name / cli}
- 입력: {요청 한 줄}
- 컨텍스트: [[{참조 파일}]]
- 산출물: `{path}` 또는 (없음)
- 소요: ~{분}분
- 다음 핸드오프: [[{다음 에이전트}/work]] 또는 (없음)
```

(여기 아래로 append)
