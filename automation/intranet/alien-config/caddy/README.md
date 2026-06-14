# Caddy — Multica HTTPS 종결 + WebSocket 프록시

> *왜 tailscale serve 대신 Caddy 인가?* — 2026-05-27, `tailscale serve --https=443` 가
> WebSocket Upgrade 핸드셰이크를 forward 못 해 Multica 실시간 푸시(받은함 카운팅·
> 에이전트 상태·코멘트)가 죽는 사고 발생. localhost 직접 접속은 OK, Tailscale 경유만
> 실패 → 프록시 레이어가 범인 확정. Caddy 는 Upgrade 헤더 자동 감지로 WS 를 native
> 프록시한다.

## 경로

```
[브라우저]
   │  wss://alien-4090.taile7f882.ts.net
   ▼
[Tailscale tailnet]   ← 100.x.x.x 사설 IP 만 도달 가능 (LAN-only)
   │
   ▼
[Caddy:443]   ← Tailscale 인터페이스에만 bind (외부 NIC 노출 X)
   │  http + ws (Upgrade)
   ▼
[Multica frontend localhost:3000]
   │
   ▼
[Multica backend / postgres / ...]
```

## 최초 셋업 (1회)

```powershell
# 관리자 PowerShell 권장 (Task Scheduler 등록 때문)
e:\AlienAgentic\alien-agentic\automation\intranet\alien-config\scripts\setup-caddy.ps1
```

스크립트가 자동으로:

1. **caddy.exe 확인** — 없으면 Caddy 공식 다운로드 안내
2. **Tailscale IP + hostname 추출** — `tailscale ip --4`, `tailscale status --json`
3. **Tailscale cert 발급** — `tailscale cert <hostname>` → `certs/` 에 저장
4. **Caddyfile 생성** — 템플릿 + 환경변수 치환
5. **tailscale serve reset** — 기존 443 점유 해제
6. **Task Scheduler 등록 2개**
   - `AlienAgentic-Caddy` — 로그온 시 Caddy 가동 (+30초 지연)
   - `AlienAgentic-CertRefresh` — 매주 일요일 03:00 인증서 갱신 점검
7. **Caddy 즉시 가동** — `Start-ScheduledTask`

## 검증

```powershell
# Caddy 떠 있는지
Get-Process caddy

# 어떤 IP:포트 listen 중인지
Get-NetTCPConnection -LocalPort 443 -State Listen

# 브라우저에서
# https://alien-4090.taile7f882.ts.net  → 페이지 정상
# F12 → 네트워크 → ws? 항목 → "응답 헤더" 에 101 Switching Protocols 떨어지는지
```

## 롤백 (Caddy 가 깨졌을 때)

```powershell
# Caddy 중지·비활성화
Stop-ScheduledTask -TaskName "AlienAgentic-Caddy" -ErrorAction SilentlyContinue
Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force

# tailscale serve 로 복귀 (broken WS 상태로 일단 접속은 가능)
tailscale serve --bg --https=443 http://localhost:3000
```

## 인증서 갱신 정책

- Tailscale cert 는 **90일 유효**
- `refresh-tailscale-cert.ps1` 가 **30일 이하 남으면 갱신**
- Task Scheduler 로 매주 일요일 03:00 점검
- 수동 즉시 갱신: 같은 스크립트를 인자 없이 실행

## 파일 구조

```
caddy/
├── Caddyfile.template   ← git 추적 (이 파일이 진실의 원천)
├── Caddyfile            ← setup-caddy 가 생성 (gitignore)
├── .env                 ← 환경변수 (TAILSCALE_IP, HOST 등) (gitignore)
├── caddy.exe            ← 바이너리 (gitignore)
├── certs/               ← Tailscale cert 출력 (gitignore)
│   ├── {host}.crt
│   └── {host}.key
└── logs/                ← Caddy access log (gitignore, 10MB roll)
    └── access.log
```

## CLAUDE.md 와의 정합

이 디렉토리는 **HTTPS 종결**의 단일 진입점이다. autostart-serve.ps1 은 더 이상
`tailscale serve --https` 를 호출하지 않는다 — Caddy Task 가 그 역할을 가진다.

직접 `tailscale serve --https` 를 다시 호출하면 Caddy 와 443 점유 충돌이 나서
Caddy 가 죽고 다시 broken WS 상태로 회귀한다.
