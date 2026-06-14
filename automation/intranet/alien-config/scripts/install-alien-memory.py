"""Alien Memory (외계인 메모리) 를 Multica 에 설치 -- 네이티브 페이지 + 사이드바.

install-alien-plan.py 와 같은 패턴. Alien Plan 이 이미 설치돼 있다고 가정 --
(설치 안 됐다면 일부 P 의 앵커가 안 맞아 FAIL 로 표시되니 install-alien-plan.py
먼저 실행할 것).

복사 (3):
  alien-memory/views/alien-memory-page.tsx -> packages/views/alien-memory/alien-memory-page.tsx
  alien-memory/views/index.ts             -> packages/views/alien-memory/index.ts
  alien-memory/route/page.tsx             -> apps/web/app/[workspaceSlug]/(dashboard)/alien-memory/page.tsx

앵커 패치 (9):
  P1 packages/views/package.json          exports 에 ./alien-memory
  P2 packages/core/paths/paths.ts         alienMemory path
  P3 app-sidebar.tsx                       lucide Brain import (Sparkles 옆)
  P4 app-sidebar.tsx                       NavKey 에 alienMemory
  P5 app-sidebar.tsx                       NavLabelKey 에 alien_memory
  P6 app-sidebar.tsx                       workspaceNav 배열 (alienPlan 다음)
  P7~P9 locales/{en,zh-Hans,ko}/layout.json  nav.alien_memory
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

# ─── 경로 ─────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent             # alien-config/scripts
ALIEN_SRC = HERE.parent / "alien-memory"           # alien-config/alien-memory
REPO = HERE.parent.parent.parent.parent            # repo root
MULTICA = REPO / "automation" / "intranet" / "multica"

VIEWS = MULTICA / "packages" / "views"
SIDEBAR = VIEWS / "layout" / "app-sidebar.tsx"
PATHS_TS = MULTICA / "packages" / "core" / "paths" / "paths.ts"
VIEWS_PKG = VIEWS / "package.json"
LOCALES = VIEWS / "locales"

COPIES = [
    (ALIEN_SRC / "views" / "alien-memory-page.tsx",
     VIEWS / "alien-memory" / "alien-memory-page.tsx"),
    (ALIEN_SRC / "views" / "index.ts",
     VIEWS / "alien-memory" / "index.ts"),
    (ALIEN_SRC / "route" / "page.tsx",
     MULTICA / "apps" / "web" / "app" / "[workspaceSlug]" / "(dashboard)" / "alien-memory" / "page.tsx"),
]

# 다국어 nav 키 -- 제품명 같지만 외계인 메타포는 한국어로 약간 다르게
NAV_TRANSLATIONS = {
    "en": "Alien Memory",
    "zh-Hans": "外星记忆",
    "ko": "외계인 메모리",
}


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


def patch_layout_json(path: Path, name: str, value: str,
                      applied: list, skipped: list, failed: list) -> None:
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
    if "alien_memory" in nav:
        print(f"  SKIP {name}  (이미 적용됨)")
        skipped.append(name)
        return

    # alien_plan 바로 다음에 alien_memory 가 오게 새 dict 구성
    new_nav: dict = {}
    inserted = False
    for k, v in nav.items():
        new_nav[k] = v
        if k == "alien_plan" and not inserted:
            new_nav["alien_memory"] = value
            inserted = True
    if not inserted:
        # alien_plan 키 없으면 맨 앞에
        new_nav = {"alien_memory": value, **nav}
    data["nav"] = new_nav
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  OK   {name}")
    applied.append(name)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not MULTICA.exists():
        print(f"FAIL: multica 폴더 없음 -- {MULTICA}", file=sys.stderr)
        return 1

    applied: list = []
    skipped: list = []
    failed: list = []

    # ── 0) 소스 파일 복사 ──
    print("[복사] 소스 -> multica")
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

    # P1. package.json exports -- alien-plan 옆에 alien-memory
    edit_file(
        VIEWS_PKG, "P1. views/package.json exports 에 ./alien-memory",
        marker='"./alien-memory"',
        anchor='  "./alien-plan": "./alien-plan/index.ts",',
        replacement='  "./alien-plan": "./alien-plan/index.ts",\n  "./alien-memory": "./alien-memory/index.ts",',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P2. paths.ts -- alienPlan 다음에 alienMemory
    edit_file(
        PATHS_TS, "P2. paths.ts alienMemory path",
        marker="alienMemory: () =>",
        anchor="    alienPlan: () => `${ws}/alien-plan`,",
        replacement="    alienPlan: () => `${ws}/alien-plan`,\n    alienMemory: () => `${ws}/alien-memory`,",
        applied=applied, skipped=skipped, failed=failed,
    )

    # P3. app-sidebar lucide Brain import (Sparkles 옆)
    edit_file(
        SIDEBAR, "P3. app-sidebar lucide Brain import",
        marker="  Brain,",
        anchor='  Sparkles,\n} from "lucide-react";',
        replacement='  Sparkles,\n  Brain,\n} from "lucide-react";',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P4. NavKey -- alienPlan 다음
    edit_file(
        SIDEBAR, "P4. app-sidebar NavKey 에 alienMemory",
        marker='| "alienMemory"',
        anchor='type NavKey =\n  | "alienPlan"\n  | "inbox"',
        replacement='type NavKey =\n  | "alienPlan"\n  | "alienMemory"\n  | "inbox"',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P5. NavLabelKey -- alien_plan 다음
    edit_file(
        SIDEBAR, "P5. app-sidebar NavLabelKey 에 alien_memory",
        marker='| "alien_memory"',
        anchor='type NavLabelKey =\n  | "alien_plan"\n  | "inbox"',
        replacement='type NavLabelKey =\n  | "alien_plan"\n  | "alien_memory"\n  | "inbox"',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P6. workspaceNav -- alienPlan 다음 위치 (Issues 위)
    edit_file(
        SIDEBAR, "P6. app-sidebar workspaceNav 에 alienMemory",
        marker='key: "alienMemory", labelKey: "alien_memory"',
        anchor='  { key: "alienPlan", labelKey: "alien_plan", icon: Sparkles },\n  { key: "issues", labelKey: "issues", icon: ListTodo },',
        replacement='  { key: "alienPlan", labelKey: "alien_plan", icon: Sparkles },\n  { key: "alienMemory", labelKey: "alien_memory", icon: Brain },\n  { key: "issues", labelKey: "issues", icon: ListTodo },',
        applied=applied, skipped=skipped, failed=failed,
    )

    # P7~P9. layout.json (en, zh-Hans, ko)
    for loc, value in NAV_TRANSLATIONS.items():
        patch_layout_json(
            LOCALES / loc / "layout.json",
            f"P. layout.json[{loc}] nav.alien_memory = {value!r}",
            value=value,
            applied=applied, skipped=skipped, failed=failed,
        )

    print()
    print(f"결과: 적용 {len(applied)} / 스킵 {len(skipped)} / 실패 {len(failed)}")
    if failed:
        print("\n실패:")
        for n in failed:
            print(f"  - {n}")
        print("\n힌트: Alien Plan 이 먼저 설치돼 있어야 일부 앵커가 매칭됩니다.")
        print("       install-alien-plan.py 먼저 실행했는지 확인.")
        return 1
    if not applied:
        print("\n변경 없음 (이미 모두 설치됨).")
    else:
        print("\n설치 완료. 다음 단계:")
        print("  1. setup-memory-api.ps1 -- sidecar 컨테이너 빌드 + 가동")
        print("  2. setup-caddy.ps1 -- Caddyfile 재생성 (/api/alien-memory 라우팅)")
        print("  3. setup-multica.ps1 -- multica 재빌드 (변경된 사이드바 반영)")
        print("  4. https://<tailnet>/<workspaceSlug>/alien-memory -- 사이드바 'Brain' 아이콘")
    return 0


if __name__ == "__main__":
    sys.exit(main())
