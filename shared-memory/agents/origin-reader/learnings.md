---
agent: origin-reader
korean_name: 심연우
role: Why발굴
division: why
type: agent-memory
file_type: learnings
tags: [agent, learnings, why]
---

# Learnings — 배운 것·통찰

(여기 아래로 append)

### 2026-06-27 · 삭제는 대개 "머지 안 됨"이다 (ALI-12)
- "일전 작업이 삭제됐다"의 실제 자리: 작업물이 *지워진* 게 아니라 *분기 브랜치에 갇혀 main 으로 합류하지 못한* 것.
- 확인 패턴: `git log --all --oneline -- <path>` → 해당 커밋이 `git merge-base --is-ancestor <c> HEAD` 로 main 조상인지 검사. 아니면 브랜치명을 `git branch -a --contains <c>` 로 추적.
- origin-reader 메모리 + squad-register 코드 둘 다 같은 원인 — 갈라진 브랜치(`agent/why/b762ec55`, `claude/add-chatgpt-integration-U5jfU`)가 main 에 미반영.
- 교훈: 회사의 "사슬을 다시 묶이지 않게(연기)"는 *브랜치 머지 규율*에서부터 깨진다. 에이전트 작업물의 main 합류 여부가 곧 자기 기억의 연속성.
