# `aa call` 사용량 로그

> `aa call` 호출이 일어날 때마다 한 줄씩 JSONL 로 누적되는 *원천 데이터*. 인간이 직접 읽기보다, `aa usage` 명령이 집계해서 보여주는 표를 본다.

## 파일 형식

- 파일명: `YYYY-MM-DD.jsonl` — 하루 한 파일, 날짜 파티션
- 각 줄: 한 호출의 메타데이터를 담은 JSON

### 한 줄 예시

```json
{
  "ts": "2026-05-15T11:32:51",
  "agent": "content-scout",
  "division": "CTRL",
  "client": "_self",
  "cli": "chatgpt",
  "model": "default",
  "modality": "image",
  "tier": "-",
  "prompt_chars": 40,
  "response_chars": 380,
  "exit_code": 0,
  "duration_ms": 8540
}
```

### 필드 의미

| 필드 | 무엇 |
|---|---|
| `ts` | ISO 8601 타임스탬프 (초 단위) |
| `agent` | 호출된 외계 동료 이름 (예: `origin-reader`) |
| `division` | WHY / HOW / WHAT / CTRL / R&D |
| `client` | 클라이언트 이름 (없으면 `_self`) |
| `cli` | 어느 CLI 가 실행했나 — `claude` / `chatgpt` / (미래의 `gemma` 등) |
| `model` | 구체 모델 이름 (예: `opus`, `sonnet`, `default` 는 CLI 의 계정 기본) |
| `modality` | `text` / `image` (`video` 는 현재 보류) |
| `tier` | T1 경량 / T2 표준 / T3 심층 (이미지는 `-`) |
| `prompt_chars` | 입력 길이 (문자) |
| `response_chars` | 응답 길이 (문자) |
| `exit_code` | CLI 종료 코드 (0 = 성공) |
| `duration_ms` | 호출 소요 시간 (밀리초) |

## 보는 법 — `aa usage`

```bash
aa usage                       # 오늘, 클로드/코덱스 분리 (기본)
aa usage yesterday             # 어제
aa usage week                  # 최근 7일
aa usage 2026-05-14            # 특정 날짜
aa usage --by provider         # 클로드 vs 코덱스 분리 (기본값, 모델·모달리티 상세 포함)
aa usage --by cli              # CLI + 모달리티별 (claude text, chatgpt image 등)
aa usage --by agent            # 에이전트별 집계
aa usage --by model            # CLI · 모델별 집계
aa usage --by modality         # 모달리티(text/image) 별 집계
```

### 클로드 / 코덱스 분리 보기

`--by provider` (기본값)는 **Claude Max**와 **Codex (ChatGPT Pro)** 사용량을 명확히 분리하여 표시한다:
- 각 제공자별 총 호출 수, 비율(%), 사용 모델 상세, 모달리티 분포를 한눈에 볼 수 있다.
- 어떤 구독 사용량이 얼마나 소비되고 있는지 한 표에서 확인 가능.

## 새 CLI 추가 시 (예: Gemma 4)

이 로그는 **`cli` 필드에 들어간 문자열을 그대로 집계**하므로, `aa` 가 새 CLI 를 라우팅하기 시작하면 — `cli: "gemma"` 같은 줄이 자동으로 쌓이고 `aa usage` 표에 새 행이 자동으로 잡힌다. 집계 코드는 하드코딩된 CLI 이름이 없다.

## 프라이버시

각 호출의 **프롬프트 본문은 저장하지 않는다** (문자 수만). 클라이언트 작업 내용 누수 방지 — 본문은 `shared-memory/agents/<name>/work.md` 에만 (그쪽은 인간 검토용 narrative log).
