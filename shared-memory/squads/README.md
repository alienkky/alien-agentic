# shared-memory/squads/

스쿼드는 *특정 미션을 위해 27명 카탈로그에서 추려낸 작은 협업 단위*다.
부서(Division)는 영구 구조, 스쿼드는 *미션 단위로 결성·해체되는* 유연 구조.

## 폴더 구조

```
squads/
├── README.md                     # 이 파일 — 스쿼드 운영 규약
└── {squad-slug}/
    ├── squad.toml                # 머신 판독 등록부 (aa CLI 가 읽는 진짜 데이터)
    ├── README.md                 # 사람용 헌장 (Mission · Roster · Operating Norms)
    ├── _activations/             # 가동 기록 (어떤 브랜드·클라이언트에 동원되었나)
    └── _retrospectives/          # 종료 회고 (해체될 때만)
```

**왜 두 파일?** `squad.toml` 은 `aa squad list/show` 가 파싱하는 진실원,
`README.md` 는 사람이 정독하는 문서. 둘 사이 불일치가 생기면 항상 `squad.toml` 이
진실. README 는 사람을 위한 직조.

## `squad.toml` 스키마

```toml
[meta]
slug = "brand-system"
name = "BRAND-SYSTEM SQUAD"
status = "FORMED"                # DRAFT | FORMED | ACTIVE | DORMANT | DISBANDED
formed_on = "2026-05-16"
lead = "origin-reader"           # 27명 카탈로그의 agent name
label = "스쿼드: 브랜드시스템"     # 워크스페이스 라벨 이름
hq_issue = "ALI-19"              # 본부 이슈 identifier
hq_issue_uuid = "..."            # 본부 이슈 UUID
mission = """
한 줄 미션. 멀티라인 OK.
"""

[[cells]]
name = "Phase 1 — TBD"
lead = "origin-reader"

[[cells.members]]
agent = "origin-reader"
role = "Phase Lead · ..."
```

## 등록부(README.md) 표준 섹션

각 스쿼드의 README는 다음 8개 섹션을 가진다.

1. **메타** — 슬러그, 상태, 결성일, Squad Lead, 본부 이슈
2. **Mission** — 한 줄 명제 + 4단 직조 흐름
3. **Roster** — Squad Lead + Cell 별 멤버 + Phase Lead
4. **Squad Operating Norms** — 단일 본부, 페이즈 게이트, 호출 상한, mention 규율, 상시 가드, 메모리 누적
5. **Activation Conditions** — 가동을 위한 입력(브랜드·클라이언트·시나리오)
6. **Activation Log** — 언제 어떤 자리에 동원되었는지 (`_activations/` 참조)
7. **Cell Deliverable Map** — 페이즈별 산출물 표준 경로
8. **Change Log** — 등록부 변경 이력 (멤버 교체·역할 조정 등)

## 라이프사이클

```
DRAFT      → 등록부 작성 중 (아직 가동 가능 상태 아님)
FORMED     → 결성 완료, 라벨·subscriber 적용, 가동 입력 대기
ACTIVE     → 가동 중 (Phase 진행 중)
DORMANT    → 가동은 끝났지만 해체는 안 함 (재사용 대기)
DISBANDED  → 해체. _retrospectives/{YYYY-MM-DD}-final.md 작성 후 잠금
```

## 워크스페이스 라벨과의 매핑

- 각 스쿼드는 워크스페이스 라벨 `스쿼드: {이름}` 과 1:1 대응.
- 본부 이슈에 이 라벨을 붙이면 *그 이슈가 스쿼드의 단일 본부*임을 의미.
- 스쿼드 멤버 전원은 본부 이슈의 subscriber로 등록 (run 트리거 X, 알림만).

## `aa` CLI 명령어

| 명령 | 의미 |
|---|---|
| `aa squad list [--status FORMED]` | 등록된 모든 스쿼드 명단 |
| `aa squad show <slug>` | 스쿼드 상세 — Mission · Roster · 본부 이슈 |
| `aa squad register <slug> --name "..." --lead <agent>` | 신규 스쿼드 스캐폴딩 (DRAFT 로 생성, 멤버는 squad.toml 직접 편집) |

신규 스쿼드 등록 절차 표준:

1. `aa squad register <slug> --name "..." --lead <agent>` → `squad.toml` + `README.md` 스캐폴딩 (DRAFT)
2. `squad.toml` 의 `[[cells]]` 블록에 멤버 채우기
3. `README.md` 사람용 헌장 작성
4. `squad.toml` 의 `status` 를 `FORMED` 로 변경
5. Multica 워크스페이스에 라벨 생성 + 본부 이슈 지정 + 멤버 subscriber 등록
6. `aa squad show <slug>` 로 검증
