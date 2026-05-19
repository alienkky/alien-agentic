"""Alien Plan 을 Multica 에 설치 — 네이티브 페이지 + 사이드바 등록.

multica/ 가 .gitignore + fresh clone drift 라, 우리 git 의 소스
(alien-config/alien-plan/) 를 multica 의 올바른 위치로 *복사* 하고,
multica 기존 파일들을 *유니크 앵커 기반* 으로 패치한다. 멱등성 보장.

복사 (3):
  alien-plan/views/alien-plan-page.tsx → packages/views/alien-plan/alien-plan-page.tsx
  alien-plan/views/index.ts           → packages/views/alien-plan/index.ts
  alien-plan/route/page.tsx           → apps/web/app/[workspaceSlug]/(dashboard)/alien-plan/page.tsx

앵커 패치 (9):
  P1 packages/views/package.json          exports 에 ./alien-plan
  P2 packages/core/paths/paths.ts         alienPlan path
  P3 app-sidebar.tsx                       lucide Sparkles import
  P4 app-sidebar.tsx                       NavKey 타입
  P5 app-sidebar.tsx                       NavLabelKey 타입
  P6 app-sidebar.tsx                       workspaceNav 배열 (Issues 위 최상단)
  P7~P9 locales/{en,zh-Hans,ko}/layout.json  nav.alien_plan = "Alien Plan"
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

# ─── 경로 ─────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent             # alien-config/scripts
ALIEN_SRC = HERE.parent / "alien-plan"             # alien-config/alien-plan
REPO = HERE.parent.parent.parent.parent            # repo root
MULTICA = REPO / "automation" / "intranet" / "multica"

VIEWS = MULTICA / "packages" / "views"
SIDEBAR = VIEWS / "layout" / "app-sidebar.tsx"
PATHS_TS = MULTICA / "packages" / "core" / "paths" / "paths.ts"
VIEWS_PKG = VIEWS / "package.json"
LOCALES = VIEWS / "locales"

COPIES = [
    (ALIEN_SRC / "views" / "alien-plan-page.tsx", VIEWS / "alien-plan" / "alien-plan-page.tsx"),
    (ALIEN_SRC / "views" / "index.ts", VIEWS / "alien-plan" / "index.ts"),
    (ALIEN_SRC / "route" / "page.tsx", MULTICA / "apps" / "web" / "app" / "[workspaceSlug]" / "(dashboard)" / "alien-plan" / "page.tsx"),
]


def edit_file(path: Path, name: str, marker: str, anchor: str, replacement: str,
              applied: list, skipped: list, failed: list) -> None:
    if not path.exists():
        print(f"  FAIL {name}  (파일 없음: {path})")
        failed.append(name)
        return
    text = path.read_text(encoding="utf-8")
    if marker in text:
        print(f"  SKIP {name}  (이미 적용됨)")
        skipped.append(name)
        return
    if anchor not in text:
        print(f"  FAIL {name}  (앵커 없음)")
        failed.append(name)
        return
    if text.count(anchor) > 1:
        print(f"  FAIL {name}  (앵커 중복 {text.count(anchor)}개)")
        failed.append(name)
        return
    path.write_bytes(text.replace(anchor, replacement, 1).encode("utf-8"))
    print(f"  OK   {name}")
    applied.append(name)


def patch_layout_json(path: Path, name: str, applied: list, skipped: list, failed: list) -> None:
    if not path.exists():
        print(f"  FAIL {name}  (파일 없음: {path})")
        failed.append(name)
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  FAIL {name}  (JSON 파싱 실패: {e})")
        failed.append(name)
        return
    nav = data.get("nav")
    if not isinstance(nav, dict):
        print(f"  FAIL {name}  (nav 객체 없음)")
        failed.append(name)
        return
    if "alien_plan" in nav:
        print(f"  SKIP {name}  (이미 적용됨)")
        skipped.append(name)
        return
    # nav 맨 앞에 추가 (제품명이라 모든 로케일 동일)
    data["nav"] = {"alien_plan": "Alien Plan", **nav}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  OK   {name}")
    applied.append(name)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not MULTICA.exists():
        print(f"FAIL: multica 폴더 없음 — {MULTICA}", file=sys.stderr)
        return 1

    applied: list = []
    skipped: list = []
    failed: list = []

    # ── 0) 소스 파일 복사 ──
    print("[복사] 소스 → multica")
    for src, dst in COPIES:
        if not src.exists():
            print(f"  FAIL 복사  (소스 없음: {src})")
            failed.append(f"copy {src.name}")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        print(f"  OK   {dst.relative_to(MULTICA)}")
        applied.append(f"copy {dst.name}")
    print()

    # ── 1) 앵커 패치 ──
    print("[패치] multica 기존 파일")

    # P1. package.json exports
    edit_file(
        VIEWS_PKG, "P1. views/package.json exports 에 ./alien-plan",
        marker='"./alien-plan"',
        anchor='  "./agents": "./agents/index.ts",',
        replacement='  "./agents": "./agents/index.ts",\n  "./alien-plan": "./alien-plan/index.ts",',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P2. paths.ts (workspaceScoped 안, issues 위)
    edit_file(
        PATHS_TS, "P2. paths.ts alienPlan path",
        marker="alienPlan: () =>",
        anchor="    issues: () => `${ws}/issues`,",
        replacement="    alienPlan: () => `${ws}/alien-plan`,\n    issues: () => `${ws}/issues`,",
        applied=applied, skipped=skipped, failed=failed,
    )

    # P3. app-sidebar lucide import
    edit_file(
        SIDEBAR, "P3. app-sidebar lucide Sparkles import",
        marker="Sparkles",
        anchor='  Users,\n} from "lucide-react";',
        replacement='  Users,\n  Sparkles,\n} from "lucide-react";',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P4. NavKey
    edit_file(
        SIDEBAR, "P4. app-sidebar NavKey 타입",
        marker='| "alienPlan"',
        anchor='type NavKey =\n  | "inbox"',
        replacement='type NavKey =\n  | "alienPlan"\n  | "inbox"',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P5. NavLabelKey
    edit_file(
        SIDEBAR, "P5. app-sidebar NavLabelKey 타입",
        marker='| "alien_plan"',
        anchor='type NavLabelKey =\n  | "inbox"',
        replacement='type NavLabelKey =\n  | "alien_plan"\n  | "inbox"',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P6. workspaceNav 배열 (Issues 위 최상단)
    edit_file(
        SIDEBAR, "P6. app-sidebar workspaceNav 에 alienPlan (최상단)",
        marker='key: "alienPlan", labelKey: "alien_plan"',
        anchor='const workspaceNav: { key: NavKey; labelKey: NavLabelKey; icon: typeof Inbox }[] = [\n  { key: "issues", labelKey: "issues", icon: ListTodo },',
        replacement='const workspaceNav: { key: NavKey; labelKey: NavLabelKey; icon: typeof Inbox }[] = [\n  { key: "alienPlan", labelKey: "alien_plan", icon: Sparkles },\n  { key: "issues", labelKey: "issues", icon: ListTodo },',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P7~P9. layout.json (en, zh-Hans, ko)
    for loc in ("en", "zh-Hans", "ko"):
        patch_layout_json(
            LOCALES / loc / "layout.json",
            f"P. layout.json[{loc}] nav.alien_plan",
            applied=applied, skipped=skipped, failed=failed,
        )

    print()
    print(f"결과: 적용 {len(applied)} / 스킵 {len(skipped)} / 실패 {len(failed)}")
    if failed:
        print("\n실패:")
        for n in failed:
            print(f"  - {n}")
        return 1
    if not applied:
        print("\n변경 없음 (이미 모두 설치됨).")
    else:
        print("\n설치 완료. 도커 재빌드 후 사이드바 최상단 'Alien Plan' 확인.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
