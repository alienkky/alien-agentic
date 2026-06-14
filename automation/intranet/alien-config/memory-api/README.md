# Alien Memory API -- sidecar 컨테이너

> 27명 외계 에이전트의 메모리 4파일(work/learnings/decisions/mistakes.md)을
> Multica UI 에서 *보고 + 편집* 할 수 있게 하는 작은 sidecar API.

## 왜 sidecar 인가?

Multica 컨테이너는 호스트의 `shared-memory/agents/` 를 못 본다 (격리됨). 그리고
Multica 백엔드를 수정하면 *업스트림 drift* 가 커진다. 그래서 **자체 컨테이너
하나를 옆에 두고** 거기로 메모리 파일을 노출한다.

- Multica frontend 와 같은 호스트의 다른 포트(8765)
- Caddy 가 `/api/alien-memory/*` 를 sidecar 로 reverse_proxy
- 외부 노출 0 -- Tailscale tailnet + Caddy 만 인증 게이트

## 가동

```powershell
cd e:\AlienAgentic\alien-agentic\automation\intranet\alien-config\memory-api
docker compose up -d --build
```

autostart-serve.ps1 에도 통합되어 있으니 부팅 후 자동 가동된다.

## 헬스체크

```powershell
curl http://127.0.0.1:8765/health
```

기대:
```json
{
  "ok": true,
  "data_dir": "/data/agents",
  "data_dir_exists": true,
  "allowed_files": ["work.md", "learnings.md", "decisions.md", "mistakes.md"],
  "max_file_bytes": 4194304,
  "ts": 1779860000.0
}
```

`data_dir_exists: false` 면 volume mount 가 깨진 것. docker-compose.yml 의
`volumes` 경로 확인.

## 엔드포인트

| 메소드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 + 마운트 진단 |
| GET | `/agents` | 27명 목록 + 각 파일 메타 |
| GET | `/agents/{name}/{file}` | 파일 raw 내용 (text/plain) |
| PUT | `/agents/{name}/{file}` | 파일 저장 (JSON body: `{"content": "..."}`) |

`{name}` = 에이전트 디렉토리명 (예: `origin-reader`)
`{file}` = 4파일 화이트리스트 중 하나

## 보안

- path traversal 차단 (`..`, `/`, `\`, 빈 이름, 숨김)
- 파일명 화이트리스트 (4종 외 모두 거부)
- 파일 최대 4MB (DoS 방지)
- 자체 인증 X -- LAN-only bind + Caddy + Tailscale tailnet 경계가 인증

## 트러블슈팅

### `data_dir_exists: false`
호스트 `shared-memory/agents/` 가 마운트 안 됨. docker-compose.yml 의 volumes
경로 확인. 4단계 상위(`../../../../`)가 repo root 의 `shared-memory/agents/` 와
일치해야 함.

### `404 agent not found`
디렉토리명 오타. `ls e:\AlienAgentic\alien-agentic\shared-memory\agents` 로
실제 이름 확인.

### Caddy 가 502/connection refused
`docker compose ps` 로 컨테이너 가동 확인. 죽었으면 로그:
`docker compose logs alien-memory-api`.
