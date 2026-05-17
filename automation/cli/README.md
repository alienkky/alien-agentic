# `aa` — Alien Agentic Master Orchestrator CLI

> 27명의 외계 동료를 한 명령어로 호출·확인·기록한다.
> **Claude Max + ChatGPT Pro 구독 경유** — 별도 API 키 없음.
> `aa call` 은 난이도를 판정해 Claude(표준·심층)와 ChatGPT(경량)를 자동으로 골라 쓴다.

## 설치 (1회만, 약 3분)

### 1. Python 환경 확인

먼저 PowerShell 또는 터미널에서:

```powershell
python --version
```

**기대 결과**: `Python 3.11.x` 또는 그 이상.

#### ⚠ 함정 — Microsoft Store stub (Windows)

`python --version` 이 *아무것도 출력하지 않거나* Microsoft Store 페이지가 열린다면, Windows의 *가짜 Python stub*이 잡혀 있는 겁니다. 이 stub은 `python -m venv` 도 *조용히 실패*시켜서 `.venv` 폴더가 안 만들어집니다.

확인:

```powershell
where.exe python
```

결과에 `Microsoft\WindowsApps\python.exe` 만 보이면 stub입니다.

**해결 — 진짜 Python 설치**:

```powershell
winget install -e --id Python.Python.3.12
```

설치 후 **PowerShell 창을 완전히 닫고 새로 열어주세요** (PATH 갱신 필수). 새 창에서 `python --version` 이 `Python 3.12.x` 로 나오면 정상.

대안: Windows Settings → *앱* → *앱 실행 별칭* → `python.exe` / `python3.exe` 둘 다 *OFF* 한 후 위 winget 명령 실행.

### 2. 가상환경 + 패키지 설치

**Windows · PowerShell** (권장):

```powershell
cd "E:/AlienAgentic/alien-agentic/automation/cli"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

활성화 성공 시 프롬프트 앞에 `(.venv)` 가 붙습니다.

> **PowerShell 실행 정책 에러** (`.ps1 모듈 로드 실패`) 가 나면 1회만:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
> ```

**macOS / Linux · bash**:

