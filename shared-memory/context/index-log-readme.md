---
openviking_layer: L1
scope: company
owner: automation-coder
related:
  - openviking-mapping.md
  - index-log-spec.md
  - pr-pipeline.md
updated_at: 2026-06-06
---

# `aa-index` / `aa-log` — OpenViking 자동 갱신 (ALI-105 / S6)

> *"폴더의 진실은 폴더 안 `index.md` 한 장과 `log.md` 한 줄에 있다."*
> 영상에서 본 **에이전트의 첫 위임 영역 — `index.md` / `log.md` 자율 갱신** 을
> Alien Agentic 의 4-Layer 폴더(`context/`, `members/`, `agents/`, `_private/`)
> 전체에 일반화한 자동화.

연계 문서:
- 분류 사양: [`openviking-mapping.md`](openviking-mapping.md) (ALI-101)
- 파일 사양: [`index-log-spec.md`](index-log-spec.md) (ALI-101)
- PR 파이프라인: [`pr-pipeline.md`](pr-pipeline.md) (ALI-103)

---

## 한 줄 요약

| 파일 | 무엇 | 누가 | 어떻게 |
|---|---|---|---|
| `index.md` | 폴더 입구 — 어떤 파일이 어떤 계층·타입·요약인지 | `scripts/aa-index.py` | 전체 재생성 (idempotent) |
| `log.md` | 폴더의 변경 이벤트 스트림 (append-only) | `scripts/aa-log.py` | `git log` → 신규 행만 append |

두 스크립트 모두 **표준 라이브러리만 사용** — CI 의존성 0.

---

## `scripts/aa-index.py`

폴더 인자를 받아 `index.md` 를 *재생성*한다. 같은 입력이면 같은 출력 → 멱등.

### 산출물 구조

`shared-memory/context/index-log-spec.md` 의 사양을 따른다:

1. YAML 프론트매터 — `index_version`, `generated_at`, `root`, `default_layer`, `owner`, `source`.
2. `# Index: <folder>` 헤더.
3. `## Scope` — Layer / Owner / Contains / Do not include.
4. `## Entry Points` 표 — `Path · Layer · Type · Updated · Summary`.
5. `## Link Graph` — front matter / 본문 링크에서 추출한 관계.
6. `## Open Questions` — 빈 표 (인간이 채움).
7. `## Automation Notes` — 분류기 마지막 실행 시각, unknown 수, front matter ↔ path 충돌 수.

### Layer 추정

`DEFAULT_LAYER_RULES` 가 ALI-101 매핑을 그대로 옮긴 정규식 리스트. 분류는 **순서대로 첫 매칭**.
ALI-101 매핑이 갱신되면 이 리스트만 교체하면 된다 (코드 로직 변경 없음).

| 룰 종류 | 예시 |
|---|---|
| L0 — 명시 evidence/private | `_private/`, `context/clients/*/raw/`, `daily-logs/raw/` |
| L2 — 실행 스킬/메모리 | `context/agents/{name}/work.md`, `members/{m}/agents/`, `.claude/agents/` |
| L1 — curated shared/member | `context/clients/{name}/`, `context/dashboard.md`, `members/{m}/notes/` |
| Legacy | `shared-memory/agents/{name}/` (L2), `shared-memory/clients/` (L1) |
| 최후 폴백 | `shared-memory/` 안의 미분류 → L1 |

매칭 어디에도 안 맞으면 `unclassified` 로 표기하고 `Automation Notes` 의 `Unknown files` 카운트가 올라간다.

### Type 휴리스틱

front matter 의 `type` 우선. 없으면 파일명/경로 기반 추정:
`raw` · `dashboard` · `readme` · `decision` · `memory` · `diagnosis` · `workflow` · `prompt` · `task` · `log` · `note`.

### 사용

```bash
# 단일 폴더 (즉시 자식만)
python scripts/aa-index.py shared-memory/context

# 폴더 + 하위 .md 전체
python scripts/aa-index.py shared-memory/context --recursive

# 기본 인덱스 후보 폴더 일괄
python scripts/aa-index.py --all

# 미리보기 (파일 미수정)
python scripts/aa-index.py --dry-run shared-memory/context

# owner / default_layer 강제
python scripts/aa-index.py shared-memory/clients/foo \
       --owner client-concierge --default-layer L1
```

### 안전망

