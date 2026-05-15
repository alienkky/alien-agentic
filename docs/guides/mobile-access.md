# 모바일 접근 가이드 (iOS / Android)

> 목적: PC가 켜져 있으면 *기영님 핸드폰으로 언제 어디서든* Alien Agentic 자료를 보고 메모를 적는다.

## 3계층 접근 (추천 순)

| 계층 | 무엇을 보는가 | 무엇을 적는가 | 셋업 |
|---|---|---|---|
| **1. Obsidian Mobile + sync** | 모든 `shared-memory/` 자료 | 일지·개입·메시지 메모 | 10~20분 |
| **2. Discord 채널** | 에이전트 알림·푸시 | 빠른 메모 / 중간 개입 | 30분 (Phase 2) |
| **3. SSH + `aa` CLI** | 터미널에서 직접 호출 | `aa call` `aa daily-log` | 15분 |

---

## 계층 1 · Obsidian Mobile + Sync

### Sync 옵션 비교

| 도구 | 가격 | 양 OS | 추천도 |
|---|---|---|---|
| **Syncthing** | 무료 | iOS·Android·PC | ⭐⭐⭐⭐⭐ (P2P, 안전) |
| **Obsidian Sync (공식)** | 월 $4 | iOS·Android·PC | ⭐⭐⭐⭐ (가장 매끄러움) |
| **iCloud Drive** | 5GB 무료 | iOS만 | ⭐⭐ (Android X) |
| **Google Drive** | 15GB 무료 | Android·iOS | ⭐⭐ (sync 충돌 잦음) |

**추천: Syncthing** — 무료 + 양 OS + P2P + 클라우드 거치지 않음 (보안).

### Syncthing 셋업 (Windows + iOS/Android, 약 20분)

**PC 측**:
1. https://syncthing.net → Windows 설치
2. 실행 → `localhost:8384` 자동 열림
3. 폴더 추가: `E:/AlienAgentic/alien-agentic/shared-memory/` → 폴더 ID 기록

**iOS 측**:
- Möbius Sync (무료, App Store)
- 또는 Synction (유료, 더 안정)

**Android 측**:
- Syncthing-Fork (무료, F-Droid)
- 또는 Google Play 의 Syncthing

**페어링**:
1. 모바일 앱에서 PC의 Device ID 추가 (QR 코드 스캔)
2. PC 측에서 새 디바이스 승인
3. 폴더 공유 승인
4. *양방향 sync* 활성화

### Obsidian Mobile 설치

- **iOS**: App Store → "Obsidian"
- **Android**: Google Play → "Obsidian"

설치 후 *"기존 Vault 열기"* → Syncthing이 sync 한 폴더 선택.

## 계층 2 · Discord (Phase 2)

`docs/guides/discord-webhook.md` 참조. Phase 2에서 자동 push 코드 작성 예정.

## 계층 3 · SSH + `aa` CLI

PC에 SSH 서버를 띄우고 모바일 터미널 앱으로 접속해 `aa` 명령어를 직접 실행.

### Windows SSH 서버 (OpenSSH Server)
```powershell
# 관리자 PowerShell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

### 외부 접근 — Tailscale (추천, 무료)

공인 IP나 포트 포워딩 없이 안전한 메시 VPN.

1. https://tailscale.com → 계정 생성 (Google/GitHub 가능)
2. PC 설치 → `tailscale up`
3. 모바일 앱 설치 (iOS/Android 둘 다 있음)
4. 같은 계정으로 로그인 → 자동 페어링
5. PC의 Tailscale IP 확인 (`100.x.x.x` 형태)

### 모바일 터미널 앱

- **iOS**: Termius (무료 tier 충분), Blink Shell (유료)
- **Android**: Termius, JuiceSSH, Termux

연결 후:
```bash
ssh AlienK@100.x.x.x
cd "E:/AlienAgentic/alien-agentic"
aa hello
aa list
aa daily-log today
```

## 가족 시간 보호 — 모바일에서도 유지

헌법 5번에 따라:
- **AI 자체는 24시간 작동** — 모바일에서도 OK
- **새 작업 권유 X** — 저녁/주말 알림 받지 않도록 Syncthing/Obsidian 푸시 비활성
- **자발적 접근만** — 기영님이 *자기 의지로* 들어올 때만 일하기

Discord 채널 알림도 시간대별 *주의 모드* 설정 가능 (Phase 2).
