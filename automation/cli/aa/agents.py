"""27명 외계 동료 정의 로더."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from aa.config import AGENTS_DIR

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


@dataclass
class Agent:
    name: str
    description: str
    model: str
    path: Path
    body: str

    @classmethod
    def from_file(cls, path: Path) -> "Agent":
        text = path.read_text(encoding="utf-8")
        m = FRONTMATTER_RE.match(text)
        if not m:
            raise ValueError(f"No frontmatter in {path.name}")
        front = m.group(1)
        meta: dict[str, str] = {}
        for line in front.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        body = text[m.end():]
        return cls(
            name=meta.get("name", path.stem),
            description=meta.get("description", ""),
            model=meta.get("model", "sonnet"),
            path=path,
            body=body,
        )


def load_all() -> list[Agent]:
    return sorted(
        [Agent.from_file(p) for p in AGENTS_DIR.glob("*.md")],
        key=lambda a: a.name,
    )


def load_one(name: str) -> Agent:
    path = AGENTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Agent not found: {name}")
    return Agent.from_file(path)


# 5 Division 매핑 — 헌법 V 그대로
DIVISIONS: dict[str, list[str]] = {
    "WHY": [
        "origin-reader",
        "pain-interpreter",
        "vision-architect",
        "culture-linguist",
        "story-weaver",
    ],
    "HOW": [
        "process-cartographer",
        "agent-architect",
        "workflow-engineer",
        "integration-specialist",
        "data-strategist",
        "kpi-translator",
        "org-designer",
    ],
    "WHAT": [
        "prompt-engineer",
        "subagent-builder",
        "mcp-connector",
        "automation-coder",
        "knowledge-architect",
        "ui-ux-designer",
        "qa-tester",
    ],
    "CTRL": [
        "sales-closer",
        "content-scout",
        "client-concierge",
        "finance-tracker",
        "brand-keeper",
    ],
    "R&D": ["trend-hunter", "case-curator", "future-forecaster"],
}


def division_of(name: str) -> str:
    for div, members in DIVISIONS.items():
        if name in members:
            return div
    return "?"
