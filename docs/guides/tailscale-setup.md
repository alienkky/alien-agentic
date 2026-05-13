# Tailscale 셋업 가이드 — PC ↔ 모바일 양방향

> 목적: PC가 켜져 있으면 *기영님 핸드폰에서 어디서든* Multica 인트라넷(`localhost:3000`) + `aa` CLI(SSH) 양쪽에 안전하게 접근.

Tailscale은 *메시 VPN* — 공인 IP·포트 포워딩·복잡한 방화벽 설정 없이 자기 디바이스끼리만 안전한 사설망을 구성합니다.

---

## 1. Tailscale 계정 + PC 설치 (5분)

### 계정 생성
https://tailscale.com → *Get started* → Google / GitHub / Microsoft 로 로그인.

무료 플랜 — 개인 디바이스 100대까지.

### Windows 설치

```powershell
winget install -e --id Tailscale.Tailscale
```

설치 후 자동으로 트레이 아이콘 등장. 클릭 → *Log in* → 브라우저로 인증 → 끝.

### 확인
```powershell
tailscale status
tailscale ip -4
```

PC의 Tailscale IP가 `100.x.x.x` 형태로 나옵니다. 이 IP를 다른 디바이스에서 접근 가능.

---

## 2. 모바일 앱 설치 (3분)

### iOS
- App Store → *Tailscale*
- 같은 계정으로 로그인
- 활성화 토글

### Android
- Google Play → *Tailscale*
- 같은 계정 로그인
- VPN 권한 허용 (실제 트래픽은 *디바이스 간만*, 외부로 안 나감)

---

## 3. Multica 모바일 접근 — `aa serve` 통합

PC에서:
```powershell
cd "C:/Alien Agentic/automation/cli"
.\.venv\Scripts\aa.exe serve
```

`http://localhost:3000` 가 PC에서 작동 확인.

### 모바일에서 접근

**기본 (localhost 우회)**: 모바일 브라우저에서 `http://100.x.x.x:3000` (PC의 Tailscale IP).

**더 매끄럽게 — MagicDNS**: Tailscale 관리 UI → *DNS* → *MagicDNS* 활성화. 그러면:
```
http://<PC의 호스트명>:3000
```
예: `http://alienkim-pc:3000`

### 외부에서 다른 사람에게 공유 — `tailscale serve`

```powershell
# PC의 :3000 을 HTTPS로 외부 공개
tailscale serve https / http://localhost:3000
```

→ `https://<PC명>.<tailnet>.ts.net` 같은 *공개 URL* 발급. 클라이언트도 접근 가능 (인증 옵션 추가 가능).

⚠ *공개 URL* 은 진짜 외부 접근. *기영님 본인 모바일만* 쓰려면 위 (localhost:3000 via Tailscale IP) 가 충분.

---

## 4. `aa` CLI 모바일 접근 — SSH

### Windows SSH 서버

```powershell
# 관리자 PowerShell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

### 모바일 SSH 앱

- **iOS**: Termius (무료 tier), Blink Shell (유료)
- **Android**: Termius, JuiceSSH, Termux

연결 설정:
- Host: `100.x.x.x` (PC Tailscale IP) 또는 MagicDNS 이름
- User: `AlienK`
- Auth: 비밀번호 또는 SSH 키 (권장)

연결 후:
```bash
cd /c/Alien\ Agentic
.\automation\cli\.venv\Scripts\aa.exe hello
.\automation\cli\.venv\Scripts\aa.exe list
.\automation\cli\.venv\Scripts\aa.exe call origin-reader "테스트" --dry-run
```

---

## 5. 가족 시간 보호 — 헌법 5번

- **AI 자체는 24시간 작동.** Multica 서버도 PC가 켜져 있는 한 항상.
- **모바일 알림은 시간대별 *방해 금지*** 설정:
  - Discord (Phase 2 통합 후) → 평일 18:00~익일 08:00 DND
  - Multica → 향후 푸시 알림 추가 시 동일
- 기영님이 *자발적으로* 접속하면 작동. 시스템이 *먼저 권유 안 함*.

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `tailscale` 명령어 없음 | PowerShell 닫고 새로 열기 (PATH 갱신) |
| 모바일에서 `100.x.x.x:3000` 연결 X | PC 방화벽 확인 — Windows Defender 가 Docker/포트 차단 가능. 인바운드 규칙에서 3000 허용 |
| MagicDNS 가 안 됨 | Tailscale 관리 UI → *DNS* → *Override local DNS* 활성 필요 |
| 모바일에서 SSH 연결 X | PC의 SSH 서비스 작동 확인 — `Get-Service sshd` → Running 이어야 |
| Docker 컨테이너 외부 접근 안 됨 | `docker-compose.selfhost.yml` 의 frontend 포트가 `0.0.0.0:3000` 으로 바인딩됐는지 확인 (기본값 OK) |

---

## 다음 자리 (Phase 2)

- Discord webhook + Tailscale 통합 — *Multica 알림 → Discord 채널 → 모바일 푸시*
- `aa serve --tunnel` — `tailscale serve` 자동 호출
- *aa mobile* 명령 — 모바일 접속 URL + QR 코드 표시
