"""apply-skills.py — GitHub 공개 스킬 14개를 Multica 에 등록 + 27명에게 할당.

배경 (2026-06-26 사고 복구): seeds/seed_skills.py 는 psycopg2 로 localhost:5432
에 직접 연결하는데, multica 셀프호스트는 postgres 포트를 호스트에 노출하지
않아 연결 실패 → skill 0개. 이 스크립트는 `aa seed` 와 동일하게 **docker exec
psql** 로 우회한다(포트 불필요). WORKSPACE_ID·OWNER_ID 도 DB 에서 자동 탐색.

  - GitHub 에서 14개 SKILL.md fetch (호스트 urllib)
  - docker exec psql 로 skill INSERT (dollar-quote — 본문 이스케이프 안전)
  - AGENT_SKILLS 매핑대로 agent_skill INSERT (이름 영문/한글/혼합 모두 매칭)

idempotent: 같은 이름 skill / 같은 (agent,skill) 쌍은 SKIP.

실행: python apply-skills.py
"""
from __future__ import annotations

import subprocess
import sys
import urllib.request

PG = "multica-postgres-1"
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

ENG_TO_KOR: dict[str, str] = {
    "origin-reader": "심연우", "pain-interpreter": "민애린",
    "vision-architect": "윤지평", "culture-linguist": "서가온",
    "story-weaver": "한벼리", "process-cartographer": "고도현",
    "agent-architect": "구도연", "workflow-engineer": "류한길",
    "integration-specialist": "연다리", "data-strategist": "차곡담",
    "kpi-translator": "정도량", "org-designer": "양터전",
    "prompt-engineer": "남말씨", "subagent-builder": "표본새",
    "mcp-connector": "방연동", "automation-coder": "공도율",
    "knowledge-architect": "장서윤", "ui-ux-designer": "백그림",
    "qa-tester": "하검수", "sales-closer": "주결음",
    "content-scout": "노소문", "client-concierge": "안다정",
    "finance-tracker": "나재율", "brand-keeper": "문지율",
    "trend-hunter": "추세현", "case-curator": "모사록",
    "future-forecaster": "오먼동",
}

AGENT_SKILLS: dict[str, list[str]] = {
    "심연우": ["doc-coauthoring", "pdf"],
    "민애린": ["doc-coauthoring"],
    "윤지평": ["doc-coauthoring", "pptx"],
    "서가온": ["brand-guidelines", "doc-coauthoring"],
    "한벼리": ["doc-coauthoring", "internal-comms"],
    "고도현": ["canvas-design", "doc-coauthoring"],
    "구도연": ["skill-creator", "doc-coauthoring"],
    "류한길": ["canvas-design", "doc-coauthoring"],
    "연다리": ["mcp-builder", "claude-api"],
    "차곡담": ["xlsx", "doc-coauthoring"],
    "정도량": ["xlsx", "doc-coauthoring"],
    "양터전": ["canvas-design", "doc-coauthoring"],
    "남말씨": ["claude-api", "skill-creator"],
    "표본새": ["skill-creator", "claude-api"],
    "방연동": ["mcp-builder", "claude-api"],
    "공도율": ["claude-api", "webapp-testing"],
    "장서윤": ["doc-coauthoring"],
    "백그림": ["frontend-design", "web-design-guidelines", "theme-factory", "canvas-design"],
    "하검수": ["webapp-testing"],
    "주결음": ["pptx", "doc-coauthoring", "pdf"],
    "노소문": ["canvas-design", "internal-comms", "doc-coauthoring"],
    "안다정": ["doc-coauthoring", "internal-comms"],
    "나재율": ["xlsx", "doc-coauthoring"],
    "문지율": ["brand-guidelines", "doc-coauthoring"],
    "추세현": ["doc-coauthoring", "pdf"],
    "모사록": ["doc-coauthoring", "pptx"],
    "오먼동": ["doc-coauthoring", "pptx"],
}

# dollar-quote 태그 — SKILL.md 본문에 이 문자열이 있을 일은 사실상 없음
DQ = "aa_skill_dq"


