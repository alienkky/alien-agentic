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

## 셋업 흐름 (3단계, 약 15~20분)

### 1. Multica 본진 가동

처음 한 번:

```powershell
# PowerShell, E:/AlienAgentic/alien-agentic 에서
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

### 3. 27명 시드 — `aa seed` (권장)

옛 3~6단계(psql 수작업)를 한 명령으로 압축. `WORKSPACE_ID`·`OWNER_ID` 자동 탐색, `agent_runtime` 자동 생성, 27명 INSERT 까지 한 번에:

```powershell
cd "E:/AlienAgentic/alien-agentic/automation/cli"
.\.venv\Scripts\aa.exe seed
```

- 워크스페이스 slug 가 `alien-agentic` 이 아니면 → `aa seed --slug <slug>`
- 같은 Multica 에 사용자가 여럿이면 → `aa seed --email <기영님 이메일>`
- 미리보기 (DB 변경 없음) → `aa seed --dry-run`

성공 출력:
```
WORKSPACE_ID: 3f9a...
OWNER_ID:     7c21...
RUNTIME_ID:   b88e...  (신규 생성)
발견된 외계 동료: 27명
✓ 시드 완료: 신규 27명 / 스킵 0명
```

이제 http://localhost:3000 → **Settings → Agents** 에 27명이 정렬되어 보입니다.

> `aa seed` 는 모든 DB 작업을 `docker exec` 로 컨테이너 안에서 처리하므로 postgres 포트 노출이 필요 없다. 같은 `name` 이 이미 있으면 SKIP (idempotent).

---

### 수작업 시드 (대안 — `aa seed` 가 막힐 때)

스키마가 예상과 다르거나 `aa seed` 가 실패하면, `seed_agents.py` 로 직접:

```bash
# (a) ID 확인
docker exec multica-postgres-1 psql -U multica -d multica -c \
  'SELECT id, slug FROM workspace; SELECT id, email FROM "user";'

# (b) fake agent_runtime 생성 — agent.runtime_id 가 NOT NULL 이라 필요
WS_ID="(a 의 workspace id)"; OWNER_ID="(a 의 owner id)"
docker exec multica-postgres-1 psql -U multica -d multica -c \
  "INSERT INTO agent_runtime (workspace_id, owner_id, name, runtime_mode, provider, status) VALUES ('$WS_ID', '$OWNER_ID', 'alien-agentic-local', 'local', 'claude_code', 'online');"
docker exec multica-postgres-1 psql -U multica -d multica -t -A -c \
  "SELECT id FROM agent_runtime WHERE workspace_id = '$WS_ID' ORDER BY created_at DESC LIMIT 1;"

# (c) seeds/.env 채우고 스크립트 실행 (postgres 5432 포트가 호스트에 노출돼 있어야 함)
cd "E:/AlienAgentic/alien-agentic/automation/intranet/alien-config/seeds"
cp .env.example .env   # WORKSPACE_ID, OWNER_ID, RUNTIME_ID 세 자리 채우기
"E:/AlienAgentic/alien-agentic/automation/cli/.venv/Scripts/python.exe" -m pip install -r requirements.txt
PYTHONUTF8=1 "E:/AlienAgentic/alien-agentic/automation/cli/.venv/Scripts/python.exe" seed_agents.py
```

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

- ~~`aa serve` — `aa` CLI 한 명령으로 Multica 가동~~ ✅ 완료
- ~~`aa seed` — 27명 시드를 CLI 한 명령으로~~ ✅ 완료
- `aa sync` — `.claude/agents/*.md` 변경분을 Multica DB에 자동 반영 (양방향, UPDATE 포함)
- Tailscale 연결로 모바일 접근 (`docs/guides/tailscale-setup.md`)
