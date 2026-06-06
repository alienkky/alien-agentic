# 🛸 Write-time Compile — PR 파이프라인 표준 흐름

> ALI-103. 에이전트는 main 에 직접 push 하지 않는다.
> 모든 변경은 `agent/<name>/<slug>` 브랜치 → PR → **사람만 머지**.

---

## 한 줄 요약

> *"RAG 청크 파편화 대신, 작성 시점에 컴파일한다."*
> 에이전트가 만든 변경은 PR 단계에서 *기존 지식과 충돌 검증*을 통과해야 한다.
> 통과 못 한 PR 은 사람이 보고 결정한다.

---

## 흐름도

```
[ 에이전트 호출 ]
        │
        ▼
git checkout -b agent/<name>/<slug>
        │  (네이밍 규칙 강제 — scripts/aa-pr.py verify-branch)
        ▼
[ 파일 변경 ] — index.md / log.md / agents/ / clients/ ...
        │
        ▼
scripts/aa-pr.py submit --title "..."
        │  ├ 충돌 보고서 빌드
        │  │   1) duplicate-title — 같은 H1 이 다른 index/log 에 존재?
        │  │   2) missing-link    — 마크다운 링크 대상이 사라졌나?
        │  │   3) decision-contradiction — 기존 결정과 방향이 다른가?
        │  │   4) OpenViking 계층 추정 (L0 / L1 / L2)
        │  ├ git push -u origin <branch>
        │  └ gh pr create --body-file .aa-pr-body.md --label aa-pr,...
        ▼
[ GitHub PR ]
        │
        ▼
.github/workflows/pr-knowledge-check.yml
        │  ├ 같은 검증을 *최신 main 기준*으로 재실행
        │  ├ sticky comment 로 보고서 upsert (header: aa-pr)
        │  ├ 라벨 부착: clean | review-needed | knowledge-conflict | branch-naming-violation
        │  └ error 가 있으면 job fail (머지 차단)
        ▼
[ 사람 리뷰 ] — 기영님 또는 지정 리뷰어
        │
        ▼
머지 (사람만). CI auto-merge 금지.
```

---

## 도구

| 도구 | 위치 | 역할 |
|---|---|---|
| `scripts/aa-pr.py` | 이 저장소 | 충돌 보고서 빌드 + gh pr create (std lib only, CI 의존성 0) |
| `.github/workflows/pr-knowledge-check.yml` | 이 저장소 | PR 열릴 때 재검증 + 라벨링 + sticky 코멘트 |
| `shared-memory/context/openviking-mapping.md` | ALI-101 산출물 | 계층 추정 룰 (도착 시 자동 흡수) |

---

## 명령 카탈로그

```bash
# 1) 작업 시작 — 브랜치 만들기
git switch -c agent/automation-coder/pr-pipeline

# 2) 파일 작업 후, 자기 변경의 충돌 보고서 미리보기
python scripts/aa-pr.py check --base main

# 3) 보고서를 파일로
python scripts/aa-pr.py report --base main -o .aa-pr-body.md

# 4) PR 생성 (push + gh pr create)
python scripts/aa-pr.py submit \
  --base main \
  --title "🛸 ALI-103 Write-time Compile PR 파이프라인"
```

---

## 충돌 카테고리

| 카테고리 | 심각도 | 무엇 |
|---|---|---|
| `duplicate-title` | warn | 변경한 파일의 H1 제목이 이미 다른 `index.md` / `log.md` 에 존재 |
| `missing-link` | **error** | 마크다운 링크 `[text](path)` 대상이 사라짐 (옮긴 파일 추적 누락) |
| `decision-contradiction` | warn | `decisions.md` 의 같은 키워드 결정이 부정·긍정으로 갈림 (휴리스틱 — false-positive 허용) |

error 가 1개라도 있으면 PR 라벨은 `knowledge-conflict`, CI job 은 fail. 사람이 본다.

---

## OpenViking 계층 추정

현 폴더 구조 기준 기본 룰(`scripts/aa-pr.py:DEFAULT_LAYER_RULES`):

| 패턴 | 계층 |
|---|---|
| `^shared-memory/_private/` | L0 (Evidence) |
| `^shared-memory/messages/`, `^shared-memory/interventions/` | L0 |
| `^shared-memory/daily-logs/`, `^shared-memory/insights/`, `^shared-memory/clients/`, `^shared-memory/context/`, `^shared-memory/dashboard\.md$` | L1 (Resource) |
| `^shared-memory/agents/`, `^.claude/agents/` | L2 (Skill / Memory) |

**ALI-101 산출물이 도착하면** `shared-memory/context/openviking-mapping.md` 의 다음 형식이 자동 흡수된다:

```
`<regex>` -> Lx
```

스크립트는 `_load_openviking_mapping()` 에서 그 파일이 보이면 그 룰로 기본 룰을 *대체*한다. (병합 아님 — 단일 진실 원천.)

---

## 라벨 규약

| 라벨 | 의미 | 머지 가능? |
|---|---|---|
| `clean` | 충돌 없음 | 사람 리뷰 1명 OK 후 가능 |
| `review-needed` | warn 만 있음 | 사람이 warn 항목 판단 후 결정 |
| `knowledge-conflict` | error 있음 | **차단** — 먼저 해소 |
| `branch-naming-violation` | 브랜치명 위반 | 차단 — 브랜치명 고치고 다시 |
| `aa-pr` | 본 파이프라인이 만든 PR | 표식 |

---

## 절대 원칙

1. **에이전트는 main 에 직접 push 하지 않는다.** 항상 PR.
2. **머지는 사람만.** CI 의 auto-merge·자동 approve 금지.
3. **error 가 있으면 머지 차단.** warn 은 사람 판단.
4. **브랜치명은 `agent/<name>/<slug>` 강제.** 회고·검색·권한 분리의 기반.
5. **CI 보고서가 로컬보다 우선.** main 이 움직였을 수 있으므로.

---

## 핸드오프 — 다른 이슈와 연결

- **ALI-101 (OpenViking 매핑)**: `openviking-mapping.md` 가 도착하면 자동 흡수.
- **ALI-100 (4-Layer 폴더)**: S1 의 `_private/`, `context/`, `members/` 디렉토리는 룰 표에 미리 포함.
- **S5 (`agent.md`)**: 모든 27명 에이전트의 *작업 종료 훅*이 본 파이프라인을 호출하도록 박는다. 예:
  ```bash
  python scripts/aa-pr.py submit --title "..."
  ```
- **S6 (index/log 자동화)**: `scripts/aa-index.py` + `scripts/aa-log.py` 가 PR 직전 `_precompile_indexes()` 로 자동 호출된다. 사양·옵션: [`index-log-readme.md`](index-log-readme.md).

---

## 운영 메모

- 스크립트는 *std lib only*. CI 에 추가 pip install 필요 없음.
- Windows 콘솔(cp949) 호환 — `sys.stdout.reconfigure(utf-8)` 적용.
- `.aa-pr-body.md` 는 workdir 루트에 임시 생성 — `.gitignore` 에 박혀도 OK (커밋 대상 아님).

---

*문서 책임: automation-coder.*
*최초 작성: 2026-06-06.*
*개정: 매핑/구조 변경 시 본 문서를 PR 본문에서 직접 참조.*
