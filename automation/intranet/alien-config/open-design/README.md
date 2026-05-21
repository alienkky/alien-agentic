# Alien Agentic — Open Design 커스터마이즈

> [`nexu-io/open-design`](https://github.com/nexu-io/open-design) 본진(`automation/intranet/open-design/`, gitignore) 위에 *Alien Agentic 브랜드*를 박는 자리.
>
> 설치·실행·연동: [`docs/guides/open-design-setup.md`](../../../../docs/guides/open-design-setup.md)

## 왜 이 자리인가

Open Design 본진은 fresh clone 되면 우리가 추가한 게 다 사라진다 (Multica 와 동일한 drift — `shared-memory/insights/2026-05-19-docker-compose-override-drift.md`). 그래서 **우리 커스텀은 우리 git 의 이 폴더에 두고, 복원 스크립트로 본진에 복사**한다.

## 폴더 구조

```
alien-config/open-design/
├── README.md                           # 이 파일
└── design-systems/
    └── alien-agentic/
        └── DESIGN.md                   # Alien Agentic 브랜드 디자인 시스템 (9섹션)
```

향후:
```
├── skills/                             # 우리 전용 디자인 스킬 (SKILL.md)
└── ... install-open-design.py 가 본진으로 복사
```

## 디자인 시스템 2층 — 회사 자체 vs 프로젝트별

디자인 컨셉은 *프로젝트마다 다르다*. 그래서 2층으로 둔다:

| 층 | 위치 | 용도 | open-design 피커 이름 |
|---|---|---|---|
| **회사 자체** | `alien-config/open-design/design-systems/alien-agentic/DESIGN.md` | AA 브랜드 (콘텐츠·제안서·내부) | `alien-agentic` |
| **프로젝트별** | `clients/<client>/design-system/DESIGN.md` | 각 클라이언트 브랜드 | `<client>` |

`install-open-design.py` 가 **둘 다 자동 등록**한다:
- `alien-config/open-design/design-systems/*` → 본진 `design-systems/*`
- `clients/*/design-system/DESIGN.md` → 본진 `design-systems/<client>/DESIGN.md`

→ open-design 피커에 `alien-agentic` · `<클라이언트들>` 이 나란히. 디자인 작업 시 그 프로젝트 시스템을 골라 *그 톤으로* 생성.

**프로젝트 DESIGN.md 는 누가 만드나** — WHY/HOW 단계 산출물: `culture-linguist`(컬쳐 코드) + `story-weaver`(마스터 내러티브) 에서 브랜드를 도출해 `ui-ux-designer` 가 9섹션 DESIGN.md(color·typography·spacing·layout·components·motion·voice·brand·anti-patterns)로 직조.

## 분리 원칙 (Multica 와 동일)

| 자리 | 위치 | git 추적 |
|---|---|---|
| **Open Design 본진** | `automation/intranet/open-design/` | ❌ (`.gitignore`) — 업스트림 그대로 |
| **우리 커스터마이즈** | `automation/intranet/alien-config/open-design/` | ✅ git에 포함 |
| **런타임 데이터** | open-design 의 `.od/` | ❌ (로컬만) |

## 복원 (향후 install-open-design.py)

```
design-systems/alien-agentic/DESIGN.md
   → open-design/design-systems/alien-agentic/DESIGN.md
→ 데몬 재시작 → 모델/시스템 피커에 "Alien Agentic" 등장
```

지금은 수동 복사:
```powershell
Copy-Item -Recurse -Force `
  E:\AlienAgentic\alien-agentic\automation\intranet\alien-config\open-design\design-systems\alien-agentic `
  E:\AlienAgentic\alien-agentic\automation\intranet\open-design\design-systems\
```
복사 후 데몬 재시작 → 피커에서 "Alien Agentic" 선택 → 우리 브랜드로 디자인 생성.
