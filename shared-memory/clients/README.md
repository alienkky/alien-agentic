# clients/ — 클라이언트별 자료 + 메모리

Alien Agentic의 *외부 클라이언트* 와 *자기 진단 케이스* (언더스코어 prefix) 가 모두 이 자리에 누적.

## 폴더 구조

```
shared-memory/clients/
├── _template/                     # 새 클라이언트 생성 시 복사용 템플릿
│   ├── WHY/                       # 4층 진단 / 페인 / 비전 / 마스터 내러티브
│   ├── HOW/                       # 프로세스 지도 / 에이전트 명단 / KPI / 조직도
│   ├── WHAT/                      # 프롬프트 / 자동화 / Vault / 대시보드
│   └── memory/                    # 이 클라이언트와 함께 누적되는 4파일 메모리
│       ├── work.md
│       ├── learnings.md
│       ├── decisions.md
│       └── mistakes.md
├── _self-alien-agentic/           # 자기 진단 케이스 (외부 클라이언트 X)
└── {client-name}/                 # 실제 클라이언트 (계약 후 생성)
```

## 두 가지 메모리 — agents vs clients

| 자리 | 위치 | 무엇을 기록 |
|---|---|---|
| **에이전트별 메모리** | `shared-memory/agents/{agent-name}/` | 그 에이전트가 *클라이언트와 무관하게* 자기 자신을 학습한 기록 |
| **클라이언트별 메모리** | `shared-memory/clients/{client-name}/memory/` | 그 클라이언트와 *함께* 누적된 컨텍스트 (이 클라이언트만의 일) |

같은 호출이라도 *두 자리에 동시 누적* — `aa call <agent> "..." --client X` 호출 시:
- 에이전트 학습 (그 에이전트의 패턴) → `agents/{agent}/`
- 클라이언트 컨텍스트 (그 클라이언트의 자리) → `clients/{client}/memory/`

## 새 클라이언트 시작 시

```bash
cp -r shared-memory/clients/_template shared-memory/clients/{new-client-name}
```

또는 향후 `aa client new <name>` 명령 (Phase 2).

## 익명화 의무

외부 콘텐츠로 가공할 때는 `case-curator` 가 *식별 정보 제거* 후 `shared-memory/meta/cases/` 로 이동. 원본은 `clients/{name}/` 에 그대로.

## 자기 진단 케이스

언더스코어 prefix (`_self-*`) 폴더는 *외부 클라이언트가 아닌* Alien Agentic 자체에 대한 진단. 외부 콘텐츠로 가공 금지(헌법 V `content-scout` 절대 금지).
