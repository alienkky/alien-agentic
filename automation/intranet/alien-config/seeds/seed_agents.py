"""27명 외계 동료를 Multica 인스턴스에 시드한다.

기영님 헌법 V의 27명 명단을 .claude/agents/*.md 에서 읽어, Multica의
agent 테이블에 INSERT 한다. 같은 workspace 안에 같은 name 이 이미 있으면 SKIP.

사용법:
    cd C:/Alien Agentic/automation/intranet/alien-config/seeds
    pip install -r requirements.txt
    copy .env.example .env
    # .env 에 WORKSPACE_ID 와 OWNER_ID 박기 (README 참조)
    python seed_agents.py

환경 변수:
    DATABASE_URL   — Multica PostgreSQL 연결 문자열 (기본: postgres://multica:multica@localhost:5432/multica)
    WORKSPACE_ID   — 시드할 워크스페이스 UUID (필수)
    OWNER_ID       — 27명의 owner_id 로 박을 사용자 UUID (필수)
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import psycopg2
    from psycopg2 import sql as psql
except ImportError:
    print(
        "ERROR: psycopg2 미설치. 다음 명령으로 설치:\n"
        "    pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # .env 없어도 환경 변수 직접 박았으면 OK


# ──────────────────────────────────────────────────────────────────────────
# 경로
# ──────────────────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
# alien-config/seeds/ → alien-config/ → intranet/ → automation/ → 루트
ROOT = HERE.parent.parent.parent.parent
AGENTS_DIR = ROOT / ".claude" / "agents"
CONSTITUTION_PATH = ROOT / "CONSTITUTION.md"


# ──────────────────────────────────────────────────────────────────────────
# 5 Division 매핑 (헌법 V)
# ──────────────────────────────────────────────────────────────────────────
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


# ──────────────────────────────────────────────────────────────────────────
# 에이전트 정의 파서
# ──────────────────────────────────────────────────────────────────────────
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


@dataclass
class AgentDef:
    name: str
    description: str
    model: str
    instructions: str  # 본문 (system prompt)


def parse_agent(path: Path) -> AgentDef:
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
    return AgentDef(
        name=meta.get("name", path.stem),
        description=meta.get("description", ""),
        model=meta.get("model", "sonnet"),
        instructions=text[m.end() :].strip(),
    )


# ──────────────────────────────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────────────────────────────
def main() -> int:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgres://multica:multica@localhost:5432/multica?sslmode=disable",
    )
    workspace_id = os.environ.get("WORKSPACE_ID", "").strip()
    owner_id = os.environ.get("OWNER_ID", "").strip()
    runtime_id = os.environ.get("RUNTIME_ID", "").strip()

    if not workspace_id or not owner_id or not runtime_id:
        print(
            "ERROR: WORKSPACE_ID + OWNER_ID 를 .env 에 박아주세요.\n"
            "  1) Multica web app (http://localhost:3000) 접속\n"
            "  2) 회원가입 + 워크스페이스 생성\n"
            "  3) DB에서 ID 확인:\n"
            '     docker exec -it multica-postgres-1 psql -U multica -d multica \\\n'
            '       -c "SELECT id, slug FROM workspace; SELECT id, email FROM \\"user\\";"\n'
            "  4) .env 에 박기",
            file=sys.stderr,
        )
        return 1

    if not AGENTS_DIR.exists():
        print(f"ERROR: 에이전트 정의 폴더 없음: {AGENTS_DIR}", file=sys.stderr)
        return 1

    agents = sorted(
        (parse_agent(p) for p in AGENTS_DIR.glob("*.md")),
        key=lambda a: a.name,
    )

    # 회사 헌법 — 모든 에이전트의 instructions 앞에 prepend 하여 27명 전원이 숙지하도록.
    constitution = ""
    if CONSTITUTION_PATH.exists():
        constitution = CONSTITUTION_PATH.read_text(encoding="utf-8").strip()

    print(f"발견된 외계 동료: {len(agents)}명")
    print(f"대상 DB: {db_url.split('@')[-1]}")
    print(f"WORKSPACE_ID: {workspace_id}")
    print(f"OWNER_ID:     {owner_id}")
    print(f"헌법 prepend: {'O (' + str(len(constitution)) + ' chars)' if constitution else 'X (CONSTITUTION.md 없음)'}")
    print()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # 중복 방지 — 같은 workspace 안에 이미 있는 name 조회
    cur.execute(
        "SELECT name FROM agent WHERE workspace_id = %s",
        (workspace_id,),
    )
    existing = {row[0] for row in cur.fetchall()}

    inserted = 0
    skipped = 0
    for a in agents:
        if a.name in existing:
            print(f"  SKIP {a.name} (이미 있음)")
            skipped += 1
            continue

        div = division_of(a.name)
        runtime_config = json.dumps({"provider": "claude_code"})
        # Division 정보는 description 앞에 prefix 로 박음 (Multica UI에서 한 줄로 보임)
        description = f"[{div}] {a.description}"

        # 헌법 + 개별 정의 — 27명 전원이 회사 헌법을 숙지한 채로 일하도록.
        if constitution:
            instructions = (
                f"{constitution}\n\n"
                f"{'=' * 72}\n"
                f"# 위는 Alien Agentic 회사 헌법 전문이다. 항상 이 헌법을 따른다.\n"
                f"# 아래는 당신({a.name}, {div} Division)의 개별 역할 정의다.\n"
                f"{'=' * 72}\n\n"
                f"{a.instructions}"
            )
        else:
            instructions = a.instructions

        cur.execute(
            """
            INSERT INTO agent (
                workspace_id, owner_id, runtime_id, name, description, instructions,
                runtime_mode, runtime_config, visibility, model,
                status, max_concurrent_tasks
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                'local', %s::jsonb, 'workspace', %s,
                'offline', 1
            )
            """,
            (
                workspace_id,
                owner_id,
                runtime_id,
                a.name,
                description,
                instructions,
                runtime_config,
                a.model,
            ),
        )
        print(f"  + {a.name:<22} ({div:<5}  {a.model})")
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print()
    print(f"완료: 신규 {inserted}명 / 스킵 {skipped}명")
    if inserted > 0:
        print("→ http://localhost:3000 → Settings → Agents 에서 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
