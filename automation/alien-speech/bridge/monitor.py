"""처리 지연·연속 실패 감지 → Discord + Multica 코멘트 mention.

규칙(기영님 결정 2026-06-05):
- *5분 초과* 처리 못한 메모 = 1차 알림 (Discord #alerts)
- *3회 연속 실패* = 2차 알림 (Discord + Multica 코멘트로 @기영님 + @공도율 mention)
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import discord
from .multica_cli import MulticaCLI, MulticaError

log = logging.getLogger(__name__)


@dataclass
class InflightMemo:
    key: str
    started_at: float  # monotonic
    num: int | str
    device_id: str
    alerted: bool = False


@dataclass
class StrikeCounter:
    count: int = 0
    last_failure_at: float = 0.0


class Monitor:
    """thread-safe 인플라이트 + 실패 카운터."""

    def __init__(
        self,
        cli: MulticaCLI,
        *,
        webhook_url: str,
        stuck_seconds: int,
        strike_limit: int,
        parent_issue_id: str,
        owner_member_id: str,
        owner_agent_id: str,
    ) -> None:
        self.cli = cli
        self.webhook_url = webhook_url
        self.stuck_seconds = stuck_seconds
        self.strike_limit = strike_limit
        self.parent_issue_id = parent_issue_id
        self.owner_member_id = owner_member_id
        self.owner_agent_id = owner_agent_id

        self._lock = threading.Lock()
        self._inflight: dict[str, InflightMemo] = {}
        self._strikes = StrikeCounter()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ── 인플라이트 추적 ────────────────────────────────────
    def start(self, key: str, *, num: int | str, device_id: str) -> None:
        with self._lock:
            self._inflight[key] = InflightMemo(
                key=key, started_at=time.monotonic(), num=num, device_id=device_id
            )

    def finish_ok(self, key: str) -> None:
        with self._lock:
            self._inflight.pop(key, None)
            self._strikes = StrikeCounter()  # 성공 = 연속 실패 reset

    def finish_fail(self, key: str, *, error: str) -> None:
        with self._lock:
            self._inflight.pop(key, None)
            self._strikes.count += 1
            self._strikes.last_failure_at = time.monotonic()
            strike_count = self._strikes.count
            should_escalate = strike_count >= self.strike_limit
        # Discord 1차 알림
        discord.post(
            self.webhook_url,
            f"🛸 Alien Speech 실패 #{strike_count} — `{key}` — {error[:300]}",
        )
        if should_escalate:
            self._escalate(strike_count=strike_count, error=error)

    # ── escalation ─────────────────────────────────────────
    def _escalate(self, *, strike_count: int, error: str) -> None:
        msg = (
            f"🚨 Alien Speech: 연속 실패 {strike_count}회. "
            f"마지막 에러 — {error[:300]}"
        )
        discord.post(self.webhook_url, msg)

        if not self.parent_issue_id:
            return
        body = (
            "## 🚨 Alien Speech 브릿지 자동 알림\n\n"
            f"연속 실패 **{strike_count}회** 발생. 브릿지 상태 점검 필요.\n\n"
            f"- 마지막 에러: `{error[:500]}`\n"
            f"- 시각: {datetime.now(timezone.utc).isoformat()}\n\n"
            f"[@기영님](mention://member/{self.owner_member_id}) "
            f"[@공도율](mention://agent/{self.owner_agent_id}) 확인 부탁드립니다."
        )
        try:
            self.cli.issue_comment_add(self.parent_issue_id, body)
        except MulticaError as e:
            log.warning("escalation 코멘트 실패: %s", e)

    # ── 백그라운드 sweep ───────────────────────────────────
    def _sweep(self) -> None:
        while not self._stop.is_set():
            now = time.monotonic()
            stuck: list[InflightMemo] = []
            with self._lock:
                for memo in self._inflight.values():
                    if memo.alerted:
                        continue
                    if now - memo.started_at >= self.stuck_seconds:
                        memo.alerted = True
                        stuck.append(memo)
            for memo in stuck:
                discord.post(
                    self.webhook_url,
                    f"⏱ Alien Speech: 메모 `{memo.key}` 처리 {self.stuck_seconds}s 초과 중.",
                )
            self._stop.wait(15.0)

    def run_forever(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._sweep, name="alien-speech-monitor", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)

    # ── snapshot ───────────────────────────────────────────
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "pending": len(self._inflight),
                "consecutive_failures": self._strikes.count,
            }
