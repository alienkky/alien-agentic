# 🎤 음성 명령 가이드 — `aa voice`

> 4090 GPU 위에서 Whisper 로컬 STT 로 27명 외계 동료에게 음성으로 명령. **API 키 X**, 한국어·영어 모두 정확.

## 무엇이 가능한가

```
$ aa voice
🎤 음성 명령 ────────────────────────────────
⏺ 녹음 중... [Enter 키로 종료]

[기영님: "스토리위버에게 Alien Agentic 마스터 내러티브 30초 버전 만들어줘"]
[Enter]

녹음 완료 — 5.3초
🔍 음성 인식 중 (Whisper base)...

✓ 인식 결과 ─────────────────────────────────
스토리위버에게 Alien Agentic 마스터 내러티브 30초 버전 만들어줘
─────────────────────────────────────────

자동 감지된 에이전트: story-weaver
어느 에이전트? [story-weaver]: ↵
aa call story-weaver 호출할까요? [Y/n]: ↵

aa call story-weaver 호출 중...
(기존 aa call 흐름 그대로 실행 — 라우팅, 메모리 4파일, 사용량 누적까지)
```

## 설치 — 한 번만 (~3GB)

음성 의존성은 **옵션** (`[voice]` extras) 입니다. 안 쓰는 사람에게 3GB 강요 X.

```powershell
cd "E:/AlienAgentic/alien-agentic/automation/cli"
.\.venv\Scripts\pip.exe install -e ".[voice]"
```

설치 항목:
- `openai-whisper` — STT 엔진 (PyTorch ~2GB 포함)
- `sounddevice` — 마이크 입력 (작음)
- `numpy` — 오디오 배열 (보통 이미 있음)

> Windows 마이크 권한 확인: **설정 → 개인정보 → 마이크 → 데스크톱 앱이 마이크에 액세스하도록 허용** 켜져 있어야 함.

## 첫 실행 — 모델 다운로드

`aa voice` 첫 호출 시 Whisper 가 지정 모델을 자동 다운로드합니다 (HuggingFace 또는 OpenAI CDN).

| 모델 | 크기 | 4090 속도 | 한국어 품질 |
|---|---|---|---|
| `tiny` | 39MB | 1초 미만 | 보통 |
| `base` (기본) | 74MB | 1~2초 | 좋음 |
| `small` | 244MB | 2~3초 | 매우 좋음 |
| `medium` | 769MB | 4~5초 | 우수 |
| `large-v3` | 1.5GB | 5~8초 | **최고** |

4090 에선 `large-v3` 도 거의 실시간이라 — 정확도 우선이면 `--model large-v3` 권장:
```powershell
aa voice --model large-v3
```

## 사용 패턴

### 패턴 1 — Enter 로 직접 종료 (가장 자연스러움)
```powershell
aa voice
```
말 끝나면 Enter. 변동 길이 OK.

### 패턴 2 — 고정 시간 녹음 (스크립트·자동화)
```powershell
aa voice -s 10
```
10초 후 자동 종료.

### 패턴 3 — 에이전트 미리 지정
```powershell
aa voice -a story-weaver
```
음성에서 에이전트 이름을 굳이 말하지 않아도 됨.

### 패턴 4 — 인식만 (실행 X)
```powershell
aa voice --no-execute
```
받아쓰기 용도로만.

### 패턴 5 — 클라이언트 작업
```powershell
aa voice -c baremonday-blbp
```
음성 명령 결과를 특정 클라이언트 워크로 라우팅.

## 에이전트 자동 감지 — 한국어 발음

음성에 다음 키워드가 보이면 자동으로 에이전트 매칭:

| 발음 (예) | 매칭 에이전트 |
|---|---|
| 스토리위버 / 스토리 | `story-weaver` |
| 콘텐트스카웃 / 컨텐트 스카웃 | `content-scout` |
| 케이스 큐레이터 / 케이스 | `case-curator` |
| 유아이 / 유엑스 / 디자이너 | `ui-ux-designer` |
| 브랜드 키퍼 / 브랜드 | `brand-keeper` |
| 오리진 리더 / 오리진 | `origin-reader` |
| 비전 아키텍트 / 비전 | `vision-architect` |
| 워크플로 (우) | `workflow-engineer` |
| 데이터 (전략) | `data-strategist` |
| 케이피아이 / KPI | `kpi-translator` |
| 자동화 / 오토메이션 | `automation-coder` |
| 옵시디언 / 지식 | `knowledge-architect` |
| 영업 / 세일즈 | `sales-closer` |
| 클라이언트 (관리) | `client-concierge` |
| 재무 / 파이낸스 | `finance-tracker` |
| 트렌드 | `trend-hunter` |
| 예측 / 퓨처 | `future-forecaster` |
| (기타 27명 영어 슬러그) | 그대로 매칭 |

매칭 안 되면 — 인식된 텍스트 보고 직접 에이전트 입력. 자동 감지가 틀렸으면 Enter 안 누르고 다른 이름 타이핑.

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `sounddevice` 설치 실패 | Visual C++ Build Tools 필요할 수 있음. 또는 `pip install pipwin && pipwin install pyaudio` 로 대체 후 코드 변경 |
| 마이크 접근 실패 | Windows 마이크 권한 (개인정보 설정), 그리고 다른 앱이 마이크 점유 중인지 확인 (Zoom 등 끄기) |
| 한국어 인식 정확도 낮음 | `--model small` 또는 `--model large-v3` 로 모델 격상 |
| Whisper 모델 다운로드 실패 | 네트워크 / 디스크 공간 (`~/.cache/whisper/`) 확인 |
| GPU 안 쓰는 것 같음 | `python -c "import torch; print(torch.cuda.is_available())"` → `True` 여야 함. False 면 PyTorch CUDA 버전 재설치 |
| 인식 결과가 자꾸 비어있음 | 마이크 음량 / 마이크 위치 / 주변 소음 확인. 또는 `-s 5` 로 고정 길이 시도 |

## 보안 / 프라이버시

- **모든 STT 가 로컬 (4090)** — 음성 데이터가 외부로 전송되지 않음
- 임시 WAV 파일은 전사 직후 삭제
- 인식된 텍스트는 `aa call` 로 흘러 — Claude/ChatGPT 호출 시에만 외부로 (구독 토큰 경유)

## 응용 — 외계 동료 자율 호출에 음성 결합

Multica 데몬을 통해 에이전트가 작업을 받을 때, **음성 메모를 prompt 로** 보낼 수 있음:
1. `aa voice --no-execute > voice_memo.txt` 로 전사만 저장
2. Multica UI 에서 그 텍스트를 이슈 본문으로 붙여넣기
3. 에이전트 배정 → 데몬이 실행

또는 더 직접: `aa voice -a content-scout` 한 줄로 콘텐트스카웃에게 음성 메모 직접 보내기.

## 다음 자리 (Phase 2 이후)

- 응답을 TTS 로 다시 음성 출력 (`aa voice --speak`)
- VAD(음성 활동 감지)로 자동 종료 — Enter 안 눌러도 침묵 1초 후 멈춤
- "Hey 외계인" 웨이크워드 — 항상 대기 + 트리거어 감지 시만 동작
- 모바일(Tailscale 경유) 음성 입력 — iPhone 단축어에서 PC `aa voice` 호출
