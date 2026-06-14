# Obsidian Vault — AI 양방향 기억 순환

> `shared-memory/` 를 Obsidian Vault 로 만들어, **AI 에이전트의 기억과 기영님의
> Obsidian 을 하나의 폴더로 묶는다**. AI 가 쓰고, 기영님이 보강하고, 다시 AI 가
> 읽는다 — 같은 파일을 함께 보므로 순환은 자동.

## 왜 이게 "양방향 순환" 인가

```
   ┌──────────────────────────────────────────────┐
   │                                                │
   ▼                                                │
[AI 에이전트]  aa call / Multica 로 일함             │
   │  agents/<name>/{work,learnings,decisions,mistakes}.md 에 기록
   ▼                                                │
[파일 변경]  shared-memory/ 안의 .md 파일이 바뀜      │
   │                                                │
   ▼                                                │
[Obsidian]  같은 폴더를 Vault 로 열어둠 → 즉시 보임   │
   │  (Obsidian 은 외부 파일 변경을 자동 감지)        │
   ▼                                                │
[기영님]  메모 보강 · 백링크 · 태그 추가              │
   │                                                │
   ▼                                                │
[파일 변경]  같은 .md 파일이 또 바뀜 ────────────────┘
   │
   ▼
[다음 AI 호출]  그 파일을 그대로 읽음 → 보강된 맥락 반영
```

핵심: **AI 와 사람이 같은 .md 파일을 본다.** 별도 동기화·API·DB 가 필요 없다.
파일시스템이 곧 공유 메모리다.

## 설치 (1회)

### 1. Vault 부트스트랩 (설정·템플릿·MOC 노트)

```powershell
# Windows
e:\AlienAgentic\alien-agentic\automation\intranet\alien-config\obsidian\setup-obsidian-vault.ps1
```

```bash
# 또는 직접
python automation/intranet/alien-config/obsidian/setup-obsidian-vault.py
```

설치되는 것:
- `shared-memory/.obsidian/` — Obsidian 설정 (플러그인 목록·데일리노트·그래프 색상)
- `shared-memory/_templates/` — 노트 템플릿 (daily-log·insight·agent-note)
- `shared-memory/🏠 Home.md` 외 MOC 진입점 4개
- `shared-memory/{_inbox,_attachments}/` — 작업 폴더

### 2. Obsidian 앱 설치

```powershell
winget install -e --id Obsidian.Obsidian
```
또는 https://obsidian.md/download

### 3. Vault 열기

1. Obsidian 실행 → **"폴더를 보관함으로 열기 (Open folder as vault)"**
2. `E:\AlienAgentic\alien-agentic\shared-memory` 선택
3. 설정 → **커뮤니티 플러그인** → *제한 모드 끄기*
4. 5개 플러그인 설치·활성화:

| 플러그인 | 용도 |
|---|---|
| **Dataview** | MOC 노트의 자동 인덱싱 (27명 메모리·daily-log 표) |
| **Templater** | 노트 템플릿 자동 채움 |
| **Calendar** | daily-logs 달력 시각화 |
| **Tasks** | 에이전트 작업 체크리스트 추적 |
| **Advanced Tables** | 마크다운 표 편집 |

5. 좌측에서 **🏠 Home** 열기 → 시작.

## MOC 진입점

| 노트 | 무엇 |
|---|---|
| `🏠 Home` | 전체 진입점 + 최근 활동 + 양방향 순환 설명 |
| `🧠 에이전트 메모리` | 27명의 work·learnings·decisions·mistakes 인덱스 |
| `📅 데일리 로그` | 매일 활동 (Calendar 연동) |
| `💡 인사이트` | 주간·월간 통찰 + 실패 케이스 |

## 멱등성·안전성

- **에이전트 메모리는 절대 안 건드림** — `agents/*/*.md` 는 읽기만
- **MOC 노트는 기존에 있으면 보존** — 기영님 편집 안 날림
- **설정·템플릿은 항상 최신화** — 우리가 관리하는 자산
- 재실행 안전 (idempotent)

## git 추적 정책

추적 O (재현성):
- `.obsidian/*.json` (우리 설정 — 플러그인 목록·그래프 색상 등)
- `_templates/*.md`
- MOC 노트 (`🏠 Home.md` 등)

추적 X (`.gitignore`, 런타임):
- `.obsidian/workspace.json` (창 레이아웃)
- `.obsidian/plugins/` (플러그인 바이너리 — Obsidian 이 다운로드)
- `.obsidian/cache`, `.trash/`, `_inbox/`, `_attachments/`

## 모바일 (선택)

Obsidian Sync (유료) 또는 자체 git 동기화로 폰에서도 같은 Vault.
상세: `docs/guides/obsidian-symlink.md`, `docs/guides/mobile-access.md`
