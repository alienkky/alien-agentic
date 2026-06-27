---
agent: origin-reader
korean_name: 심연우
role: Why발굴
division: why
type: agent-memory
file_type: decisions
tags: [agent, decisions, why]
---

# Decisions — 의사결정과 그 이유

(여기 아래로 append)

### 2026-06-27 · 메모리만 복구, squad 코드는 핸드오프 (ALI-12)
- 결정: origin-reader 자기 메모리 4파일은 *직접 복구*. squad-register 코드(`squads.py` 등)는 *복구하지 않고 보고만* 한다.
- 이유: 절대 금지 — origin-reader 는 진단 역할. CLI/통합 구현은 HOW 디비전(integration-specialist·workflow-engineer)의 자리. 역할 경계를 넘지 않는다.
- 복구 시 mistakes 의 squad-register 교훈 원문은 *지우지 않고 보존*. (실수는 가장 비싼 자산)