```bash
cd "/path/to/Alien Agentic/automation/cli"
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

`pip install -e .` 는 *편집 가능 모드*로 설치 — 코드 수정이 즉시 반영됩니다.

### 3. Claude Code CLI 확인 — Max 구독 활용

**별도 API 키 발급 불필요.** `aa call` 은 Claude Code CLI (`claude`) 를 subprocess로 호출하므로, **Max 구독에 포함된 토큰**을 그대로 사용합니다.

확인:

```powershell
# PowerShell
& "$env:USERPROFILE/.local/bin/claude.exe" --version
```

```bash
# bash / Git Bash
~/.local/bin/claude.exe --version
```

`2.x.x (Claude Code)` 가 나오면 정상.

#### 자동 감지

`aa` CLI 는 다음 순서로 `claude` 바이너리를 찾습니다:
1. `.env` 의 `CLAUDE_BIN` 환경 변수
2. 시스템 `PATH`
3. `~/.local/bin/claude.exe` (Windows 기본)
4. `~/.local/bin/claude` (macOS/Linux)
5. `Program Files/Claude/claude.exe`

다른 위치라면 `.env` 에:
```
CLAUDE_BIN=C:/Users/AlienK/.local/bin/claude.exe
```

#### Claude Code 미설치 시
- 데스크탑 앱: https://claude.com/download
- 또는 npm: `npm install -g @anthropic-ai/claude-code`

### 4. (선택) ChatGPT Pro 연동 — Codex CLI

`aa call` 은 난이도가 낮은 *경량 작업(T1)* 을 ChatGPT Pro 구독으로 덜어내 Claude Max 토큰을 아낀다. 이 두 번째 두뇌를 붙이려면 OpenAI **Codex CLI** 설치 + ChatGPT 로그인이 필요하다 — **API 키 없이** ChatGPT 구독 사용량을 그대로 쓴다.

```powershell
npm install -g @openai/codex
codex login   # 브라우저로 ChatGPT 계정 로그인
```

상세 절차·트러블슈팅·주의점은 [docs/guides/codex-cli-setup.md](../../docs/guides/codex-cli-setup.md) 참조. **이 단계를 건너뛰면** `aa call` 은 모든 작업을 Claude 로만 처리한다 (`--provider claude` 강제와 동일).

### 5. 동작 확인

```bash
aa hello
```

부팅 패널이 뜨면 성공.

---

## 명령어 (v0.1.0 — 10개)

| 명령 | 무엇을 |
|---|---|
| `aa hello` | 마스터 오케스트레이터 부팅 확인 + 헌법 통과 질문 표시 |
| `aa list` | 27명 외계 동료 명단 (Division · Name · Model · Description) |
| `aa list -d WHY` | Division 필터 (WHY / HOW / WHAT / CTRL / R&D) |
| `aa status` | 오늘 일지 + dashboard + 미해결 개입/메시지 카운트 |
| `aa call <agent> "<prompt>"` | 단일 에이전트 호출 — 모달리티·난이도 자동 라우팅 + 메모리 4파일 자동 갱신 |
| `aa call <agent> "<prompt>" --difficulty T3` | 난이도 수동 지정 (T1 경량 / T2 표준 / T3 심층) |
| `aa call <agent> "<prompt>" --provider claude` | 공급자 강제 지정 (claude / chatgpt / comfyui) |
| `aa call <agent> "<prompt>" --modality image` | 모달리티 수동 지정 (text / image / video) |
| `aa call <agent> "<prompt>" --workflow <이름>` | ComfyUI 워크플로 선택 (comfyui_workflows/ 안 파일명) |
| `aa call <agent> "<prompt>" --dry-run` | AI 호출 없이 라우팅 결과만 출력 |
| `aa daily-log` | 오늘 일지 보기 |
| `aa daily-log yesterday` | 어제 일지 |
| `aa daily-log today --edit` | VS Code (또는 `EDITOR`) 로 일지 편집 |
| `aa push` | shared-memory 변경분 → GitHub 자동 commit + push |
| `aa serve` | Multica 인트라넷 docker compose 가동 (`--stop` / `--logs`) |
| `aa seed` | 27명 외계 동료를 Multica DB에 시드 — ID 자동 탐색 + 런타임 자동 생성 |
| `aa seed --dry-run` | DB 변경 없이 발견한 ID + 시드 계획만 출력 |
| `aa usage` | CLI·모델·에이전트별 호출 사용량 (오늘 기본, `--by cli/agent/model/modality`) |
| `aa usage week` | 최근 7일 누적 사용량 |
| `aa usage 2026-05-14` | 특정 날짜 사용량 |
| `aa voice` | 🎤 음성으로 27명에게 명령 — 마이크 입력 → Whisper(4090 로컬) → aa call 자동 실행 |
| `aa voice --no-execute` | 음성 인식만 (실행 X) |
| `aa voice -a story-weaver -s 10` | 에이전트 미리 지정 + 10초 녹음 |

## 자동 라우팅 — 모달리티 → 난이도

`aa call` 은 매 호출마다 **로컬 휴리스틱(토큰 0)** 으로 두 축을 판정한다.

### 1축 — 모달리티 (text / image)

| 모달리티 | 공급자 | API 키 | 상태 |
|---|---|---|---|
| **image** | ChatGPT(Codex `$imagegen`, gpt-image-2) | ❌ 불필요 | ✅ |
| **text** | 아래 난이도 라우터로 | — | ✅ |

이미지 생성 상세는 [docs/guides/image-generation.md](../../docs/guides/image-generation.md) 참조. 동영상은 무-API-키 CLI 경로가 없어 `aa` 범위 밖이다.

### 2축 — 난이도 (text 일 때만) · "Claude 우선, GPT 보조"

| 티어 | 작업 성격 | 라우팅 |
|---|---|---|
| **T1 경량** | 포맷 변환·목록 정리·요약·결정론적 작업 | ChatGPT Pro (Codex CLI) |
| **T2 표준** | 일반 추론·초안 작성·대부분의 에이전트 작업 | Claude Sonnet |
| **T3 심층** | 4층 진단·비전 설계·복잡 전략 추론 | Claude Opus |

판정 신호 (전부 로컬): ① 에이전트 프론트매터 `model`(opus면 심층 가중) ② 심층/경량 키워드 ③ 프롬프트 길이. 중립이면 T2(Claude)로 둔다. `--modality` / `--difficulty` / `--provider` 로 언제든 덮어쓸 수 있다.

## 사용 예시

```bash
# 명단 확인
aa list

# WHY Division만
aa list -d WHY

# 라우팅 미리보기 (AI 호출 X) — 어느 티어·공급자로 갈지 확인
aa call origin-reader "베먼 BLBP의 4층 진단" --dry-run

