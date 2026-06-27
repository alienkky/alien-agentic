"""스쿼드 — 27명 카탈로그에서 미션 단위로 추려낸 협업 단위.

부서(Division)는 영구 구조, 스쿼드는 *미션 단위로 결성·해체되는* 유연 구조.
각 스쿼드는 `shared-memory/squads/{slug}/` 폴더로 표현되며, 머신 판독 데이터는
`squad.toml`, 사람용 헌장은 `README.md` 에 분리해 둔다.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from aa.config import SQUADS_DIR

VALID_STATUSES = ("DRAFT", "FORMED", "ACTIVE", "DORMANT", "DISBANDED")


@dataclass
class SquadMember:
    agent: str
    role: str = ""


@dataclass
class SquadCell:
    name: str
    lead: str = ""
    members: list[SquadMember] = field(default_factory=list)


@dataclass
class Squad:
    slug: str
    name: str
    status: str
    lead: str
    mission: str
    path: Path
    formed_on: str = ""
    label: str = ""
    hq_issue: str = ""
    hq_issue_uuid: str = ""
    cells: list[SquadCell] = field(default_factory=list)

    @property
    def member_count(self) -> int:
        seen: set[str] = set()
        for cell in self.cells:
            for m in cell.members:
                seen.add(m.agent)
        if self.lead:
            seen.add(self.lead)
        return len(seen)

    @property
    def all_member_agents(self) -> list[str]:
        seen: list[str] = []
        if self.lead and self.lead not in seen:
            seen.append(self.lead)
        for cell in self.cells:
            for m in cell.members:
                if m.agent not in seen:
                    seen.append(m.agent)
        return seen

    @classmethod
    def from_file(cls, path: Path) -> "Squad":
        with path.open("rb") as f:
            data = tomllib.load(f)
        meta = data.get("meta", {})
        slug = meta.get("slug") or path.parent.name
        cells_raw = data.get("cells", [])
        cells = [
            SquadCell(
                name=c.get("name", ""),
                lead=c.get("lead", ""),
                members=[
                    SquadMember(
                        agent=m.get("agent", ""),
                        role=m.get("role", ""),
                    )
                    for m in c.get("members", [])
                ],
            )
            for c in cells_raw
        ]
        status = meta.get("status", "DRAFT").upper()
        if status not in VALID_STATUSES:
            status = "DRAFT"
        return cls(
            slug=slug,
            name=meta.get("name", slug),
            status=status,
            lead=meta.get("lead", ""),
            mission=(meta.get("mission") or "").strip(),
            path=path,
            formed_on=meta.get("formed_on", ""),
            label=meta.get("label", ""),
            hq_issue=meta.get("hq_issue", ""),
            hq_issue_uuid=meta.get("hq_issue_uuid", ""),
            cells=cells,
        )


def load_all_squads() -> list[Squad]:
    """`shared-memory/squads/*/squad.toml` 전부 로드."""
    if not SQUADS_DIR.exists():
        return []
    squads: list[Squad] = []
    for sub in sorted(SQUADS_DIR.iterdir()):
        if not sub.is_dir():
            continue
        toml_path = sub / "squad.toml"
        if not toml_path.exists():
            continue
        squads.append(Squad.from_file(toml_path))
    return squads


def load_squad(slug: str) -> Squad:
    path = SQUADS_DIR / slug / "squad.toml"
    if not path.exists():
        raise FileNotFoundError(f"Squad not found: {slug} (expected {path})")
    return Squad.from_file(path)


SCAFFOLD_TOML = """\
# {name} — 스쿼드 등록부 (머신 판독)
# 사람용 헌장은 같은 폴더의 README.md.

[meta]
slug = "{slug}"
name = "{name}"
status = "DRAFT"  # DRAFT | FORMED | ACTIVE | DORMANT | DISBANDED
formed_on = "{formed_on}"
lead = "{lead}"             # 27명 카탈로그의 agent name (예: origin-reader)
label = ""                  # 워크스페이스 라벨 이름 (예: 스쿼드: 브랜드시스템)
hq_issue = ""               # 본부 이슈 identifier (예: ALI-19)
hq_issue_uuid = ""          # 본부 이슈 UUID
mission = \"\"\"
한 줄 미션을 여기에.
\"\"\"

# Cell 은 페이즈/기능 단위 작은 그룹. 필요 만큼 [[cells]] 블록 반복.
[[cells]]
name = "Phase 1 — TBD"
lead = "{lead}"

[[cells.members]]
agent = "{lead}"
role = "Phase Lead"
"""


SCAFFOLD_README = """\
# 🛸 {name}

## 1. 메타

| 필드 | 값 |
|---|---|
| 슬러그 | `{slug}` |
| 상태 | **DRAFT** |
| 결성일 | {formed_on} |
| Squad Lead | {lead} |

## 2. Mission

> *(한 줄 미션을 여기에)*

## 3. Roster

`squad.toml` 의 `[[cells]]` 블록에 멤버를 채워주세요.

## 4. Change Log

| 일자 | 변경 | 작성자 |
|---|---|---|
| {formed_on} | 스쿼드 등록 (DRAFT) | aa squad register |
"""


def scaffold_squad(slug: str, name: str, lead: str, formed_on: str) -> Path:
    """`shared-memory/squads/{slug}/` 에 squad.toml + README.md 를 생성.

    이미 폴더가 있으면 FileExistsError. 호출자가 미리 검증할 것.
    """
    folder = SQUADS_DIR / slug
    if folder.exists():
        raise FileExistsError(f"Squad folder already exists: {folder}")
    folder.mkdir(parents=True)
    toml_path = folder / "squad.toml"
    readme_path = folder / "README.md"
    fmt = dict(slug=slug, name=name, lead=lead, formed_on=formed_on)
    toml_path.write_text(SCAFFOLD_TOML.format(**fmt), encoding="utf-8")
    readme_path.write_text(SCAFFOLD_README.format(**fmt), encoding="utf-8")
    return folder
