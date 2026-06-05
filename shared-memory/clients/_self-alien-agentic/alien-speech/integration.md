# Alien Speech — 통합 청사진 (Phase 1b)

> 담당: 연다리 [integration-specialist] · 작성: 2026-06-05 · 부모 이슈: ALI-90 / ALI-88
> 옵션 2(외부 브릿지) 확정. 펌웨어는 WAV 만 업로드. 브릿지가 Whisper + Multica 처리.

---

## 0. 한 줄 요약

> Pala Memo 가 WAV 를 LAN 의 **브릿지 FastAPI 서버**로 multipart POST → 브릿지가 **OpenAI Whisper API** 로 전사 → **`multica issue update`** 로 Alien Plan 저장 이슈 description JSON 의 `logs[KST_today].sweep` 끝에 append.
> 펌웨어에서 OpenAI 키 **제거**, 브릿지 토큰만 보유. GPT 구조화 호출은 MVP 에서 0건.

---

## 1. 도구 인벤토리 (사용 빈도 ≥ 주 1회)

| 도구 | 역할 | 사용 빈도 | 인증 | 비고 |
|---|---|---|---|---|
| **Multica REST API** (Alien Plan 저장 이슈) | 메모 저장 타깃 | 메모 1건/회 | Multica session token (브릿지 보유 1개) | 핵심 데이터 경로 |
| **OpenAI Whisper API** (`whisper-1`) | 음성→텍스트 | 메모 1건/회 | **기존 Alien Agentic OpenAI 키 재사용** (브릿지 `.env` 의 `OPENAI_API_KEY`) | $0.006/분 |
| **faster-whisper large-v3** (로컬 GPU) | Whisper API 폴백 | 오프라인/장애 시 | 없음 | RTX 4090, ComfyUI 와 GPU 공유 |
| **Tailscale (`alien-4090.taile7f882.ts.net`)** | 브릿지 관리 채널 | 운영자만 | Tailscale OAuth | **펌웨어 트래픽 경로 아님** (ESP32-S3 미지원) |
| **가정 WiFi LAN** | 펌웨어→브릿지 트래픽 | 메모 1건/회 | `X-Bridge-Token` | 브릿지가 `0.0.0.0:18080` listen |

**우선순위 결정**: *전용 MCP 없음 → 직접 API 호출.* CLAUDE.md §8 의 도구 우선순위는 인간/에이전트 상호작용에 해당. 브릿지는 결정론적 자동화라 Multica/OpenAI REST 를 직접 호출하는 것이 정확·저비용·검증 가능.

---

## 2. 브릿지 엔드포인트 스펙

위치: `automation/alien-speech/bridge.py` (FastAPI, uvicorn, 단일 프로세스, 단일 PC).

### 2.1 공통

- **베이스 URL**: 펌웨어에서 `BRIDGE_URL=http://<LAN-IP>:18080` (예: `http://192.168.0.42:18080`).
- **인증**: 모든 요청 헤더 `X-Bridge-Token: <secret>`. 누락/불일치 → `401 invalid_token`.
- **요청·응답 본문**: JSON. 단, `/memo` 의 요청은 `multipart/form-data` (WAV 파트).
- **로깅**: 모든 요청 → `automation/alien-speech/logs/{YYYY-MM-DD}.jsonl` 1행 1요청 (token 마스킹, 헤더만 — WAV 바이트 미저장. WAV 원본은 SD 카드가 진실 원천).
- **CORS·HTTPS**: 가정 LAN + 토큰 인증으로 충분. HTTPS 종단은 불필요(트래픽이 가정망 내부). 단, **운영자 GUI 가 필요해지면 Caddy 로 Tailscale HTTPS** 추가.

### 2.2 `POST /memo` — WAV 수신·처리

**Request**

```
POST /memo HTTP/1.1
Host: <LAN-IP>:18080
X-Bridge-Token: <secret>
X-Pala-Num: 042
X-Pala-Tag: Work
X-Pala-CreatedUtc: 2026-06-05T08:24:11Z
X-Pala-DeviceId: pala-memo-01
Content-Type: multipart/form-data; boundary=----PalaMemo

------PalaMemo
Content-Disposition: form-data; name="wav"; filename="042.wav"
Content-Type: audio/wav

<wav bytes>
------PalaMemo--
```

