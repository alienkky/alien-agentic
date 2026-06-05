"""JSONL 일일 로거 — `logs/YYYY-MM-DD.jsonl` 1줄 = 1 이벤트."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class JsonlLogger:
    """파일 핸들을 매 write 마다 열고 닫는 단순 구현 — 일자 경계 안전."""

    def __init__(self, log_dir: Path) -> None:
        self.log_dir = log_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path_for(self, ts: datetime) -> Path:
        return self.log_dir / f"{ts.strftime('%Y-%m-%d')}.jsonl"

    def write(self, event: dict[str, Any]) -> None:
        ts = datetime.now(timezone.utc)
        line = {"ts": ts.isoformat(), **event}
        path = self._path_for(ts)
        with self._lock:
            with path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(line, ensure_ascii=False) + "\n")

    def read_day(self, date_str: str) -> list[dict[str, Any]]:
        """daily_digest 용 — `YYYY-MM-DD` 의 모든 이벤트 반환."""
        path = self.log_dir / f"{date_str}.jsonl"
        if not path.exists():
            return []
        out: list[dict[str, Any]] = []
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return out