# 실제 호출 — 난이도 자동 라우팅
aa call origin-reader "베먼 BLBP의 4층 진단과 비전 설계" -c _self-baremonday-blbp

# 경량 작업을 강제로 Claude 로 (ChatGPT 미설치 시)
aa call case-curator "지난주 케이스 목록 정리" --provider claude

# 난이도 강제 — 심층 추론으로 끌어올리기
aa call story-weaver "BLBP 마스터 내러티브" --difficulty T3

# 이미지 생성 — 키워드 자동 감지 (Codex $imagegen, 무-API-키)
aa call content-scout "쓰레드 게시물용 외계인 로고 이미지 만들어줘"

# 이미지 생성 — 키워드가 안 걸릴 때 모달리티 강제
aa call ui-ux-designer "대시보드 히어로 일러스트" --modality image

# 오늘 진척 GitHub 푸시
aa push "WHY Session v2 진척"
```

## 호출 후 자동으로 일어나는 일

`aa call` 호출 종료 시:

1. 에이전트 응답을 콘솔에 출력
2. `shared-memory/agents/{agent-name}/work.md` 에 호출 기록 append
3. 응답의 `## MEMORY UPDATE` 섹션을 파싱해서:
   - `learnings.md` (append)
   - `decisions.md` (append)
   - `mistakes.md` (append)
4. *(없음)* 으로 표시된 섹션은 누적하지 않음

이 자동 누적이 1년 후 *외계인 운영 데이터셋*의 핵심.

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `python --version` 이 빈 결과 또는 Microsoft Store 열림 | Python stub 함정. 위 1단계 *⚠ 함정* 섹션 참조 — `winget install -e --id Python.Python.3.12` 후 PowerShell 재시작 |
| `.venv\Scripts\python.exe` 없음 (또는 `.venv` 폴더 자체가 비었음) | venv 생성 실패. 위 stub 확인 후 `Remove-Item -Recurse -Force .venv` → `python -m venv .venv` 다시 |
| `.\.venv\Scripts\Activate.ps1` 가 *모듈 로드* 에러 | PowerShell 실행 정책. `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force` 1회 |
| `.venv\Scripts\activate` (확장자 X) 가 안 됨 | PowerShell에서는 *`Activate.ps1`* 가 정답. 확장자 없는 자리는 bash 용. |
| `aa: command not found` | `pip install -e .` 가 *활성된 venv* 안에서 실행됐는지 확인. 프롬프트에 `(.venv)` 표시 필수 |
| `claude CLI 를 찾지 못했습니다` | Claude Code 설치 확인 (`~/.local/bin/claude.exe`) 또는 `.env` 에 `CLAUDE_BIN=절대경로` 박기 |
| `claude CLI 에러 (exit 1)` | `claude --version` 직접 실행해서 작동 확인 / 인증 만료 시 `claude /login` |
| `codex CLI 를 찾지 못했습니다` | Codex CLI 미설치 — [codex-cli-setup.md](../../docs/guides/codex-cli-setup.md) 참조. 급하면 `--provider claude` 로 Claude 만 사용 |
| `codex CLI 에러 (exit 1)` | `codex exec "테스트"` 직접 실행해서 작동 확인 / 인증 만료 시 `codex login` |
| 이미지 요청인데 text 로 라우팅됨 | `--modality image` 로 강제 — [image-generation.md](../../docs/guides/image-generation.md) 참조 |
| 한국어·이모지에서 `UnicodeEncodeError: cp949` | `cli.py` 가 자동으로 stdout을 UTF-8로 재구성합니다. 안 되면: `$env:PYTHONIOENCODING="utf-8"` 후 재시도, 또는 PowerShell 7+ 설치 — `winget install -e --id Microsoft.PowerShell` |
| 한국어 깨짐 (cmd.exe) | `chcp 65001` 로 UTF-8 활성 |

## 다음 버전 (v0.2 — Phase 2)

- `aa workflow <name>` — 표준 워크플로 트리거 (WHY Session 등)
- `aa messages [tail|list]` — 에이전트 간 대화 엿보기
- `aa intervene "<msg>"` — 중간 개입 메시지 작성
- `aa serve` — 로컬 인트라넷 서버 (그룹웨어 UI)
- `aa mobile` — 모바일 접속 URL + QR
- 라우팅 휴리스틱 오판률을 메타 데이터로 추적 → 키워드 사전 자동 보정
- `finance-tracker` 가 Claude Max 토큰 + ChatGPT Pro 사용량을 한 화면에 통합 보고

🛸