| 헤더 | 필수 | 값 | 용도 |
|---|---|---|---|
| `X-Bridge-Token` | ✅ | 공유 비밀 | 인증 |
| `X-Pala-Num` | ✅ | 양의 정수 (기기 단조 증가 카운터) | idempotency 키 구성 |
| `X-Pala-Tag` | ✅ | `Work` / `Idea` / `Life` 3종 고정 (펌웨어 UI 에서 선택) — 기영님 확정 2026-06-05 | append 포맷 prefix |
| `X-Pala-CreatedUtc` | ✅ | RFC3339 UTC | `dateKey` 계산 (KST 변환은 브릿지가) |
| `X-Pala-DeviceId` | ✅ | 기기 식별 슬러그 | idempotency 키 + 멀티 기기 대비 |

**Response (성공)**

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "idempotency_key": "pala-memo-01-042",
  "transcript": "오늘 오전엔 니오라 가치 코드 리뷰...",
  "appended_to": "logs.2026-06-05.sweep",
  "issue_id": "<state-issue-uuid>",
  "took_ms": 2840,
  "stt_engine": "openai-whisper"
}
```

**Response (코드)**

| 코드 | 상황 | 펌웨어 측 처리 |
|---|---|---|
| `200 ok` | 전사 + Multica 기록 완료 | SD 의 `042.wav` 를 `042.wav.done` 으로 rename |
| `200 ok_duplicate` | 동일 `idempotency_key` 이미 처리됨 | 동일 — rename 으로 마무리 |
| `202 queued` | Whisper/Multica 일시 장애 → 브릿지 내부 재시도 큐 적재. 펌웨어는 *전송 완료*로 간주. | rename, 단 e-ink 에 "보낸 후 처리 중" 1초 표시 |
| `401 invalid_token` | 토큰 불일치 | 펌웨어 setup 모드 진입 (영구 실패) |
| `413 payload_too_large` | 60초/4MB 초과 | e-ink "녹음 너무 길어요" 표시, SD 보관 (조사용) |
| `415 unsupported_media` | WAV 아닌 헤더 | e-ink "포맷 오류" + SD 보관 |
| `5xx` | 브릿지/Multica 다운 | SD 에 그대로 보관, **다음 동기화 시 자동 재시도** |

### 2.3 `GET /status` — 헬스체크

```
GET /status
X-Bridge-Token: <secret>

200 OK
{
  "ok": true,
  "version": "0.1.0",
  "uptime_s": 84120,
  "queue": { "pending": 0, "failed_today": 1 },
  "last_memo_at": "2026-06-05T08:24:14Z",
  "multica": { "state_issue_id": "...", "last_save_ok": true },
  "stt": { "engine": "openai-whisper", "fallback_ready": true }
}
```

펌웨어가 부팅 시 1회 호출 → 실패 시 e-ink "브릿지 연결 안됨" 표시. 운영자도 Tailscale 로 같은 endpoint 확인.

### 2.4 `POST /replay/{num}` — 실패 재전송

펌웨어가 *부팅 직후* 또는 *Sync 버튼* 시: SD 에 `*.wav` (못 보낸 것) 가 있으면 num 작은 순서로 `/memo` 다시 호출. **별도 endpoint 필요 없음** — 같은 `/memo` 가 idempotent. `/replay/{num}` 는 **운영자용**: 브릿지 큐에 남아있는 실패건을 강제 재시도(예: Multica 복구 후).

```
POST /replay/042
X-Bridge-Token: <secret>

