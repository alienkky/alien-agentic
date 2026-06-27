"""ensure-agent-memories.py — 27명 에이전트의 메모리 디렉토리 + 4파일 보장 + Obsidian frontmatter.

배경: 외계인 메모리 페이지가 호스트의 shared-memory/agents/{name}/ 디렉토리를
스캔해서 트리를 만든다. 디렉토리가 없으면 그 에이전트는 메모리 페이지에 안
보임. 또 Obsidian Vault 로 열었을 때 Dataview·그래프뷰가 강력하려면 각 메모리
파일에 YAML frontmatter(agent·korean_name·division·file_type·tags)가 필요하다.

설계: .claude/agents/*.md 의 frontmatter `name` 을 진실의 원천으로 사용.
각 에이전트마다 다음 구조 보장:

    shared-memory/agents/<name>/
        work.md       (frontmatter: file_type=work,      tags=[agent, work, <div>])
        learnings.md  (frontmatter: file_type=learnings, tags=[agent, learnings, <div>])
        decisions.md  (frontmatter: file_type=decisions, tags=[agent, decisions, <div>])
        mistakes.md   (frontmatter: file_type=mistakes,  tags=[agent, mistakes, <div>, mistake])

idempotent + 비파괴:
  - 신규 파일: frontmatter + 헤더로 생성
  - 기존 파일에 frontmatter 없음: frontmatter 만 맨 앞에 prepend (기존 본문 100% 보존)
  - 기존 파일에 frontmatter 있음: 절대 안 건드림
어떤 사용자 메모리도 손실되지 않는다.

호출: setup-memory-api.ps1 이 컨테이너 가동 *전*에 자동 호출.
또는 수동: python ensure-agent-memories.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent.parent
AGENTS_SRC = REPO / ".claude" / "agents"
MEMORY_DIR = REPO / "shared-memory" / "agents"

FILES = ("work.md", "learnings.md", "decisions.md", "mistakes.md")

# 파일별 본문 헤더 (사람이 읽기 좋게)
HEADERS = {
    "work.md":      "# Work — 진행 중·완료된 작업 기록\n\n",
    "learnings.md": "# Learnings — 배운 것·통찰\n\n",
    "decisions.md": "# Decisions — 의사결정과 그 이유\n\n",
    "mistakes.md":  "# Mistakes — 실패·교훈 (가장 비싼 자산)\n\n",
}

# 영문 디렉토리명 → (한글 인명, 역할 라벨, division)
# 출처: memory-api/app.py 의 KOREAN_NAMES + seeds/seed_agents.py 의 DIVISIONS.
# division 태그는 소문자: WHY→why, HOW→how, WHAT→what, CTRL→ctrl, R&D→rnd.
ROSTER: dict[str, tuple[str, str, str]] = {
    # WHY — 외계어 통역사
    "origin-reader":          ("심연우", "Why발굴",       "why"),
    "pain-interpreter":       ("민애린", "페인진단",      "why"),
    "vision-architect":       ("윤지평", "비전설계",      "why"),
    "culture-linguist":       ("서가온", "컬쳐언어",      "why"),
    "story-weaver":           ("한벼리", "내러티브",      "why"),
    # HOW — 외계 설계자
    "process-cartographer":   ("고도현", "프로세스",      "how"),
    "agent-architect":        ("구도연", "팀설계",        "how"),
    "workflow-engineer":      ("류한길", "워크플로",      "how"),
    "integration-specialist": ("연다리", "통합설계",      "how"),
    "data-strategist":        ("차곡담", "데이터",        "how"),
    "kpi-translator":         ("정도량", "KPI",          "how"),
    "org-designer":           ("양터전", "조직설계",      "how"),
    # WHAT — 외계 빌더
    "prompt-engineer":        ("남말씨", "프롬프트",      "what"),
    "subagent-builder":       ("표본새", "에이전트빌더",  "what"),
    "mcp-connector":          ("방연동", "MCP",          "what"),
    "automation-coder":       ("공도율", "자동화",        "what"),
    "knowledge-architect":    ("장서윤", "지식설계",      "what"),
    "ui-ux-designer":         ("백그림", "UI/UX",        "what"),
    "qa-tester":              ("하검수", "QA",           "what"),
    # CTRL — 지구 적응
    "sales-closer":           ("주결음", "영업",          "ctrl"),
    "content-scout":          ("노소문", "콘텐츠",        "ctrl"),
    "client-concierge":       ("안다정", "고객관리",      "ctrl"),
    "finance-tracker":        ("나재율", "재무",          "ctrl"),
    "brand-keeper":           ("문지율", "브랜드검수",    "ctrl"),
    # R&D — 외계 연구원
    "trend-hunter":           ("추세현", "트렌드",        "rnd"),
    "case-curator":           ("모사록", "케이스",        "rnd"),
    "future-forecaster":      ("오먼동", "미래예측",      "rnd"),
}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def extract_agent_names() -> list[str]:
    """.claude/agents/*.md 의 frontmatter name 필드 추출 (없으면 stem fallback)."""
    if not AGENTS_SRC.is_dir():
        print(f"FAIL: .claude/agents 디렉토리 없음 -- {AGENTS_SRC}", file=sys.stderr)
        return []

    names: list[str] = []
    for md_file in sorted(AGENTS_SRC.glob("*.md")):
        if md_file.name.startswith("_"):
            continue
        text = md_file.read_text(encoding="utf-8", errors="replace")
        match = FRONTMATTER_RE.match(text)
        name = md_file.stem
        if match:
            for line in match.group(1).splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    if k.strip() == "name":
                        name = v.strip()
                        break
        names.append(name)
    return names


def build_frontmatter(agent: str, fname: str) -> str:
    """에이전트 + 파일 종류에 맞는 YAML frontmatter 생성."""
    korean, role, div = ROSTER.get(agent, ("", "", "etc"))
    file_type = fname.replace(".md", "")
    tags = ["agent", file_type, div]
    if file_type == "mistakes":
        tags.append("mistake")  # 그래프뷰에서 빨강 그룹 매칭
    tag_str = ", ".join(tags)
    lines = [
        "---",
        f"agent: {agent}",
    ]
    if korean:
        lines.append(f"korean_name: {korean}")
        lines.append(f"role: {role}")
        lines.append(f"division: {div}")
    lines.append("type: agent-memory")
    lines.append(f"file_type: {file_type}")
    lines.append(f"tags: [{tag_str}]")
    lines.append("---")
    lines.append("")
    return "\n".join(lines) + "\n"


def ensure(agent: str) -> tuple[int, int, int]:
    """디렉토리 + 4파일 보장 + frontmatter. (신규, frontmatter추가, 스킵) 반환."""
    agent_dir = MEMORY_DIR / agent
    created = 0
    fm_added = 0
    skipped = 0
    agent_dir.mkdir(parents=True, exist_ok=True)

    for fname in FILES:
        fp = agent_dir / fname
        fm = build_frontmatter(agent, fname)

        if not fp.exists():
            # 신규: frontmatter + 헤더
            fp.write_text(fm + HEADERS.get(fname, ""), encoding="utf-8")
            created += 1
            continue

        # 기존 파일
        text = fp.read_text(encoding="utf-8")
        if text.lstrip().startswith("---"):
            # 이미 frontmatter 있음 — 절대 안 건드림
            skipped += 1
            continue

        # frontmatter 없음 — 맨 앞에 prepend (본문 100% 보존)
        fp.write_text(fm + text, encoding="utf-8")
        fm_added += 1

    return created, fm_added, skipped


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    names = extract_agent_names()
    if not names:
        print("FAIL: 에이전트 이름을 못 찾음", file=sys.stderr)
        return 1

    print(f"[ensure] {len(names)}명의 메모리 디렉토리 + 4파일 + Obsidian frontmatter")
    print(f"  src: {AGENTS_SRC}")
    print(f"  dst: {MEMORY_DIR}")
    print()

    t_created = 0
    t_fm = 0
    t_skip = 0
    for name in names:
        c, f, s = ensure(name)
        t_created += c
        t_fm += f
        t_skip += s
        parts = []
        if c:
            parts.append(f"신규 {c}")
        if f:
            parts.append(f"frontmatter +{f}")
        status = " · ".join(parts) if parts else "모두 OK"
        print(f"  {name:<25} {status}")

    print()
    print(f"결과: 신규 {t_created} · frontmatter 추가 {t_fm} · 스킵 {t_skip}")
    print(f"      에이전트 {len(names)}명 ensured")

    if t_created or t_fm:
        print("\nObsidian Vault 새로고침 시 Dataview·그래프뷰가 division·file_type 별로 인덱싱.")
    else:
        print("\n변경 없음 (모든 파일이 이미 frontmatter 포함).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
