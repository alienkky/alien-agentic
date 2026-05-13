# Alien Agentic — Multica 인트라넷 커스터마이즈

> Multica 본진 (`automation/intranet/multica/`, gitignore 처리) 위에 *Alien Agentic 27명 외계 동료*를 박는 자리.

## 폴더 구조

```
alien-config/
├── README.md                  # 이 파일
├── seeds/                     # DB 시드 (27명 외계 동료)
│   ├── seed_agents.py         # 메인 스크립트 — .claude/agents/*.md 파싱 + INSERT
│   ├── .env.example           # WORKSPACE_ID / OWNER_ID 템플릿
│   └── requirements.txt       # psycopg2-binary, python-dotenv
└── migrations/                # 우리 측 추가 마이그레이션 (선택, 향후)
```

## 셋업 흐름 (5단계, 약 30~40분)

### 1. Multica 본진 가동

처음 한 번:

```powershell
# PowerShell, C:/Alien Agentic 에서
cd automation/intranet/multica
make selfhost
```

`make selfhost` 가 자동으로:
- `.env` 생성 + 랜덤 `JWT_SECRET`
- Docker Compose 시작 — postgres + backend + frontend
- 마이그레이션 자동 실행

확인:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

> **Docker 필수.** 없으면 https://docker.com 에서 Docker Desktop 설치.

### 2. 회원가입 + 워크스페이스 생성

브라우저에서 http://localhost:3000 → 회원가입.

`.env` 의 `APP_ENV=development` + `MULTICA_DEV_VERIFICATION_CODE=888888` 설정하면 이메일 인증 우회 (로컬 테스트용).

회원가입 후:
- 워크스페이스 이름: `Alien Agentic` (slug: `alien-agentic`)
- 본인을 owner로 자동 등록

### 3. WORKSPACE_ID + OWNER_ID 확인

```bash
docker exec multica-postgres-1 psql -U multica -d multica -c \
  'SELECT id, slug FROM workspace; SELECT id, email FROM "user";'
```

결과 메모.

### 4. 시드용 fake `agent_runtime` 생성

Multica의 `agent.runtime_id` 는 NOT NULL — *daemon runtime에 묶여서* agent가 만들어지는 구조. 정식 흐름은 `multica daemon start` (Phase 2). **시드 단계만 빠르게** 가려면 fake runtime 1개 직접 INSERT:

```bash
WS_ID="여기-3단계의-workspace-id"
OWNER_ID="여기-3단계의-owner-id"

docker exec multica-postgres-1 psql -U multica -d multica -c \
  "INSERT INTO agent_runtime (workspace_id, owner_id, name, runtime_mode, provider, status) VALUES ('$WS_ID', '$OWNER_ID', 'alien-agentic-local', 'local', 'claude_code', 'online');"

# RUNTIME_ID 추출
RUNTIME_ID=$(docker exec multica-postgres-1 psql -U multica -d multica -t -A -c \
  "SELECT id FROM agent_runtime WHERE workspace_id = '$WS_ID' ORDER BY created_at DESC LIMIT 1;" | tr -d '\r\n ')
echo "RUNTIME_ID = $RUNTIME_ID"
```

### 5. 시드 스크립트 환경 설정

```bash
cd "C:/Alien Agentic/automation/intranet/alien-config/seeds"
cp .env.example .env
# .env 를 열어서 WORKSPACE_ID, OWNER_ID, RUNTIME_ID 세 자리 채우기
```

### 6. 27명 시드 실행

```bash
# alien-config/seeds 폴더에서
"C:/Alien Agentic/automation/cli/.venv/Scripts/python.exe" -m pip install -r requirements.txt
PYTHONUTF8=1 "C:/Alien Agentic/automation/cli/.venv/Scripts/python.exe" seed_agents.py
```

성공 출력 예시:
```
발견된 외계 동료: 27명
  + agent-architect (HOW, opus)
  + automation-coder (WHAT, sonnet)
  ...
완료: 신규 27명 / 스킵 0명
```

이제 http://localhost:3000 → **Settings → Agents** 에 27명이 정렬되어 보입니다.

## 다시 시드할 때 (idempotent)

`seed_agents.py` 는 *같은 workspace + name* 이 이미 있으면 SKIP. 27명 정의(`.claude/agents/*.md`)가 변경되면:

- **신규 추가**: 새 `.md` 파일 → 다시 실행하면 *추가만* 됨
- **기존 변경**: 현재 스크립트는 *INSERT 만 함*. *UPDATE* 가 필요하면 Multica UI에서 직접 수정 또는 후속 `update_agents.py` (Phase 2)

## Multica 본진과의 분리 원칙

| 자리 | 위치 | git 추적 |
|---|---|---|
| **Multica 본진** | `automation/intranet/multica/` | ❌ (`.gitignore`) — 업스트림 그대로 |
| **우리 커스터마이즈** | `automation/intranet/alien-config/` | ✅ git에 포함 |
| **27명 정의 (single source of truth)** | `.claude/agents/*.md` | ✅ git에 포함 |
| **시드된 DB 데이터** | Docker volume `pgdata` | ❌ (로컬만) |

Multica 업그레이드 시:
```powershell
cd automation/intranet/multica
git pull
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```
우리 데이터(workspace, agents, issues)는 *Docker volume*에 보존 — 영향 X.

## 다음 자리 (Phase 1.5 이후)

- `aa serve` — `aa` CLI 한 명령으로 Multica 가동
- `aa seed` — `seed_agents.py` 를 CLI에서 호출
- `aa sync` — `.claude/agents/*.md` 변경분을 Multica DB에 자동 반영 (양방향)
- Tailscale 연결로 모바일 접근 (`docs/guides/tailscale-setup.md`)
