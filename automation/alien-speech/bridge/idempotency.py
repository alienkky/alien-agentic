"""SQLite 중복 처리 방지 저장소 — 키 = `pala-<deviceId>-<num>` (Phase 1c 잠정)."""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path


def make_key(device_id: str, num: int | str) -> str:
    return f"pala-{device_id}-{num}"


class IdemStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init(self) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS processed ("
                "key TEXT PRIMARY KEY, at TEXT NOT NULL"
                ")"
            )

    def seen(self, key: str) -> bool:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM processed WHERE key = ?", (key,)
            ).fetchone()
            return row is not None

    def mark(self, key: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO processed (key, at) VALUES (?, ?)",
                (key, now),
            )

    def reset(self, key: str) -> None:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM processed WHERE key = ?", (key,))
