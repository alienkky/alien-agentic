# Codex CLI 셋업 가이드 — ChatGPT Pro 구독으로 `aa` 에 두 번째 두뇌 붙이기

> 목적: `aa call` 이 난이도에 따라 **Claude(Max 구독)** 와 **ChatGPT(Pro 구독)** 를 골라 쓰게 한다.
> 핵심 원칙은 그대로 — **별도 API 키 발급 없음.** Claude Code 가 Max 구독 토큰을 쓰듯, OpenAI **Codex CLI** 는 ChatGPT 구독에 포함된 사용량을 쓴다.

Codex CLI 는 OpenAI 가 만든 *터미널 코딩 에이전트* 다. `claude` 바이너리와 똑같이 컴퓨터에 설치되고, **"Sign in with ChatGPT"** 로그인을 지원한다. `aa call` 은 이 `codex` 바이너리를 subprocess 로 호출한다 — Claude 를 부르는 방식과 완전히 대칭.

---

## 0. 왜 ChatGPT 를 같이 쓰나 — 토큰 낭비 줄이기

`aa call` 은 매 호출마다 **로컬 휴리스틱(토큰 0)** 으로 난이도를 3티어로 판정한다:

| 티어 | 작업 성격 | 라우팅 |
|---|---|---|
| **T1 경량** | 포맷 변환·목록 정리·요약·결정론적 작업 | **ChatGPT Pro** (Codex CLI) |
| **T2 표준** | 일반 추론·초안 작성·대부분의 에이전트 작업 | Claude Sonnet |
| **T3 심층** | 4층 진단·비전 설계·복잡 전략 추론 | Claude Opus |

정책은 **"Claude 우선, GPT 보조"** — 품질이 중요한 표준·심층 작업은 Claude 가 맡고, 가벼운 일만 ChatGPT 구독으로 덜어낸다. 그래서 Max 구독의 비싼 토큰을 심층 작업에 아껴 쓸 수 있다.

판정이 틀렸다 싶으면 언제든 수동으로 덮어쓴다:

```bash
aa call story-weaver "BLBP 마스터 내러티브" --difficulty T3   # 티어 강제
aa call case-curator "이번 주 인사이트 정리" --provider claude  # 공급자 강제
```

---

## 1. Codex CLI 설치 (약 3분)

### npm 으로 설치 (권장 — Claude Code 와 동일 방식)

```powershell
npm install -g @openai/codex
```

> Node.js 가 없다면 먼저: `winget install -e --id OpenJS.NodeJS.LTS` → PowerShell 재시작.

### 대안 — Homebrew (macOS)

```bash
brew install codex
```

### 확인

```powershell
codex --version
```

버전 문자열이 나오면 정상.

---

## 2. ChatGPT 로 로그인 — API 키 없이 (약 2분)

```powershell
codex login
```

브라우저 창이 열린다 → **ChatGPT 계정으로 로그인** → 권한 승인 → 터미널로 자동 복귀.

이게 끝이다. ChatGPT Plus·Pro·Business·Edu·Enterprise 플랜에는 Codex 사용량이 **포함**돼 있다. 기영님은 Pro 구독이므로 추가 결제 없이 바로 쓸 수 있다.

### 확인

```powershell
codex exec "1 더하기 1은?"
```

`2` 비슷한 답이 나오면 연동 성공.

> ⚠ **Windows 사용자 주의 — 자동 생성되는 API 키**
> Codex CLI 는 "Sign in with ChatGPT" 시 내부적으로 `Codex CLI (auto-generated)` 이름의 API 키를 자동 생성한다. Pro 사용자는 $50 API 크레딧을 받지만 **30일 후 만료**되고, 일부 경우 ChatGPT 구독 사용량이 아닌 **API 과금**으로 빠질 수 있다는 보고가 있다 (openai/codex GitHub Issue #2000).
> - 평소 사용량이 ChatGPT 구독으로 잡히는지 OpenAI 대시보드(Usage)에서 가끔 확인할 것.
> - `finance-tracker` 가 주간 보고에서 이 항목을 함께 추적하도록 설계돼 있다.
> - 크레딧 만료 후 의도치 않은 과금이 싫으면 OpenAI 대시보드에서 해당 자동 생성 키를 비활성화할 수 있다 (단, CLI 재로그인 필요).

---

## 3. `aa` 가 `codex` 를 찾는 순서

`aa` CLI 는 다음 순서로 `codex` 바이너리를 자동 감지한다:

1. `.env` 의 `CODEX_BIN` 환경 변수
2. 시스템 `PATH`
3. `~/.local/bin/codex.exe` · `~/.local/bin/codex`
4. `~/AppData/Roaming/npm/codex.cmd` (Windows npm 전역 설치 기본)
5. `C:/Program Files/nodejs/codex.cmd`

다른 위치라면 `automation/cli/.env` 에:

```
CODEX_BIN=C:/Users/AlienK/AppData/Roaming/npm/codex.cmd
```

### (선택) 모델 고정

기본값은 *Codex CLI 계정 기본 모델* 을 그대로 쓴다. 특정 모델로 고정하려면 `.env` 에:

```
CODEX_MODEL=gpt-5.1-codex
```

비워두면 Codex 가 알아서 계정 기본 모델을 고른다 — 모델명이 바뀌어도 깨지지 않으므로 **비워두는 것을 권장**.

---

## 4. 동작 확인 — `aa` 통합 테스트

```bash
# 라우팅만 미리보기 (API 호출 X) — 어느 티어·공급자로 갈지 표시
aa call case-curator "지난주 케이스 목록 정리" --dry-run

# 경량 작업 → ChatGPT 로 라우팅되는지 확인
aa call case-curator "지난주 케이스 목록 정리"

# 심층 작업 → Claude Opus 로 라우팅되는지 확인
aa call origin-reader "베먼 BLBP의 4층 진단과 비전 설계" --dry-run
```

`--dry-run` 출력의 **Route** 줄에 `티어 · 공급자 · 모델 · 판정 근거` 가 보이면 통합 성공.

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `codex` 명령어 없음 | PowerShell 닫고 새로 열기 (PATH 갱신). 그래도 안 되면 `npm install -g @openai/codex` 재실행 |
| `npm` 명령어 없음 | Node.js 미설치 — `winget install -e --id OpenJS.NodeJS.LTS` 후 PowerShell 재시작 |
| `aa` 가 `codex CLI 를 찾지 못했습니다` | `.env` 에 `CODEX_BIN=절대경로` 박기. 경로는 `where.exe codex` (PowerShell) 로 확인 |
| `codex login` 후에도 인증 실패 | `codex logout` → `codex login` 재시도. 브라우저가 자동으로 안 열리면 터미널에 출력된 URL 직접 복사 |
| ChatGPT 구독 대신 API 로 과금됨 | 위 2번 ⚠ 박스 참조 — OpenAI 대시보드에서 사용량 출처 확인 |
| ChatGPT 응답이 비어 있음 | `codex exec "테스트"` 직접 실행해서 작동 확인. 구독 사용량 한도 도달 가능성 |

---

## 다음 자리 (Phase 2)

- `aa call ... --difficulty` 통계 누적 — 휴리스틱 오판률을 메타 데이터로 추적, 키워드 사전 자동 보정
- `finance-tracker` 가 Claude Max 토큰 + ChatGPT 구독 사용량을 **한 화면**에 통합 보고
- T1 경량 작업도 Claude Haiku 와 ChatGPT 중 *비용·속도* 로 한 번 더 분기
