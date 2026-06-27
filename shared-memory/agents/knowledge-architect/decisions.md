---
agent: knowledge-architect
korean_name: 장서윤
role: Obsidian 지식 시스템 구축
division: what
type: agent-memory
file_type: decisions
tags: [agent, decisions, what]
---

# Decisions — 결정과 그 이유

관련: [[_index]] | [[agents/README]] | [[work]]

(여기 아래로 append)

### 2026-06-27 · obsidian-plugin-selection (ALI-17)

**결정**: 커뮤니티 플러그인 5개 고정 — Dataview·Templater·Calendar·Tasks·Excalidraw

**대안**: Kanban, DB Folder, Periodic Notes, Advanced Tables 등 추가 가능

**선택 이유**: 헌법 §V "플러그인 5개 초과 금지". 유지보수 복잡성을 클라이언트(기영님)가 감당 못 하면 Vault가 죽는다. 5개는 *핵심 기능*(쿼리·템플릿·캘린더·태스크·다이어그램)을 커버하면서 한계 이내.

**기각 이유**: 6번째 플러그인부터는 학습 곡선이 급격히 올라가고 업데이트 충돌 리스크 증가.

**되돌릴 조건**: 기영님이 6개월 이상 능숙하게 쓰고 특정 플러그인의 부재가 명확한 불편을 일으킬 때.

관련: [[agents/README]]

### 2026-06-27 · plugin-binary-gitignore (ALI-17)

**결정**: 플러그인 `main.js`·`styles.css`는 `.gitignore`에서 제외, `data.json`·`community-plugins.json`·`app.json`은 커밋.

**대안**: 플러그인 바이너리 전부 커밋 (즉시 작동하나 repo 크기 증가)

**선택 이유**: 바이너리는 Obsidian이 자동 다운로드하므로 커밋 불필요. 설정(`data.json`)만 추적하면 재설치 후에도 설정이 복원된다.

**되돌릴 조건**: 인터넷 없는 환경에서 Vault를 사용해야 하는 경우 — 그때는 바이너리도 커밋.
