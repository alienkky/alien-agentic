"""SessionStart 브리핑 — 세션 시작 시 최근 daily-log + 대시보드를 컨텍스트로 주입.

읽기 전용. 어떤 경우에도 세션 시작을 막지 않는다 (모든 예외 무시).
settings.json 의 hooks.SessionStart 에서 호출.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    try:
        # scripts → alien-config → intranet → automation → repo
        root = Path(__file__).resolve().parents[4]
        out: list[str] = []

        logs = root / "shared-memory" / "daily-logs"
        files = sorted(logs.glob("2*.md")) if logs.exists() else []
        if files:
            latest = files[-1]
            body = latest.read_text(encoding="utf-8", errors="replace")
            out.append(f"## 🛸 최근 daily-log — {latest.stem}\n\n{body[:1500]}")

        dash = root / "shared-memory" / "dashboard.md"
        if dash.exists():
            d = dash.read_text(encoding="utf-8", errors="replace").strip()
            if d:
                out.append(f"\n## 대시보드\n\n{d[:600]}")

        if out:
            print("\n".join(out))
    except Exception:
        # SessionStart hook 은 절대 세션을 막지 않는다
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
