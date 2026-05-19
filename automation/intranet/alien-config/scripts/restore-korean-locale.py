"""한국어 locale 등록 복원 — multica 가 fresh clone 되면서 사라진 ko 등록을
   3개 파일에 다시 박아넣는다.

ko/*.json (24개) 데이터는 multica/packages/views/locales/ko/ 에 untracked 로
살아있다고 가정 (없으면 translate_locale_ko.py 부터 돌려야 함 → 명시적 에러).

변경 위치:
  F1. packages/core/i18n/types.ts            (SupportedLocale + SUPPORTED_LOCALES)
  F2. apps/web/app/layout.tsx                (HTML_LANG record)
  F3. packages/views/locales/index.ts        (24 import + RESOURCES.ko)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# ─── 경로 ─────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent.parent  # scripts→alien-config→intranet→automation→repo
MULTICA = REPO / "automation" / "intranet" / "multica"

TYPES_TS    = MULTICA / "packages" / "core" / "i18n" / "types.ts"
LAYOUT_TSX  = MULTICA / "apps" / "web" / "app" / "layout.tsx"
INDEX_TS    = MULTICA / "packages" / "views" / "locales" / "index.ts"
KO_DIR      = MULTICA / "packages" / "views" / "locales" / "ko"

# 24개 namespace — locales/index.ts 의 zhHans import 순서를 따라감
KO_NAMESPACES = [
    ("common",      "common.json"),
    ("auth",        "auth.json"),
    ("settings",    "settings.json"),
    ("issues",      "issues.json"),
    ("agents",      "agents.json"),
    ("editor",      "editor.json"),
    ("onboarding",  "onboarding.json"),
    ("invite",      "invite.json"),
    ("labels",      "labels.json"),
    ("members",     "members.json"),
    ("my-issues",   "my-issues.json"),
    ("search",      "search.json"),
    ("inbox",       "inbox.json"),
    ("workspace",   "workspace.json"),
    ("projects",    "projects.json"),
    ("autopilots",  "autopilots.json"),
    ("skills",      "skills.json"),
    ("chat",        "chat.json"),
    ("modals",      "modals.json"),
    ("runtimes",    "runtimes.json"),
    ("layout",      "layout.json"),
    ("usage",       "usage.json"),
    ("ui",          "ui.json"),
    ("squads",      "squads.json"),
]


def _to_camel(name: str) -> str:
    """my-issues → koMyIssues"""
    parts = name.split("-")
    return "ko" + "".join(p.capitalize() for p in parts)


def build_ko_imports_block() -> str:
    lines = []
    for name, fname in KO_NAMESPACES:
        var = _to_camel(name)
        lines.append(f'import {var} from "./ko/{fname}";')
    return "\n".join(lines)


def build_ko_resources_block() -> str:
    lines = ["  ko: {"]
    for name, _ in KO_NAMESPACES:
        var = _to_camel(name)
        lines.append(f"    {name}: {var},")
    lines.append("  },")
    return "\n".join(lines)


def edit_file(path: Path, name: str, marker: str, anchor: str, replacement: str,
              applied: list, skipped: list, failed: list) -> str | None:
    """단일 파일에 단일 변경 적용. 반환: 변경된 본문 또는 None."""
    if not path.exists():
        print(f"  FAIL {name}  (파일 없음: {path})")
        failed.append(name)
        return None

    text = path.read_text(encoding="utf-8")

    if marker in text:
        print(f"  SKIP {name}  (이미 적용됨)")
        skipped.append(name)
        return None

    if anchor not in text:
        print(f"  FAIL {name}  (앵커 없음)")
        failed.append(name)
        return None

    if text.count(anchor) > 1:
        print(f"  FAIL {name}  (앵커 중복 {text.count(anchor)}개)")
        failed.append(name)
        return None

    new_text = text.replace(anchor, replacement, 1)
    applied.append(name)
    print(f"  OK   {name}")
    return new_text


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not MULTICA.exists():
        print(f"FAIL: multica 폴더 없음 — {MULTICA}", file=sys.stderr)
        return 1

    # 0) ko/ 데이터 검증
    missing_json = [fname for _, fname in KO_NAMESPACES if not (KO_DIR / fname).exists()]
    if missing_json:
        print(f"FAIL: ko/ 폴더에 누락 JSON {len(missing_json)}개:", file=sys.stderr)
        for f in missing_json[:5]:
            print(f"  - {f}", file=sys.stderr)
        print("→ translate_locale_ko.py 먼저 돌려야 합니다.", file=sys.stderr)
        return 1
    print(f"✓ ko/ 데이터 검증: {len(KO_NAMESPACES)}개 JSON 모두 존재")
    print()

    applied: list = []
    skipped: list = []
    failed: list  = []

    # F1+F2. types.ts (한 파일에 두 변경 — 누적 적용)
    text = TYPES_TS.read_text(encoding="utf-8") if TYPES_TS.exists() else None
    if text is None:
        print(f"  FAIL F1+F2. types.ts 파일 없음 — {TYPES_TS}")
        failed.append("F1+F2 (파일 없음)")
    else:
        # F1
        f1_marker = '| "ko"'
        f1_anchor = 'export type SupportedLocale = "en" | "zh-Hans";'
        f1_repl   = 'export type SupportedLocale = "en" | "zh-Hans" | "ko";'
        if f1_marker in text:
            print(f"  SKIP F1. SupportedLocale 타입에 ko  (이미 적용됨)")
            skipped.append("F1")
        elif f1_anchor in text:
            text = text.replace(f1_anchor, f1_repl, 1)
            print(f"  OK   F1. SupportedLocale 타입에 ko")
            applied.append("F1")
        else:
            print(f"  FAIL F1. SupportedLocale 앵커 없음")
            failed.append("F1")

        # F2
        f2_marker = '"ko"]'
        f2_anchor = 'SUPPORTED_LOCALES: SupportedLocale[] = ["en", "zh-Hans"];'
        f2_repl   = 'SUPPORTED_LOCALES: SupportedLocale[] = ["en", "zh-Hans", "ko"];'
        if f2_marker in text:
            print(f"  SKIP F2. SUPPORTED_LOCALES 배열에 ko  (이미 적용됨)")
            skipped.append("F2")
        elif f2_anchor in text:
            text = text.replace(f2_anchor, f2_repl, 1)
            print(f"  OK   F2. SUPPORTED_LOCALES 배열에 ko")
            applied.append("F2")
        else:
            print(f"  FAIL F2. SUPPORTED_LOCALES 앵커 없음")
            failed.append("F2")

        if "F1" in applied or "F2" in applied:
            TYPES_TS.write_bytes(text.encode("utf-8"))

    # F3. layout.tsx
    new_text = edit_file(
        LAYOUT_TSX,
        name='F3. HTML_LANG 에 ko: "ko-KR"',
        marker='ko: "ko-KR"',
        anchor='"zh-Hans": "zh-CN",\n};',
        replacement='"zh-Hans": "zh-CN",\n  ko: "ko-KR",\n};',
        applied=applied, skipped=skipped, failed=failed,
    )
    if new_text is not None:
        LAYOUT_TSX.write_bytes(new_text.encode("utf-8"))

    # F4. locales/index.ts — ko import 24개 추가
    ko_imports = build_ko_imports_block()
    new_text = edit_file(
        INDEX_TS,
        name="F4. locales/index.ts 에 ko import 24개",
        marker='import koCommon',
        anchor='import zhHansSquads from "./zh-Hans/squads.json";',
        replacement='import zhHansSquads from "./zh-Hans/squads.json";\n\n' + ko_imports,
        applied=applied, skipped=skipped, failed=failed,
    )
    if new_text is not None:
        INDEX_TS.write_bytes(new_text.encode("utf-8"))

    # F5. locales/index.ts — RESOURCES.ko 객체 추가
    # 앵커: zh-Hans 객체 닫는 `,\n  },\n};` 직전. 정확히는 'squads: zhHansSquads,\n  },\n};'
    ko_resources = build_ko_resources_block()
    new_text = edit_file(
        INDEX_TS,
        name="F5. locales/index.ts 에 RESOURCES.ko",
        marker="  ko: {\n    common: koCommon,",
        anchor="    squads: zhHansSquads,\n  },\n};",
        replacement="    squads: zhHansSquads,\n  },\n" + ko_resources + "\n};",
        applied=applied, skipped=skipped, failed=failed,
    )
    if new_text is not None:
        INDEX_TS.write_bytes(new_text.encode("utf-8"))

    print()
    print(f"결과: 적용 {len(applied)} / 스킵 {len(skipped)} / 실패 {len(failed)}")

    if failed:
        print("\n실패한 변경:")
        for n in failed:
            print(f"  - {n}")
        return 1

    if not applied:
        print("\n변경 없음 (이미 모두 적용됨).")
    else:
        print(f"\n갱신 완료. 도커 재빌드 후 ?lang=ko 또는 워크스페이스 설정에서 한국어 선택.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