200 OK { "ok": true, "result": "re-queued" }
```

### 2.5 `POST /admin/reset-cursor` — 운영자 도구 (선택)

Idempotency 키 저장소(아래 §4) 의 특정 기기 카운터 재설정. 펌웨어 SD 교체 시 사용.

---

## 3. STT 선택 — **권장: OpenAI Whisper API (primary), faster-whisper large-v3 (fallback)**

### 3.1 비교

| 항목 | OpenAI Whisper API (`whisper-1`) | faster-whisper large-v3 (로컬, fp16) |
|---|---|---|
| 정확도 (한국어) | ★★★★★ (large-v3 기반) | ★★★★★ (동일 모델 계열) |
| 지연 (10초 메모) | 1.2~2.5s | 0.8~1.5s (4090) |
| GPU 점유 | 0 | 4090 VRAM ~4GB, ComfyUI 와 경합 |
| 비용 | $0.006/분. 10초 메모 = $0.001 | 0 (전기료 제외) |
| 키 의존 | OpenAI API key | 없음 |
| 가용성 | OpenAI 다운 시 ✗ | 항상 ✓ |
| 코드 부담 | `openai` SDK 1줄 | 모델 캐시(2.9GB) + warmup |

### 3.2 결정

**Primary = OpenAI Whisper API**. 근거:
1. Pala Memo 트래픽은 *희소·짧음*(하루 ~수 건, 건당 5~60초). 월 비용 < $1.
2. ComfyUI 가 `aa call` 이미지·동영상 작업으로 4090 VRAM 을 *길게* 점유(Flux 20초, LTX 75초). 그 사이 메모가 와도 Whisper API 는 즉답 → e-ink "전송 완료" 까지 ≤ 3초.
3. 기존 `automation/cli/aa/voice.py` 는 *마이크 직접 입력*용. 브릿지는 *WAV 파일*만 받는 다른 경로 → voice.py 재사용 X, 신규 모듈에서 OpenAI SDK 1회 호출.

**Fallback = faster-whisper large-v3 (로컬 GPU)**. 트리거:
- OpenAI 5xx / 타임아웃 3회 연속
- `.env` 의 `STT_FORCE_LOCAL=1` (오프라인 모드)

폴백 모듈 위치: `automation/alien-speech/stt.py` 안에 `transcribe_openai()`, `transcribe_local()`, 라우터 `transcribe()`. **voice.py 의 `transcribe_offline()` 와 모델 캐시 디렉토리(`~/.cache/huggingface`)를 공유** — 두 번 다운로드 방지.

### 3.3 비용 추정 (월)

- 30 메모/일 × 평균 20초 = 10분/일 × 30일 = 300분/월 × $0.006 = **$1.80/월**
- 안전계수 2배 → **월 $4 이내**. finance-tracker 트리거 (월 토큰 80%) 와 무관.

---

## 4. Multica 쓰기 패턴

### 4.1 저장 이슈 find-or-create

저장 이슈 제목: **`🛸 Alien Plan 저장소 (자동 — 수정·삭제 금지)`** (코드 확인됨 — `alien-plan-page.tsx:65`).

```python
# 의사 코드
def get_state_issue_id() -> str:
    cached = read_cache("state_issue_id.txt")
    if cached and issue_exists(cached):
        return cached
    issues = multica_list_issues(workspace_id=WS_ID)
    match = next((i for i in issues if i["title"] == STATE_ISSUE_TITLE), None)
    if match:
        write_cache("state_issue_id.txt", match["id"])
        return match["id"]
    created = multica_create_issue(
        title=STATE_ISSUE_TITLE,
        status="todo",
        description=json.dumps({"logs": {}, "tasks": []}),
    )
    write_cache("state_issue_id.txt", created["id"])
    return created["id"]
```

캐시 파일 위치: `automation/alien-speech/.cache/state_issue_id.txt` (gitignore). 부팅 후 1회 verify.

### 4.2 append 트랜잭션 (낙관적 재시도)

```python
def append_sweep(text: str, kst_date_key: str, idem_key: str) -> AppendResult:
    if idem_key in idem_store():           # §4.3
        return AppendResult.duplicate()
    for attempt in range(3):
        issue = multica_get_issue(state_issue_id)   # 최신 description 재조회
        state = json.loads(issue["description"] or '{"logs":{},"tasks":[]}')
        day = state["logs"].setdefault(kst_date_key, EMPTY_DAY_LOG)
        if idem_marker(idem_key) in day["sweep"]:   # 이미 들어가 있으면 중복
            mark_idem(idem_key)
            return AppendResult.duplicate()
        day["sweep"] = (day["sweep"] + "\n\n" + text).lstrip()
        new_desc = json.dumps(state, ensure_ascii=False)
        try:
            multica_update_issue(state_issue_id, description=new_desc)
            mark_idem(idem_key)
            return AppendResult.ok()
        except ConflictError:
            time.sleep(0.3 * (attempt + 1))         # backoff
    raise AppendError("3회 재시도 실패")