- `_private/` 폴더는 자동으로 redaction 모드 — L0 entry 의 Summary 를 `[redacted L0 entry]` 로 대체.
- 같은 출력이면 파일을 다시 쓰지 않음 (git status 노이즈 방지).
- `index.md` / `log.md` 본인은 스캔 대상에서 제외 (cycle 방지).

---

## `scripts/aa-log.py`

`log.md` 는 *append-only*. 폴더 안의 git 이벤트를 한 줄씩 추가한다. 동일 (time, event, path, detail) 은 한 번만 기록 → 멱등 append.

### 한 줄 포맷

```
| <ISO-time> | <event> | <actor> | <path> | <layer> | <detail> |
```

허용 event (스펙 controlled vocabulary):
`append · update · move · delete_proposed · classify · classify:unknown · classify:conflict · redact · index_regenerated`.

### 모드 두 가지

**(1) git log 기반 자동 추출** — 인자 폴더의 git 이력을 훑어 신규 이벤트만 append.

```bash
python scripts/aa-log.py shared-memory/context --limit 30
python scripts/aa-log.py --all --limit 50 --since 2026-06-01
```

git status 매핑: `A → append`, `M → update`, `D → delete_proposed`, `R → move`.

**(2) 명시 이벤트 한 줄** — S6/CI 가 `index_regenerated` 같은 단일 이벤트를 기록할 때.

```bash
python scripts/aa-log.py shared-memory/context \
       --append-event index_regenerated \
       --actor automation-coder \
       --detail "21 entries, 0 unknown"
```

### 안전망

- 헤더(`# Log: <name>` + 표 행) 가 없으면 자동 생성.
- 중복 키(`time + event + path + detail`) 는 add-once.
- detail 의 줄바꿈은 공백으로 정규화, 180 자 초과는 `…` 절단.

---

## PR 파이프라인 연동 (ALI-103)

`scripts/aa-pr.py submit` 은 변경 산정 *직전* 에 `aa-index --all` + `aa-log --all` 을 호출한다.
즉 어떤 에이전트가 PR 을 만들면 `index.md` / `log.md` 가 자동으로 따라간다.

```text
[ agent: file edits ]
        │
        ▼
scripts/aa-pr.py submit
   ├─ scripts/aa-index.py --all     ← ALI-105
   ├─ scripts/aa-log.py   --all     ← ALI-105
   ├─ build conflict report         ← ALI-103
   ├─ git push -u origin <branch>
   └─ gh pr create
```

CI 의 `.github/workflows/pr-knowledge-check.yml` 도 같은 순서로 실행 →
PR 의 최종 본문에는 항상 *최신 매핑 기준* 의 인덱스가 반영된 충돌 보고서가 박힌다.

`--skip-precompile` 로 디버그 시 사전 호출을 건너뛸 수 있다.

---

## `tasks/_*.md` 마이그레이션

이전 수기 인덱스는 폐기:

| 이전 | 이후 |
|---|---|
| `shared-memory/tasks/_backlog.md` | `shared-memory/tasks/index.md` (Entry Points 표) |
| `shared-memory/tasks/_in-progress.md` | `index.md` 표 + `T-*.md` front matter 의 `status` |
| `shared-memory/tasks/_done.md` | `index.md` + `log.md` (append/move 이벤트) |
| `shared-memory/tasks/_blocked.md` | `index.md` + `T-*.md` front matter 의 `status: blocked` |

새 진실의 원본 = **각 `T-*.md` 의 front matter `status` + `index.md` 자동 표**.
`tasks/README.md` 도 같은 방향으로 갱신됨.

---

## SessionStart 훅 (옵션)

`.claude/settings.json` 의 `hooks.SessionStart` 에 한 줄 옵션:

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "command": "python scripts/aa-index.py --all" }
    ]
  }
}
```

부담되면 생략 가능. PR 시점에 어차피 한 번 더 컴파일된다.

---

## 한계 / TODO

- Open Questions 표는 자동 채우지 않는다 (사람이 적는 자리).
- decision-contradiction / link-graph 의미 추정은 aa-pr.py 가 검수 — aa-index 는 단순 그래프만 출력.
- 동시성 lock 없음 — 한 폴더에 두 프로세스가 동시에 쓰면 마지막 승. (PR 시점엔 단일 프로세스라 안전.)
- 다국어 tag 추출(`#한글태그`)은 보수적 — 잘못된 매칭은 front matter 의 `tags:` 를 우선.
