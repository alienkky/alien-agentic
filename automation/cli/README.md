# `aa` — Alien Agentic Master Orchestrator CLI

> 27명의 외계 동료를 한 명령어로 호출·확인·기록한다.

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
cd "C:/Alien Agentic/automation/cli"
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

### 3. API 키 설정

`.env.example` 를 복사해서 `.env` 만들고 실제 키 박기:

```bash
cp .env.example .env
# .env 를 열어서 ANTHROPIC_API_KEY 채우기
```

API 키 발급: https://console.anthropic.com → Settings → API Keys

### 4. 동작 확인

```bash
aa hello
```

부팅 패널이 뜨면 성공.

---

## 명령어 (v0.1.0 — 6개)

| 명령 | 무엇을 |
|---|---|
| `aa hello` | 마스터 오케스트레이터 부팅 확인 + 헌법 통과 질문 표시 |
| `aa list` | 27명 외계 동료 명단 (Division · Name · Model · Description) |
| `aa list -d WHY` | Division 필터 (WHY / HOW / WHAT / CTRL / R&D) |
| `aa status` | 오늘 일지 + dashboard + 미해결 개입/메시지 카운트 |
| `aa call <agent> "<prompt>"` | 단일 에이전트 호출 (Anthropic API) + 메모리 4파일 자동 갱신 |
| `aa call <agent> "<prompt>" --dry-run` | API 호출 없이 컨텍스트만 출력 |
| `aa daily-log` | 오늘 일지 보기 |
| `aa daily-log yesterday` | 어제 일지 |
| `aa daily-log today --edit` | VS Code (또는 `EDITOR`) 로 일지 편집 |
| `aa push` | shared-memory 변경분 → GitHub 자동 commit + push |

## 사용 예시

```bash
# 명단 확인
aa list

# WHY Division만
aa list -d WHY

# 베먼 BLBP 가상 클라이언트로 원인 진단 시뮬레이션 (dry-run, API 호출 X)
aa call origin-reader "베먼 BLBP의 4층 진단" --dry-run

# 실제 API 호출 (.env 의 키 사용)
aa call origin-reader "베먼 BLBP의 4층 진단" -c _self-baremonday-blbp

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
| `ANTHROPIC_API_KEY 가 .env 에 없습니다` | `.env` 만들고 키 박기 (`.env.example` 복사) |
| `anthropic 패키지 미설치` | `pip install -r requirements.txt` |
| 한국어 깨짐 (Windows) | `chcp 65001` 로 UTF-8 활성 |

## 다음 버전 (v0.2 — Phase 2)

- `aa workflow <name>` — 표준 워크플로 트리거 (WHY Session 등)
- `aa messages [tail|list]` — 에이전트 간 대화 엿보기
- `aa intervene "<msg>"` — 중간 개입 메시지 작성
- `aa serve` — 로컬 인트라넷 서버 (그룹웨어 UI)
- `aa mobile` — 모바일 접속 URL + QR

🛸
