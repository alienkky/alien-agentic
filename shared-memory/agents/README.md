# agents/ — 외계 동료들의 개인 메모리

각 외계 동료(27명)의 *개인 메모리* 자리. 호출 종료 시 자동 누적된다.

## 폴더 구조

```
shared-memory/agents/
├── _template/          # 새 에이전트 메모리 초기화 템플릿
└── {agent-name}/       # 각 에이전트별 메모리
    ├── work.md         # 무엇을 했나 (append)
    ├── learnings.md    # 무엇을 배웠나 (append)
    ├── decisions.md    # 무엇을 결정했나 (append)
    └── mistakes.md     # 무엇이 잘못됐나 (append)
```

## 4파일 패턴

| 파일 | 역할 |
|---|---|
| `work.md` | 호출 시점 + 입력 + 산출물 + 소요 |
| `learnings.md` | 이 호출에서 발견한 *새 패턴/통찰* |
| `decisions.md` | 이 호출에서 *내린 결정*과 그 *이유* |
| `mistakes.md` | 이 호출에서 *틀린 자리* + 그 *교훈* |

## 응답 표준 포맷

모든 에이전트는 호출 응답을 다음 형식으로:

```
[확신도: 확실 | 보통 | 가설]

본문

근거:
- ...

---

## MEMORY UPDATE

### work.md (append)
{내용 또는 (없음)}

### learnings.md (append)
{내용 또는 (없음)}

### decisions.md (append)
{내용 또는 (없음)}

### mistakes.md (append)
{내용 또는 (없음)}
```

호출 종료 시 마스터 오케스트레이터(또는 `aa` CLI)가 이 4섹션을 해당 파일에 자동 append.

## 작동 원칙
- 모든 항목에 *타임스탬프* + *호출 컨텍스트* 1줄 필수
- 익명화 — 외부 클라이언트 식별 정보 제거
- 무한 append — 삭제하지 않는다. 분기별로 `_archive-{YYYY-Q}/` 로 이동
- 1년 후 이 4×27 = 108개 파일이 *외계인 운영 데이터셋*의 핵심

---

## Obsidian 네이티브 작성 규칙 (전 에이전트 공통)

`shared-memory/`를 Obsidian Vault로 열었을 때 그래프뷰·백링크·Dataview가 살아 있으려면
아래 규칙을 모든 에이전트가 지켜야 한다.

### 1. YAML frontmatter (파일 맨 위)

모든 메모리 파일은 반드시 YAML frontmatter로 시작한다:

```yaml
---
agent: {agent-name}             # 예: origin-reader
korean_name: {한국어 이름}       # 예: 심연우
role: {역할 한 줄}               # 예: Why발굴
division: {why|how|what|ctrl|rd}
type: agent-memory
file_type: {work|learnings|decisions|mistakes}
tags: [agent, {file_type}, {division}]
---
```

### 2. 백링크 `[[...]]` — 참조는 반드시 위키링크

다른 에이전트·노트·클라이언트를 언급할 때는 일반 텍스트 대신 위키링크 사용:

| 참조 대상 | 형식 | 예 |
|---|---|---|
| 다른 에이전트 메모리 | `[[{agent}/work]]` | `[[origin-reader/work]]` |
| 메시지 파일 | `[[messages/{slug}]]` | `[[messages/20260627-1255-origin-reader-to-workflow-engineer-daily-reflection-automation]]` |
| 태스크 | `[[tasks/{id}]]` | `[[tasks/T-20260614-001]]` |
| 클라이언트 자료 | `[[clients/{name}/WHY/{file}]]` | `[[clients/acme/WHY/4-layer-diagnosis]]` |
| 인덱스 | `[[_index]]` | Vault 진입점 |

**룰**: 모든 메모리 노트는 적어도 **1개 이상**의 다른 노트와 `[[...]]`로 연결되어야 한다. 고립 노트는 죽은 노트.

### 3. 태그 체계 — 3계층 이내

인라인 태그는 `#division/role/topic` 형식, 3계층 이내:

```
#why/origin-reader           # 에이전트 태그
#how/data-strategist
#what/knowledge-architect
#memory/work                 # 파일 유형
#memory/learnings
#client/{name}               # 클라이언트 (익명화)
#type/decision               # 내용 유형
#type/error
```

frontmatter `tags:` 배열에도 동일 태그 포함.

### 4. 에이전트 간 메시지 파일

`shared-memory/messages/{YYYYMMDD-HHMM}-{from}-to-{to}-{slug}.md` 형식.
메시지 파일에도 동일 frontmatter 룰 적용:

```yaml
---
from: {agent-name}
to: {agent-name}
date: {YYYY-MM-DD}
type: agent-message
tags: [message, {from}, {to}]
---
```

### 5. 날짜 필드

`date:` 필드는 항상 ISO 8601 (`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:MM`) 사용.
Dataview가 자동 인식해 날짜 정렬·필터에 사용.
