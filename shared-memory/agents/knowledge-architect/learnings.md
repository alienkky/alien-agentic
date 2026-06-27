---
agent: knowledge-architect
korean_name: 장서윤
role: Obsidian 지식 시스템 구축
division: what
type: agent-memory
file_type: learnings
tags: [agent, learnings, what]
---

# Learnings — 배운 것·통찰

관련: [[_index]] | [[agents/README]] | [[work]]

(여기 아래로 append)

### 2026-06-27 · obsidian-gap-diagnosis (ALI-17)

**패턴**: 에이전트들이 마크다운만 쓰고 Obsidian 고유 기능을 안 쓰는 근본 원인은 *템플릿에 위키링크가 없어서*다.

**상황**: [[agents/origin-reader/work]] ALI-15 진단에서 `shared-memory/` 전체에 위키링크 `[[...]]` 가 단 1개였음이 드러남. 진단이 아니라 *템플릿*이 출발점이었다.

**가설**: 에이전트는 템플릿을 그대로 복사해 append한다. 템플릿에 `[[...]]`가 없으면 output에도 없다. 시스템 프롬프트(CLAUDE.md)에 규칙을 명시해도, 매 호출에서 템플릿을 보지 않으면 적용이 안 된다.

**적용**: Vault 규칙 추가보다 *템플릿 수정*이 더 직접적인 레버. 새 에이전트가 `_template/`을 복사하면 자동으로 frontmatter + 위키링크를 갖게 된다.