def psql(sql: str) -> tuple[int, str]:
    """docker exec psql — 짧은 SQL (인자로). (exit, 출력)."""
    p = subprocess.run(
        ["docker", "exec", "-i", PG, "psql", "-U", "multica", "-d", "multica",
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()


def psql_stdin(sql: str) -> tuple[int, str]:
    """docker exec psql — 긴 SQL (stdin 으로, dollar-quote 본문 포함)."""
    p = subprocess.run(
        ["docker", "exec", "-i", PG, "psql", "-U", "multica", "-d", "multica",
         "-t", "-A"],
        input=sql, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "alien-agentic"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_skill_md(slug: str, text: str) -> tuple[str, str, str]:
    """SKILL.md frontmatter 에서 name·description, 본문 추출."""
    import re
    name, description, content = slug, "", text
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if m:
        for line in m.group(1).splitlines():
            if ":" not in line:
                continue
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k == "name" and v:
                name = v
            elif k == "description" and v:
                description = v
        content = text[m.end():].strip()
    return name, description, content


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    # 컨테이너 연결 확인
    rc, _ = psql("SELECT 1;")
    if rc != 0:
        print(f"FAIL: {PG} 연결 불가 — multica 가동 후 재시도", file=sys.stderr)
        return 1

    # WORKSPACE_ID · OWNER_ID 자동 탐색
    rc, ws = psql("SELECT id FROM workspace ORDER BY created_at LIMIT 1;")
    rc2, owner = psql("SELECT id FROM \"user\" ORDER BY created_at LIMIT 1;")
    ws, owner = ws.strip(), owner.strip()
    if not ws or not owner:
        print(f"FAIL: workspace/user 못 찾음 (ws={ws!r}, owner={owner!r})", file=sys.stderr)
        return 1
    print(f"WORKSPACE_ID: {ws}")
    print(f"OWNER_ID:     {owner}")
    print()

    # 기존 skill (idempotent)
    _, existing_out = psql(f"SELECT name FROM skill WHERE workspace_id = '{ws}';")
    existing = {n.strip() for n in existing_out.splitlines() if n.strip()}

    # ── 1. GitHub 스킬 fetch + INSERT ────────────────────────────────────
    print("[1] GitHub 스킬 등록")
    skill_name_by_slug: dict[str, str] = {}
    for slug, url in SKILL_SOURCES.items():
        try:
            text = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL  {slug:<22} fetch 실패: {e}")
            continue
        name, desc, content = parse_skill_md(slug, text)
        skill_name_by_slug[slug] = name
        if name in existing:
            print(f"  SKIP  {slug:<22} (이미 있음: {name})")
            continue
        # dollar-quote 로 본문 안전하게 (작은따옴표·줄바꿈 이스케이프 불필요)
        sql = (
            f"INSERT INTO skill (workspace_id, name, description, content, config, created_by) "
            f"VALUES ('{ws}', "
            f"${DQ}n${name}${DQ}n$, "
            f"${DQ}d${desc}${DQ}d$, "
            f"${DQ}c${content}${DQ}c$, "
            f"'{{}}'::jsonb, '{owner}');"
        )
        rc, msg = psql_stdin(sql)
        if rc == 0:
            print(f"  +     {slug:<22} ({len(content):>6} chars) → {name}")
            existing.add(name)
        else:
            print(f"  FAIL  {slug:<22}: {msg}")

    # slug → skill.id 조회
    _, rows = psql(f"SELECT name, id FROM skill WHERE workspace_id = '{ws}';")
    name_to_id = {}
    for line in rows.splitlines():
        if "|" in line:
            n, i = line.rsplit("|", 1)
            name_to_id[n.strip()] = i.strip()
    slug_to_id = {slug: name_to_id.get(nm) for slug, nm in skill_name_by_slug.items()}

    # ── 2. agent 이름 → id (영문·한글·혼합 모두 키) ──────────────────────
    print()
    print("[2] 27명 스킬 할당")
    import re
    _, arows = psql(f"SELECT name, id FROM agent WHERE workspace_id = '{ws}';")
    agent_id: dict[str, str] = {}
    for line in arows.splitlines():
        if "|" not in line:
            continue
        nm, aid = line.rsplit("|", 1)
        nm, aid = nm.strip(), aid.strip()
        agent_id[nm] = aid
        m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", nm)
        if m:
            agent_id.setdefault(m.group(1).strip(), aid)
            agent_id.setdefault(m.group(2).strip(), aid)
        elif nm in ENG_TO_KOR:
            agent_id.setdefault(ENG_TO_KOR[nm], aid)

    # 기존 할당 (idempotent)
    _, ex = psql(
        f"SELECT agent_id || '|' || skill_id FROM agent_skill "
        f"WHERE agent_id IN (SELECT id FROM agent WHERE workspace_id = '{ws}');"
    )
    existing_pairs = {l.strip() for l in ex.splitlines() if l.strip()}

    assigned = skipped = 0
    missing: list[str] = []
    for agent_name, slugs in AGENT_SKILLS.items():
        aid = agent_id.get(agent_name)
        if not aid:
            missing.append(agent_name)
            continue
        applied = []
        for slug in slugs:
            sid = slug_to_id.get(slug)
            if not sid:
                continue
            if f"{aid}|{sid}" in existing_pairs:
                skipped += 1
                applied.append(f"{slug}(skip)")
                continue
            rc, msg = psql(
                f"INSERT INTO agent_skill (agent_id, skill_id) VALUES ('{aid}', '{sid}');"
            )
            if rc == 0:
                assigned += 1
                applied.append(slug)
            else:
                applied.append(f"{slug}(FAIL)")
        print(f"  {agent_name}: {', '.join(applied)}")

    print()
    print(f"완료: 스킬 {len(slug_to_id)}개 / 할당 신규 {assigned}건 · 스킵 {skipped}건")
    if missing:
        print(f"⚠ 에이전트 못 찾음: {', '.join(missing)}")
    print("→ Multica → Settings → Skills / Agents 에서 확인 (새로고침)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