```

- **충돌 검출**: Multica REST 의 `update_issue` 가 If-Match/ETag 지원하지 않으면, 우리가 last-write-wins 위험을 *읽기-쓰기 사이의 짧은 윈도우* 로 한정. 매 시도마다 *방금 읽은 description* 위에 merge 하므로, 동시 UI 저장(1.5s debounce) 과 *겹치는* 1초 미만 윈도우에서만 손실 가능. 3회 재시도 + 0.3/0.6/0.9s backoff 로 거의 모두 회수.
- **idempotency marker**: 텍스트 안에 `[pala #042 · pala-memo-01]` 같은 prefix 가 항상 들어가므로(§5), 동일 메모가 두 번 들어왔는지 *description 자체로* 확인 가능. idem store 가 휘발돼도 안전.
- **JSON 직렬화**: `ensure_ascii=False` (한글 보존), 들여쓰기 없음(파일 크기). UI 가 읽을 때 `JSON.parse` 만 함 → 형식 자유.

### 4.3 idempotency 저장소

- 위치: `automation/alien-speech/.cache/idem.sqlite` (SQLite 1테이블 `processed(key TEXT PRIMARY KEY, at TEXT)`).
- 키 형식: `pala-<deviceId>-<num>` (Phase 1c 와 정합).
- 보존: 영구 (조회 비용 미미). 1년 후에도 같은 num 으로 오면 중복 처리.
- **DB 파일이 사라져도** §4.2 의 marker 검사가 마지막 안전망.

### 4.4 텍스트 append 포맷 (Phase 1c 와 cross-check 필요)

```
\n\n[09:24 KST · pala #042 · Work]\n오늘 오전엔 니오라 가치 코드 리뷰 회의 직후 메모. 디스트리뷰터 호칭 후보가 ...
```

- 한 줄 prefix → 사람이 UI 에서 *어디서 왔는지* 즉시 식별.
- `09:24 KST` = `X-Pala-CreatedUtc` 를 `Asia/Seoul` 로 변환.
- `dateKey` = 같은 KST 시각의 `YYYY-MM-DD`.
- 빈 sweep 이면 leading `\n\n` 은 `.lstrip()` 으로 제거.

**Phase 1c (`차곡담`) 와 충돌 가능 자리**: 포맷 문자열·dateKey 결정 규칙. 1c 결과가 나오면 *1c 규칙을 따른다*. 이 문서는 `data-model.md` 가 비어있을 때의 **잠정 기본값**.

---

## 5. GPT 구조화 호출 — **MVP 에서는 0건**

### 5.1 결정

- Phase 1c MVP = "sweep 만 append, task 분기 없음" 가능성 매우 높음. 그렇다면 GPT 호출 *불필요*.
- `tag` 는 펌웨어에서 이미 사용자가 골라 헤더로 전달 → 자동 분류 모델 *지금은 불필요*.
- 비용·지연·실패 면을 모두 줄임 (메모 1건 처리 ≤ 3초 유지).

### 5.2 v2 시나리오 (선택)

Phase 1c 가 *"태그 → task 승격"* 을 채택할 경우에만 추가:

- 모델: `gpt-4o-mini` (응답 100~200토큰, $0.00015/회).
- 프롬프트: "다음 한국어 메모를 보고 `{title, priority, estimatedMin}` JSON 으로 반환. 메모가 단순 회고면 `null` 반환."
- 호출 위치: `automation/alien-speech/structure.py` (현재는 미작성 — Phase 2 에서 필요 시 추가).
- 트리거: `X-Pala-Tag == "Task"` 일 때만. 다른 태그는 sweep 으로 직행.

### 5.3 보안

- OpenAI 키는 `.env` 의 `OPENAI_API_KEY` — **기존 Alien Agentic OpenAI 계정 키 재사용** (별도 project 분리 안 함, 기영님 확정 2026-06-05). **펌웨어로 절대 내려보내지 않음.**
- WAV 는 OpenAI 에 전송 → OpenAI 정책상 모델 학습 미사용(2026 기준). PII 우려 메모는 *나중에 §6 의 PII 정책* 으로 마스킹 (1c 권한).

---

## 6. 펌웨어 측 변경 범위

> 펌웨어 소스는 로컬(레포 외부). 다음은 *공도율 (subagent-builder/automation-coder)* 이 받아 그대로 적용할 패치 명세.

### 6.1 `secrets.h` 변경

```c
// 삭제
// const char* OPENAI_API_KEY = "sk-...";  ❌

// 신규 (가정 LAN IP, 운영 중 변경 가능 → 셋업 모드에서 재입력 권장)
const char* BRIDGE_URL    = "http://192.168.0.42:18080";
const char* BRIDGE_TOKEN  = "<32바이트 랜덤>";
const char* DEVICE_ID     = "pala-memo-01";
const char* WIFI_SSID     = "...";
const char* WIFI_PSK      = "...";
```

`secrets.h` 는 git 추적 금지(`.gitignore` 확인). 기존에 들어있던 OpenAI 키는 **물리적 삭제 + git history 점검** 후 키 *회전*. (헌법 §7 보안 컨벤션)

### 6.2 `network.cpp` 변경

`transcribeOnce(...)` 함수: *기능 변경* — Whisper 호출 제거, 브릿지 업로드 추가. **이름도 `uploadToBridge(num, tagId, wavPath)` 로 rename**. 호출처(메뉴 핸들러) 도 같이 갱신.

```cpp
// 의사 코드 — 실제 펌웨어는 ArduinoHttpClient + Multipart helper 사용
bool uploadToBridge(uint32_t num, Tag tag, const char* wavPath) {
    File wav = SD.open(wavPath, FILE_READ);
    if (!wav) return false;

    HttpClient http(client, BRIDGE_HOST, BRIDGE_PORT);
    http.beginRequest();
    http.post("/memo");
    http.sendHeader("X-Bridge-Token", BRIDGE_TOKEN);
    http.sendHeader("X-Pala-Num", String(num));
    http.sendHeader("X-Pala-Tag", tagLabel(tag));
    http.sendHeader("X-Pala-CreatedUtc", iso8601_utc(rtcNow()));
    http.sendHeader("X-Pala-DeviceId", DEVICE_ID);
    http.sendHeader("Content-Type", "multipart/form-data; boundary=----PalaMemo");
    http.sendHeader("Content-Length", String(multipartLen(wav.size())));
    http.beginBody();
    writeMultipartHeader(http, "wav", "042.wav", "audio/wav");
    streamFile(http, wav);                      // 청크 단위 push
    writeMultipartFooter(http);
    http.endRequest();

    int code = http.responseStatusCode();
    wav.close();
    if (code == 200 || code == 202) {
        renameToDone(wavPath);
        return true;
    }
    // 401/413/415 는 영구 실패 → 별도 폴더 (`/failed/`)
    if (code == 401 || code == 413 || code == 415) {
        moveToFailed(wavPath, code);
    }
    return false;
}
```

- **새 함수 추가 vs 기존 교체**: *교체* (rename + 시그니처 변경). Whisper 직접 호출은 더 이상 어떤 경로에서도 사용 안 함 → dead code 잔존 금지.
- **재시도 큐**: SD 의 `recordings/` 폴더에 못 보낸 `.wav` 가 남으면, 부팅 직후 + Sync 메뉴 진입 시 enumerate → 작은 num 부터 `uploadToBridge()` 재호출. 이 로직은 이미 V1.0 에 있는 *Sync* 코드와 연결되므로 추가 부담 작음.
- **e-ink 표시**: `전송중 → 완료` (200) / `재시도 대기` (5xx) / `오류 #코드` (4xx 영구).

### 6.3 부팅 시 헬스체크

`setup_network()` 마지막에 `GET /status` 호출. 실패 시 e-ink "브릿지 연결 안됨, 메모는 SD 에만 저장됩니다". 사용자는 계속 녹음 가능, 동기화는 나중.

### 6.4 변경 영향 요약

| 파일 | 변경 |
|---|---|
| `secrets.h` | OpenAI 키 삭제, 브릿지 3종 추가 |
| `network.cpp` | `transcribeOnce` → `uploadToBridge` 교체, `/status` 호출 추가 |
| `menu.cpp` (Sync 핸들러) | 호출명 변경, 재시도 enumerate 로직 강화 |
| `display.cpp` | e-ink 상태 라벨 3종 추가 |
| `.gitignore` | `secrets.h` 가 있는지 재확인 |

빌드 후 회귀 테스트는 Phase 3 (`qa-tester`) 에서.

---

## 7. 데이터 흐름·인증·익명화

```
[Pala Memo] ── WAV bytes ──▶ [Bridge:18080] ──▶ OpenAI Whisper API ──▶ (text)
                                  │
                                  ├─ multica issue get/update ──▶ Alien Plan UI
                                  └─ idem.sqlite + logs/

[운영자]   ── Tailscale ──▶ [Bridge:18080/status, /replay]
```

| 구간 | 데이터 | 인증 | 익명화 |
|---|---|---|---|
| Pala → Bridge | WAV + 헤더 | `X-Bridge-Token` | 없음 (LAN 내부) |
| Bridge → OpenAI | WAV bytes | `OPENAI_API_KEY` | OpenAI 정책상 학습 미사용 |
| Bridge → Multica | description JSON | Multica session token (브릿지 보유) | 메모 원문 그대로 (개인 메모) |
| Bridge → `shared-memory/meta/voice-memos/` (1c 결정에 따라) | 텍스트 | 로컬 파일 | **PII 마스킹은 Phase 1c (`차곡담`) 권한** — 본 문서는 hook 만 노출 |

PII hook: 브릿지에 `automation/alien-speech/anonymize.py` (stub) — 1c 결정 전엔 *no-op*. 결정 후 정규식·LLM 마스킹 추가.

---

## 8. 최소 권한 원칙 점검표

- [x] 펌웨어: OpenAI 키 보유 X, 브릿지 토큰 1개만.
- [x] 브릿지: Multica session token 1개(쓰기 가능). 다른 워크스페이스 접근 X.
- [x] 브릿지: OpenAI 키 1개. 다른 organization·project key X (전용 project 권장).
- [x] Tailscale: 펌웨어가 아닌 *운영자만*. 펌웨어는 LAN 한정.
- [x] 모든 비밀: `.env` 파일 1개에 모음, `.gitignore` 확정. 브릿지 시작 시 `.env` 부재면 즉시 실패.

---

## 9. 핸드오프

| 다음 | 무엇을 | 어디서 |
|---|---|---|
| `mcp-connector` | (해당 없음 — 직접 API) | — |
| `data-strategist` (Phase 1c, 차곡담) | append 포맷·dateKey·idempotency 키·PII 정책 확정 | `data-model.md` |
| `workflow-engineer` (Phase 1a, 류한길) | E2E 시퀀스·실패 모드 다이어그램 | `workflow.md` |
| `automation-coder` / `subagent-builder` (Phase 2a, 공도율) | 본 스펙대로 `bridge.py` + 펌웨어 패치 구현 — **기영님 결정 2026-06-05: Phase 1a/1c 완료 전에 같이 진행 (선행 착수)**. 1a/1c 결과가 충돌하면 §4.3/§4.4 만 사후 보정 | `automation/alien-speech/`, 펌웨어 |
| `qa-tester` (Phase 3) | E2E 시나리오 3종 (해피·중복·다운) | `qa/scenarios.md` |

**cross-check 메시지**: Phase 1a/1c 산출물이 도착하면 본 문서 §4.4 의 append 포맷·§4.3 의 idem key 를 *1c 정의로 교체*. 충돌 발견 시 `shared-memory/messages/` 경유.

---

## 10. 미해결

### 기영님 확정 (2026-06-05)
- **OpenAI 키**: 기존 Alien Agentic 키 재사용 (전용 project 미분리). §1·§5.3 반영.
- **펌웨어 태그**: `Work` / `Idea` / `Life` 3종 고정. §2.2 반영.
- **Phase 2a 빌드 타이밍**: 1a/1c 와 같이 진행 (선행 착수). §9 반영. ALI-92 promote.

### 남은 자리
1. **브릿지 LAN IP 고정 방식** — 공유기 DHCP 예약 vs 4090 PC 의 정적 IP. 권장: 공유기 DHCP 예약 (재설정 비용 0). *공도율*이 셋업 시점에 결정.
2. **WAV 최대 길이** — 펌웨어 V1.0 의 최대 녹음 시간이 60초인가 더 긴가. 본 문서는 60초/4MB 가정. *공도율*이 펌웨어 코드 확인 후 확정.
3. **저장 이슈가 동시에 잠겼을 때 (UI 와 메모가 같은 1초에 저장)** — 3회 재시도로 회수되지 않으면 SD 에 남기고 다음 동기화. *기영님 결정 불필요* (자동 회수).

🛸
