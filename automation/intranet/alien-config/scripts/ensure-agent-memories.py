"""ensure-agent-memories.py — 27명 에이전트의 메모리 디렉토리 + 4 빈 파일 보장.

배경: 외계인 메모리 페이지가 호스트의 shared-memory/agents/{name}/ 디렉토리를
스캔해서 트리를 만든다. 디렉토리가 없으면 그 에이전트는 메모리 페이지에 안
보임. 사용자가 에이전트와 처음 대화하기 전까지는 디렉토리가 생성 안 되는데,
*에이전트가 일을 시작하기 전*에도 미리 자리를 만들어둬야 한다.

설계: .claude/agents/*.md 의 frontmatter `name` 을 진실의 원천으로 사용.
각 에이전트마다 다음 구조 보장:

    shared-memory/agents/<name>/
        work.md
        learnings.md
        decisions.md
        mistakes.md

idempotent — 이미 있는 파일은 절대 덮어쓰지 않음. 빈 파일만 새로 만든다.
사용자가 작성한 메모리는 항상 보존된다.

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

# 새 빈 파일을 만들 때 박는 헤더 (사람이 읽기 좋게)
HEADERS = {
    "work.md":      "# Work — 진행 중·완료된 작업 기록\n\n",
    "learnings.md": "# Learnings — 배운 것·통찰\n\n",
    "decisions.md": "# Decisions — 의사결정과 그 이유\n\n",
    "mistakes.md":  "# Mistakes — 실패·교훈 (가장 비싼 자산)\n\n",
}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def extract_agent_names() -> list[str]:
    """.claude/agents/*.md 의 frontmatter name 필드 추출.

    name 필드가 없으면 파일명(stem)으로 fallback.
    """
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


def ensure(name: str) -> tuple[int, int]:
    """에이전트의 디렉토리 + 4파일 보장. (생성된 항목, 스킵된 항목) 반환."""
    agent_dir = MEMORY_DIR / name
    created = 0
    skipped = 0
    agent_dir.mkdir(parents=True, exist_ok=True)
    for fname in FILES:
        fp = agent_dir / fname
        if fp.exists():
            skipped += 1
            continue
        fp.write_text(HEADERS.get(fname, ""), encoding="utf-8")
        created += 1
    return created, skipped


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    names = extract_agent_names()
    if not names:
        print("FAIL: 에이전트 이름을 못 찾음", file=sys.stderr)
        return 1

    print(f"[ensure] {len(names)}명의 메모리 디렉토리 + 4파일 보장")
    print(f"  src: {AGENTS_SRC}")
    print(f"  dst: {MEMORY_DIR}")
    print()

    total_created = 0
    total_skipped = 0
    for name in names:
        c, s = ensure(name)
        total_created += c
        total_skipped += s
        if c > 0:
            print(f"  + {name:<25} 신규 {c}/4 파일")
        else:
            print(f"  = {name:<25} 모두 존재")

    print()
    print(f"결과: 신규 {total_created} 파일 / 스킵 {total_skipped} 파일")
    print(f"      에이전트 {len(names)}명 디렉토리 ensured")

    if total_created > 0:
        print("\n외계인 메모리 페이지 새로고침 시 모든 에이전트가 트리에 나타남.")
    else:
        print("\n변경 없음 (모든 메모리 파일이 이미 존재).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
