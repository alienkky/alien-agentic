"""GitHub 공개 Agent Skills를 Multica workspace에 등록 + 27명에게 할당.

anthropics/skills + vercel-labs/agent-skills 의 SKILL.md를 받아
skill 테이블에 INSERT, AGENT_SKILLS 매핑대로 agent_skill INSERT.

idempotent: 같은 이름 skill / 같은 (agent, skill) 쌍은 SKIP.

사용법:
    cd .../automation/intranet/alien-config/seeds
    python seed_skills.py

환경 변수 (.env):
    DATABASE_URL   — Multica PostgreSQL 연결 문자열
    WORKSPACE_ID   — 시드할 워크스페이스 UUID (필수)
    OWNER_ID       — skill.created_by 로 박을 사용자 UUID (필수)
"""

from __future__ import annotations

import os
import re
import sys
import urllib.request

# Windows 콘솔 UTF-8 보장
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

try:
    import psycopg2
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
    pass


# ──────────────────────────────────────────────────────────────────────────
# GitHub 스킬 소스 — 27명 매핑에 실제 쓰이는 14개
# ──────────────────────────────────────────────────────────────────────────
_GH = "https://raw.githubusercontent.com"
SKILL_SOURCES: dict[str, str] = {
    "doc-coauthoring":       f"{_GH}/anthropics/skills/main/skills/doc-coauthoring/SKILL.md",
    "pdf":                   f"{_GH}/anthropics/skills/main/skills/pdf/SKILL.md",
    "pptx":                  f"{_GH}/anthropics/skills/main/skills/pptx/SKILL.md",
    "xlsx":                  f"{_GH}/anthropics/skills/main/skills/xlsx/SKILL.md",
    "brand-guidelines":      f"{_GH}/anthropics/skills/main/skills/brand-guidelines/SKILL.md",
    "internal-comms":        f"{_GH}/anthropics/skills/main/skills/internal-comms/SKILL.md",
    "canvas-design":         f"{_GH}/anthropics/skills/main/skills/canvas-design/SKILL.md",
    "skill-creator":         f"{_GH}/anthropics/skills/main/skills/skill-creator/SKILL.md",
    "mcp-builder":           f"{_GH}/anthropics/skills/main/skills/mcp-builder/SKILL.md",
    "claude-api":            f"{_GH}/anthropics/skills/main/skills/claude-api/SKILL.md",
    "webapp-testing":        f"{_GH}/anthropics/skills/main/skills/webapp-testing/SKILL.md",
    "frontend-design":       f"{_GH}/anthropics/skills/main/skills/frontend-design/SKILL.md",
    "theme-factory":         f"{_GH}/anthropics/skills/main/skills/theme-factory/SKILL.md",
    "web-design-guidelines": f"{_GH}/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md",
}


# ──────────────────────────────────────────────────────────────────────────
# 27명(한글 표시명) → 스킬 매핑
# ──────────────────────────────────────────────────────────────────────────
AGENT_SKILLS: dict[str, list[str]] = {
    # WHY
    "심연우": ["doc-coauthoring", "pdf"],
    "민애린": ["doc-coauthoring"],
    "윤지평": ["doc-coauthoring", "pptx"],
    "서가온": ["brand-guidelines", "doc-coauthoring"],
    "한벼리": ["doc-coauthoring", "internal-comms"],
    # HOW
    "고도현": ["canvas-design", "doc-coauthoring"],
    "구도연": ["skill-creator", "doc-coauthoring"],
    "류한길": ["canvas-design", "doc-coauthoring"],
    "연다리": ["mcp-builder", "claude-api"],
    "차곡담": ["xlsx", "doc-coauthoring"],
    "정도량": ["xlsx", "doc-coauthoring"],
    "양터전": ["canvas-design", "doc-coauthoring"],
    # WHAT
    "남말씨": ["claude-api", "skill-creator"],
    "표본새": ["skill-creator", "claude-api"],
    "방연동": ["mcp-builder", "claude-api"],
    "공도율": ["claude-api", "webapp-testing"],
    "장서윤": ["doc-coauthoring"],
    "백그림": ["frontend-design", "web-design-guidelines", "theme-factory", "canvas-design"],
    "하검수": ["webapp-testing"],
    # CTRL
    "주결음": ["pptx", "doc-coauthoring", "pdf"],
    "노소문": ["internal-comms", "canvas-design"],
    "안다정": ["internal-comms", "doc-coauthoring"],
    "나재율": ["xlsx"],
    "문지율": ["brand-guidelines", "internal-comms"],
    # R&D
    "추세현": ["doc-coauthoring", "internal-comms"],
    "모사록": ["doc-coauthoring", "pdf"],
    "오먼동": ["doc-coauthoring", "pptx"],
}


FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url, headers={"User-Agent": "alien-agentic-seed-skills"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_skill_md(slug: str, text: str) -> tuple[str, str, str]:
    """SKILL.md → (name, description, content). frontmatter 없으면 slug 사용."""
    name, description = slug, ""
    content = text.strip()
    m = FRONTMATTER_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" not in line:
                continue
            k, _, v = line.partition(":")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k == "name" and v:
                name = v
            elif k == "description" and v:
                description = v
        content = text[m.end():].strip()
    return name, description, content


def main() -> int:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgres://multica:multica@localhost:5432/multica?sslmode=disable",
    )
    workspace_id = os.environ.get("WORKSPACE_ID", "").strip()
    owner_id = os.environ.get("OWNER_ID", "").strip()

    if not workspace_id or not owner_id:
        print(
            "ERROR: WORKSPACE_ID + OWNER_ID 를 .env 에 박아주세요.",
            file=sys.stderr,
        )
        return 1

    print(f"스킬 소스: {len(SKILL_SOURCES)}개 (GitHub)")
    print(f"WORKSPACE_ID: {workspace_id}")
    print()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # 기존 skill — idempotent
    cur.execute("SELECT name, id FROM skill WHERE workspace_id = %s", (workspace_id,))
    existing_skills = {row[0]: row[1] for row in cur.fetchall()}

    # ── 1. 스킬 fetch + INSERT ────────────────────────────────────────────
    print("[1] GitHub 스킬 등록")
    skill_db_id: dict[str, str] = {}    # slug → skill.id (uuid)
    skill_display: dict[str, str] = {}  # slug → skill.name (표시명)
    for slug, url in SKILL_SOURCES.items():
        try:
            text = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL  {slug:<22} fetch 실패: {e}")
            continue
        name, description, content = parse_skill_md(slug, text)
        skill_display[slug] = name
        if name in existing_skills:
            skill_db_id[slug] = existing_skills[name]
            print(f"  SKIP  {slug:<22} (이미 있음: {name})")
            continue
        cur.execute(
            """
            INSERT INTO skill (
                workspace_id, name, description, content, config, created_by
            ) VALUES (%s, %s, %s, %s, '{}'::jsonb, %s)
            RETURNING id
            """,
            (workspace_id, name, description, content, owner_id),
        )
        skill_db_id[slug] = cur.fetchone()[0]
        print(f"  +     {slug:<22} ({len(content):>6} chars) → {name}")

    conn.commit()
    print()

    # ── 2. 27명에게 스킬 할당 ─────────────────────────────────────────────
    print("[2] 27명 스킬 할당")
    cur.execute("SELECT name, id FROM agent WHERE workspace_id = %s", (workspace_id,))
    agent_id = {row[0]: row[1] for row in cur.fetchall()}

    cur.execute(
        """
        SELECT a.name, s.name
        FROM agent_skill ash
        JOIN agent a ON ash.agent_id = a.id
        JOIN skill s ON ash.skill_id = s.id
        WHERE a.workspace_id = %s
        """,
        (workspace_id,),
    )
    existing_assign = {(row[0], row[1]) for row in cur.fetchall()}

    assigned = 0
    skipped = 0
    missing_agents: list[str] = []
    for agent_name, slugs in AGENT_SKILLS.items():
        aid = agent_id.get(agent_name)
        if not aid:
            missing_agents.append(agent_name)
            continue
        applied: list[str] = []
        for slug in slugs:
            sid = skill_db_id.get(slug)
            sname = skill_display.get(slug)
            if not sid or not sname:
                continue
            if (agent_name, sname) in existing_assign:
                skipped += 1
                applied.append(f"{slug}(skip)")
                continue
            cur.execute(
                "INSERT INTO agent_skill (agent_id, skill_id) VALUES (%s, %s)",
                (aid, sid),
            )
            assigned += 1
            applied.append(slug)
        print(f"  {agent_name}: {', '.join(applied)}")

    conn.commit()
    cur.close()
    conn.close()

    print()
    print(
        f"완료: 스킬 {len(skill_db_id)}개 등록 / "
        f"할당 신규 {assigned}건 / 스킵 {skipped}건"
    )
    if missing_agents:
        print(f"⚠ 에이전트 못 찾음: {', '.join(missing_agents)}")
        return 1
    print("→ http://localhost:3000 → Settings → Skills / Agents 에서 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
