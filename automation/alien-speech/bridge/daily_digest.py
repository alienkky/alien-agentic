"""일일 17:45 KST 1줄 요약 — ALI-88 에 코멘트.

운영 첫 1주만 ON. 18:00 이후는 가족 시간 보호 (CLAUDE.md §9) — 17:45 이후
스케줄러는 *오늘은 그만*.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from .logger import JsonlLogger
from .multica_cli import MulticaCLI, MulticaError

log = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")


def summarize_day(events: list[dict]) -> dict:
    """단일 day jsonl 의 메모 처리 집계."""
    total = 0
    failed = 0
    dur_ms: list[int] = []
    by_tag: Counter[str] = Counter()
    duplicate = 0
    for e in events:
        if e.get("kind") != "memo":
            continue
        total += 1
        status = e.get("status")
        if status == "fail":
            failed += 1
        elif status == "duplicate":
            duplicate += 1
        if isinstance(e.get("took_ms"), (int, float)):
            dur_ms.append(int(e["took_ms"]))
        tag = e.get("tag")
        if tag:
            by_tag[tag] += 1
    avg = round(sum(dur_ms) / len(dur_ms) / 1000.0, 1) if dur_ms else 0.0
    return {
        "total": total,
        "failed": failed,
        "duplicate": duplicate,
        "avg_seconds": avg,
        "by_tag": dict(by_tag),
    }


def render_comment(summary: dict, date_str: str) -> str:
    if summary["total"] == 0:
        return f"🛸 Alien Speech {date_str} — 처리된 메모 0건."
    tag_part = " · ".join(f"{k}:{v}" for k, v in summary["by_tag"].items()) if summary["by_tag"] else "-"
    return (
        f"🛸 Alien Speech {date_str} — 총 {summary['total']}건 · "
        f"실패 {summary['failed']} · 중복 {summary['duplicate']} · "
        f"평균 처리 {summary['avg_seconds']}초 · 태그({tag_part})"
    )


class DailyDigestScheduler:
    def __init__(
        self,
        cli: MulticaCLI,
        jsonl: JsonlLogger,
        *,
        parent_issue_id: str,
        hour_kst: int,
        min_kst: int,
        enabled: bool,
    ) -> None:
        self.cli = cli
        self.jsonl = jsonl
        self.parent_issue_id = parent_issue_id
        self.hour_kst = hour_kst
        self.min_kst = min_kst
        self.enabled = enabled
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_run_day: str | None = None

    def _next_fire(self, now: datetime) -> datetime:
        target = now.astimezone(KST).replace(
            hour=self.hour_kst, minute=self.min_kst, second=0, microsecond=0
        )
        if target <= now.astimezone(KST):
            target = target + timedelta(days=1)
        return target

    def post_digest(self, for_date_kst: str) -> bool:
        if not self.enabled or not self.parent_issue_id:
            return False
        events = self.jsonl.read_day(for_date_kst)
        summary = summarize_day(events)
        comment = render_comment(summary, for_date_kst)
        try:
            self.cli.issue_comment_add(self.parent_issue_id, comment)
            return True
        except MulticaError as e:
            log.warning("daily digest 코멘트 실패: %s", e)
            return False

    def _loop(self) -> None:
        while not self._stop.is_set():
            now = datetime.now(KST)
            target = self._next_fire(now)
            wait_s = max(1.0, (target - now).total_seconds())
            if self._stop.wait(timeout=wait_s):
                return
            day_str = datetime.now(KST).strftime("%Y-%m-%d")
            if day_str == self._last_run_day:
                continue
            self._last_run_day = day_str
            self.post_digest(day_str)

    def run_forever(self) -> None:
        if not self.enabled:
            log.info("daily digest 비활성 — 스케줄러 건너뜀")
            return
        if self._thread is not None:
            return
        self._thread = threading.Thread(
            target=self._loop, name="alien-speech-digest", daemon=True
        )
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)


def main() -> None:
    """CLI 진입점 — Task Scheduler 가 일 1회 호출하는 모드."""
    import argparse

    from .config import load_config

    parser = argparse.ArgumentParser(description="Alien Speech 일일 다이제스트")
    parser.add_argument("--date", help="KST YYYY-MM-DD (기본: 오늘)", default=None)
    args = parser.parse_args()

    cfg = load_config()
    jsonl = JsonlLogger(cfg.log_dir)
    cli = MulticaCLI(cfg.multica_cli)
    sched = DailyDigestScheduler(
        cli,
        jsonl,
        parent_issue_id=cfg.alien_plan_parent_issue_id,
        hour_kst=cfg.daily_digest_hour_kst,
        min_kst=cfg.daily_digest_min_kst,
        enabled=True,  # CLI 진입은 항상 한 번 발사
    )
    day_str = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    ok = sched.post_digest(day_str)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
