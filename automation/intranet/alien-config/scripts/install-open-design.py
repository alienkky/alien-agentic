"""Alien Agentic 자산을 Open Design 본진에 이식 (복원).

open-design 본진(automation/intranet/open-design/)은 .gitignore + fresh
clone drift. 우리 브랜드 자산(design-systems/alien-agentic/DESIGN.md,
향후 skills/)은 우리 git 의 alien-config/open-design/ 에 두고, 이 스크립트가
본진의 해당 폴더로 복사한다. 데몬 재시작하면 피커에 등장.

복사 대상 (alien-config/open-design/ 하위 → open-design/ 하위):
  design-systems/<name>/  → open-design/design-systems/<name>/
  skills/<name>/          → open-design/skills/<name>/   (있으면)

멱등성: 항상 덮어쓴다 (우리 소스가 정본).
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent              # alien-config/scripts
ALIEN_SRC = HERE.parent / "open-design"             # alien-config/open-design
REPO = HERE.parent.parent.parent.parent             # repo root
OPEN_DESIGN = REPO / "automation" / "intranet" / "open-design"

# 복사할 카테고리 (open-design 본진의 동일 폴더로)
CATEGORIES = ["design-systems", "skills"]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not OPEN_DESIGN.exists():
        print(f"FAIL: open-design 본진 없음 — {OPEN_DESIGN}", file=sys.stderr)
        print("먼저 clone: git clone https://github.com/nexu-io/open-design.git", file=sys.stderr)
        print("(docs/guides/open-design-setup.md 참고)", file=sys.stderr)
        return 1

    if not ALIEN_SRC.exists():
        print(f"FAIL: 우리 자산 폴더 없음 — {ALIEN_SRC}", file=sys.stderr)
        return 1

    copied: list[str] = []
    skipped_cats: list[str] = []

    for category in CATEGORIES:
        src_dir = ALIEN_SRC / category
        if not src_dir.exists():
            skipped_cats.append(category)
            continue
        items = [d for d in src_dir.iterdir() if d.is_dir()]
        if not items:
            skipped_cats.append(category)
            continue
        dst_root = OPEN_DESIGN / category
        dst_root.mkdir(parents=True, exist_ok=True)
        print(f"[{category}]")
        for item in items:
            dst = dst_root / item.name
            shutil.copytree(item, dst, dirs_exist_ok=True)
            print(f"  OK   {category}/{item.name}")
            copied.append(f"{category}/{item.name}")

    print()
    print(f"결과: 이식 {len(copied)}개" + (f" / 빈 카테고리 {len(skipped_cats)}" if skipped_cats else ""))
    if not copied:
        print("이식할 자산이 없습니다 (alien-config/open-design/{design-systems,skills}/ 가 비어있음).")
        return 0
    print()
    print("이식 완료. open-design 데몬을 재시작하면 피커에 등장합니다:")
    print("  open-design 터미널에서 Ctrl+C → pnpm tools-dev run web")
    print("그 다음 모델/시스템 피커에서 'Alien Agentic' 선택.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
