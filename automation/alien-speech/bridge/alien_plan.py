"""Alien Plan 저장 이슈 find-or-create + JSON 머지 update.

상태 이슈 description = `{"logs": {dateKey: {sweep, theOne, tinyMove}}, "tasks": [...]}`.
Pala Memo 메모는 `logs[KST_today].sweep` 끝에 prefix 헤더 한 줄 + 본문 append.

낙관적 lock: 3회 재시도. multica CLI 는 ETag 미지원이라 *읽기 직후 쓰기* 윈도우만
보호. UI 의 1.5s debounce 와 겹치는 < 1초 윈도우에서만 last-write-wins 가능 →
3회 backoff(0.3/0.6/0.9s) 로 거의 모두 회수.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .multica_cli import MulticaCLI, MulticaError

log = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")
EMPTY_DAY_LOG = {
    "sweep": "",
    "theOne": {"text": "", "done": False},
    "tinyMove": {"text": "", "done": False},
}


def _empty_state() -> dict[str, Any]:
    return {"logs": {}, "tasks": []}


def _empty_day() -> dict[str, Any]:
    # JSON-safe deep copy of EMPTY_DAY_LOG
    return json.loads(json.dumps(EMPTY_DAY_LOG))


def kst_date_key(created_utc: datetime) -> str:
    """`YYYY-MM-DD` (KST 변환). alien-plan-page.tsx `dateKey()` 와 동일 포맷."""
    return created_utc.astimezone(KST).strftime("%Y-%m-%d")


def kst_hhmm(created_utc: datetime) -> str:
    return created_utc.astimezone(KST).strftime("%H:%M")


def format_memo_block(
    *,
    created_utc: datetime,
    num: int | str,
    tag: str,
    text: str,
    device_id: str,
) -> str:
    """sweep 에 append 할 한 덩어리. idempotency marker 가 prefix 에 박힘."""
    header = f"[{kst_hhmm(created_utc)} KST · pala #{num} · {tag} · {device_id}]"
    return f"{header}\n{text.strip()}"


def has_marker(sweep: str, num: int | str, device_id: str) -> bool:
    marker = f"pala #{num} · "
    # device_id 까지 같이 확인해서 다른 기기 동일 num 충돌 회피
    return marker in sweep and device_id in sweep


@dataclass
class AppendResult:
    status: str  # ok | duplicate
    issue_id: str
    date_key: str
    attempts: int


class AlienPlanWriter:
    def __init__(
        self,
        cli: MulticaCLI,
        *,
        state_issue_title: str,
        cache_dir: Path,
        max_retries: int = 3,
    ) -> None:
        self.cli = cli
        self.state_issue_title = state_issue_title
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries
        self._state_id_cache = cache_dir / "state_issue_id.txt"

    # ── 저장 이슈 식별 ─────────────────────────────────────
    def _read_cached_id(self) -> str | None:
        if not self._state_id_cache.exists():
            return None
        v = self._state_id_cache.read_text(encoding="utf-8").strip()
        return v or None

    def _write_cached_id(self, issue_id: str) -> None:
        self._state_id_cache.write_text(issue_id, encoding="utf-8")

    def get_state_issue_id(self) -> str:
        cached = self._read_cached_id()
        if cached:
            try:
                self.cli.issue_get(cached)
                return cached
            except MulticaError:
                log.warning("캐시된 state 이슈 %s 조회 실패 — 재탐색", cached)

        # find by title
        results = self.cli.issue_search(self.state_issue_title, limit=50, include_closed=True)
        match = next(
            (i for i in results if i.get("title") == self.state_issue_title),
            None,
        )
        if match:
            self._write_cached_id(match["id"])
            return match["id"]

        # create
        log.info("Alien Plan 저장 이슈 신규 생성")
        created = self.cli.issue_create(
            title=self.state_issue_title,
            description=json.dumps(_empty_state(), ensure_ascii=False),
            status="todo",
        )
        self._write_cached_id(created["id"])
        return created["id"]

    # ── append ─────────────────────────────────────────────
    def _parse_state(self, raw: str | None) -> dict[str, Any]:
        if not raw or not raw.strip():
            return _empty_state()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            log.warning("저장 이슈 description JSON 파싱 실패 — 빈 state 로 대체")
            return _empty_state()
        if not isinstance(data, dict):
            return _empty_state()
        data.setdefault("logs", {})
        data.setdefault("tasks", [])
        return data

    def append_memo(
        self,
        *,
        text: str,
        created_utc: datetime,
        num: int | str,
        tag: str,
        device_id: str,
    ) -> AppendResult:
        if created_utc.tzinfo is None:
            created_utc = created_utc.replace(tzinfo=timezone.utc)
        date_key = kst_date_key(created_utc)
        memo_block = format_memo_block(
            created_utc=created_utc,
            num=num,
            tag=tag,
            text=text,
            device_id=device_id,
        )

        issue_id = self.get_state_issue_id()
        last_err: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                issue = self.cli.issue_get(issue_id)
                state = self._parse_state(issue.get("description"))
                day = state["logs"].setdefault(date_key, _empty_day())
                if has_marker(day.get("sweep", ""), num, device_id):
                    return AppendResult("duplicate", issue_id, date_key, attempt + 1)
                existing = day.get("sweep", "") or ""
                joined = (existing + "\n\n" + memo_block).lstrip()
                day["sweep"] = joined
                new_desc = json.dumps(state, ensure_ascii=False)
                self.cli.issue_update_description(issue_id, new_desc)
                return AppendResult("ok", issue_id, date_key, attempt + 1)
            except MulticaError as e:
                last_err = e
                time.sleep(0.3 * (attempt + 1))
        raise RuntimeError(f"alien-plan append 3회 실패: {last_err}")
