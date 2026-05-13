# Discord Webhook 가이드 (Phase 2 — 셋업까지만)

> 목적: 에이전트가 메시지를 적으면 Discord 채널에 자동 push, 기영님은 모바일 푸시로 확인.

## 단계

### 1. Discord 서버 생성 (5분)

1. Discord 앱 또는 https://discord.com 로그인
2. 좌측 `+` → *"내가 직접 만들기"* → *"개인 또는 친구"*
3. 서버 이름: `Alien Agentic`
4. 서버 아이콘은 추후

### 2. 채널 구조

| 채널 | 용도 |
|---|---|
| `#daily-log` | 매일 일지 push |
| `#dashboard` | dashboard.md 변경 시 push |
| `#why-division` | WHY 5명 메시지 |
| `#how-division` | HOW 7명 메시지 |
| `#what-division` | WHAT 7명 메시지 |
| `#mission-control` | CTRL 5명 메시지 |
| `#rnd-lab` | R&D 3명 메시지 |
| `#interventions` | 기영님 개입 메시지 |
| `#alerts` | 보호 트리거·위험 깃발 |

### 3. 채널별 Webhook 추가

각 채널 → 톱니바퀴(채널 편집) → *Integrations* → *Webhooks* → *New Webhook*

- 이름: `aa-bot` (또는 채널 이름)
- 아바타: 외계인 이모지 🛸
- *Copy Webhook URL* — 안전한 자리에 저장

### 4. `.env` 에 URL 박기

`automation/cli/.env`:
```
DISCORD_WEBHOOK_DAILY_LOG=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_DASHBOARD=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_WHY=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_HOW=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_WHAT=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_CTRL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_RND=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_INTERVENTIONS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
```

⚠ Webhook URL은 *비밀번호와 동급* — 절대 git 추적 금지. `.gitignore` 에 이미 `.env` 차단됨.

### 5. 푸시 알림 설정 (모바일)

Discord 모바일 앱 → 서버 → *알림 설정*:
- `#interventions` / `#alerts` → **모든 메시지** (긴급)
- 나머지 → **@mentions만** (조용)
- 평일 18:00~익일 08:00 → *Do Not Disturb* (가족 시간)

### 6. Python 자동 push 코드 (Phase 2 작성 예정)

기본 패턴:
```python
import os
import requests

def post_to_discord(channel: str, content: str) -> None:
    url = os.environ.get(f"DISCORD_WEBHOOK_{channel.upper()}")
    if not url:
        return
    requests.post(url, json={"content": content[:2000]})
```

Phase 2에서:
- `shared-memory/messages/` 새 파일 감지 → 해당 division 채널로 push
- `shared-memory/interventions/` 새 파일 감지 → `#interventions` 푸시
- 보호 트리거 발동 → `#alerts` 푸시

## 다음 → `aa` CLI 통합

Phase 2 에서 `aa serve` 명령어가 fsevents 로 폴더 변경 감시 → webhook 자동 호출.
