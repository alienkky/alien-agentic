# messages/ — 외계 동료끼리의 대화

에이전트 간 협업의 자리. **에이전트는 직접 통신하지 않는다** — 이 폴더의 파일을 통해서만 협업한다.

## 파일 명명 규칙

```
{YYYYMMDD-HHMM}-{from}-to-{to}-{slug}.md
```

예시:
- `20260513-1530-origin-reader-to-pain-interpreter-blbp-baseline.md`
- `20260513-1610-pain-interpreter-to-story-weaver-pain-v1.md`

브로드캐스트는 `to-all` 사용.

## 메시지 표준 포맷

```markdown
---
from: {agent-name}
to: {agent-name | all}
status: open | done | blocked
thread: {thread-slug} (선택)
client: {client-name} (선택)
created: 2026-05-13T15:30
---

# {제목 — 한 줄}

## 요청
{무엇을 해줘}

## 컨텍스트
- {참조 파일 경로들}
- {배경 정보}

## 기대 산출물
- {경로 또는 형태}

---

## 응답 (수신자가 채움)
[확신도: ...]

본문

근거:
- ...
```

## 기영님의 자리

이 폴더의 모든 파일은 *기영님이 언제든 엿볼 수 있는 자리*다.

- **읽기**: Obsidian Vault / Discord 채널 / `aa messages tail`
- **개입**: `interventions/` 폴더에 메시지 작성 → 다음 세션 시작 시 우선 처리

## 작동 원칙
- 모든 협업은 메시지로 *문서화*. 구두 합의 X
- *open* 메시지가 7일 초과 응답 없으면 빨간 깃발
- *blocked* 자리는 즉시 `client-concierge` 가 우선순위 보정
- 보안 — 외부 클라이언트 식별 정보는 익명화 후 누적
