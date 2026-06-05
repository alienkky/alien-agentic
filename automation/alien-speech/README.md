# Alien Speech 브릿지

Pala Memo (ESP32-S3 e-ink) → WAV → OpenAI Whisper → Alien Plan 저장 이슈 append.

설계 출처: [Phase 1b 통합 청사진](../../shared-memory/clients/_self-alien-agentic/alien-speech/integration.md)
부모 이슈: [ALI-88 Alien Speech 파이프라인](mention://issue/4b2192a9-a7dc-4875-8091-f470f7c50ea5)
빌드 이슈: [ALI-92 Phase 2a · FastAPI 브릿지](mention://issue/8a6f46c1-b80a-4616-b951-a7b9931be769)

## 한 줄 요약

펌웨어가 WAV 를 LAN 의 FastAPI(`:8788`) 로 POST → 브릿지가 Whisper 로 전사 → `multica issue update` 로 Alien Plan 저장 이슈의 `logs[KST_today].sweep` 끝에 append.

## 구성

```
automation/alien-speech/
├── bridge/                # Python 패키지
│   ├── app.py             # FastAPI (POST /memo · GET /status · POST /replay/{num})
│   ├── config.py          # .env → Config (require_runtime 검증)
│   ├── stt.py             # OpenAI Whisper API + faster-whisper 폴백
│   ├── alien_plan.py      # 저장 이슈 find-or-create + JSON 머지 update (3회 재시도)
│   ├── idempotency.py     # SQLite 중복 처리 방지
│   ├── monitor.py         # 5분 timeout / 3-strike → Discord + Multica 코멘트
│   ├── daily_digest.py    # 17:45 KST 요약 — ALI-88 코멘트
│   ├── discord.py         # webhook 어댑터
│   ├── multica_cli.py     # `multica` CLI subprocess 래퍼
│   ├── logger.py          # JSONL 일자 파티션 로그
│   └── __main__.py        # `python -m bridge`
├── scripts/
│   └── install-service.ps1  # Windows Task Scheduler 부팅 자동시작
├── tests/                 # pytest (unit + dry-run 통합)
├── logs/                  # JSONL 일자 파티션 (gitignore)
├── .cache/                # idem.sqlite + state_issue_id.txt (gitignore)
├── .env.example
└── requirements.txt
```

## 빠른 시작 (로컬)

```powershell
# 1. 의존성
cd automation\alien-speech
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. 환경 변수
Copy-Item .env.example .env
# .env 편집 — BRIDGE_TOKEN, OPENAI_API_KEY, MULTICA_WORKSPACE_ID 채우기

# 3. dry-run (Multica 안 건드림)
$env:ALIEN_SPEECH_DRY_RUN = "true"
python -m bridge

# 다른 터미널에서:
curl -X POST http://localhost:8788/memo `
    -H "X-Bridge-Token: $env:BRIDGE_TOKEN" `
    -H "X-Pala-Num: 1" `
    -H "X-Pala-Tag: Idea" `
    -H "X-Pala-CreatedUtc: 2026-06-05T08:24:11Z" `
    -H "X-Pala-DeviceId: pala-memo-01" `
    -F "wav=@test.wav;type=audio/wav"
```

## 실배포 (RTX 4090 PC, Windows Task Scheduler)

```powershell
# 관리자 PowerShell
cd automation\alien-speech
.\scripts\install-service.ps1
```

스크립트는 다음을 등록한다:
- **Task 이름**: `AlienSpeechBridge`
- **트리거**: 시스템 부팅 + 1분 지연
- **재시작**: 작업 실패 시 1분 후 3회 재시도
- **실행**: `python -m bridge` (작업 디렉토리 = `automation/alien-speech/`)
- **로그아웃 후에도 실행**: ✅ (Run whether user is logged on or not)

부팅 후 확인:
```powershell
Get-ScheduledTask -TaskName AlienSpeechBridge
Invoke-RestMethod http://localhost:8788/status -Headers @{ "X-Bridge-Token" = $env:BRIDGE_TOKEN }
```

## 엔드포인트

자세한 스펙은 [integration.md §2](../../shared-memory/clients/_self-alien-agentic/alien-speech/integration.md).

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/memo` | multipart WAV + `X-Pala-*` 헤더 → STT + Alien Plan append |
| `GET`  | `/status` | 헬스 + 인플라이트 큐 + 연속 실패 카운터 |
| `POST` | `/replay/{num}` | 운영자용 — idem 키 리셋 후 다음 `/memo` 가 다시 처리 |

응답 코드:
- `200 ok` / `200 ok_duplicate` / `200 ok_dry_run`
- `401 invalid_token`
- `400 missing_pala_headers` / `400 invalid_num` / `400 invalid_tag` / `400 invalid_created_utc` / `400 empty_wav`
- `413 payload_too_large` (> 8 MB)
- `415 unsupported_media`
- `502 stt_failed` / `502 multica_failed`
- `500 internal_error`

## 모니터·알림

기영님 결정 2026-06-05:
- `MONITOR_STUCK_SECONDS=300` — 메모 1건 5분 초과 = Discord #alerts 1차 알림
- `MONITOR_STRIKE_LIMIT=3` — 연속 실패 3회 = Discord + Multica 코멘트에서 [@기영님](mention://member/3bf03b6e-fdb3-46bb-a7a9-da4ef9d316ab) + [@공도율](mention://agent/cd966ed7-63ff-40af-b082-b957cbd3c917) mention
- `DAILY_DIGEST_ENABLED=true` — 17:45 KST 에 ALI-88 코멘트로 일일 요약 (운영 첫 1주만)

webhook 셋업: [docs/guides/discord-webhook.md](../../docs/guides/discord-webhook.md)

## dry-run

`ALIEN_SPEECH_DRY_RUN=true` (또는 `.env` 에 박기) 시 STT 까지만 수행하고 Multica 호출은 건너뛴다. 응답에 `status: ok_dry_run` 과 전사 텍스트가 그대로 들어옴. 첫 펌웨어 ↔ 브릿지 통합 테스트용.

## 테스트

```powershell
cd automation\alien-speech
pip install -r requirements.txt
pytest tests -q
```

테스트는 외부 호출(OpenAI, Multica) 을 *모두 mock*. 실제 키 없이 돌아간다.

## 한계 / 다음 단계

1. **WAV 최대 길이** — 현재 8 MB safety cap. 펌웨어 V1.0 최대 녹음 시간 확인 후 조정 (integration.md §10 미해결 2).
2. **HTTPS 종단** — 가정 LAN + 토큰 인증으로 충분. 운영자 GUI 추가 시 Caddy + Tailscale 로 종단 (integration.md §2.1).
3. **GPT 구조화** — MVP 에서 0건. Phase 1c 가 `Task` 태그 → task 분기 채택 시 `structure.py` 추가 (integration.md §5.2).
4. **펌웨어 패치** — 별도 이슈 (Phase 2b). integration.md §6 의 명세 그대로.
