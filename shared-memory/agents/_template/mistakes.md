---
agent: {agent-name}
korean_name: {한국어 이름}
role: {역할 한 줄}
division: {why|how|what|ctrl|rd}
type: agent-memory
file_type: mistakes
tags: [agent, mistakes, {division}]
---

# Mistakes — 틀린 자리와 교훈

관련: [[_index]] | [[agents/README]] | [[work]] | [[shared-memory/meta]]

## 표준 항목

```
### 2026-MM-DD HH:MM · {slug}
**틀린 자리**: {무엇이 어떻게 잘못됐나}

**발견 시점**: {언제 알게 됐나 — 즉시? 다음 호출에서? 기영님 지적?}

**원인 가설**: {왜 그렇게 됐을까}

**교훈**: {다음에 어떻게 다르게}

**가드**: {프롬프트/룰/메모리에 어떤 가드를 추가하면 재발 X}

관련: [[{연관 파일}]]
```

(여기 아래로 append)

---

## 작동 원칙
- 실수는 *가장 비싼 자산*. 절대 지우지 않는다.
- *원인을 사람*으로 환원하지 않는다 (외계인 vs 인간). 시스템의 매듭으로.
- 같은 실수가 *3번 반복*되면 → [[meta]] 에 elevation + 헌법 보정 검토
