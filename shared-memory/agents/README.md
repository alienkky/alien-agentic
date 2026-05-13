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
