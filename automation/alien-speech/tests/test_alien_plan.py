from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from bridge.alien_plan import (
    AlienPlanWriter,
    format_memo_block,
    has_marker,
    kst_date_key,
)
from bridge.multica_cli import MulticaError


def test_kst_date_key():
    # 2026-06-05T14:30Z = 2026-06-05T23:30 KST
    assert kst_date_key(datetime(2026, 6, 5, 14, 30, tzinfo=timezone.utc)) == "2026-06-05"
    # 2026-06-05T15:30Z = 2026-06-06T00:30 KST → 날짜 넘어감
    assert kst_date_key(datetime(2026, 6, 5, 15, 30, tzinfo=timezone.utc)) == "2026-06-06"


def test_format_memo_block_contains_marker():
    block = format_memo_block(
        created_utc=datetime(2026, 6, 5, 0, 24, 11, tzinfo=timezone.utc),
        num=42,
        tag="Work",
        text="  메모 본문  ",
        device_id="pala-memo-01",
    )
    assert "[09:24 KST · pala #42 · Work · pala-memo-01]" in block
    assert "메모 본문" in block
    assert not block.endswith(" ")


def test_has_marker_distinguishes_device():
    sweep = "[09:24 KST · pala #42 · Work · pala-memo-01]\n원문"
    assert has_marker(sweep, 42, "pala-memo-01")
    assert not has_marker(sweep, 42, "pala-memo-02")
    assert not has_marker(sweep, 43, "pala-memo-01")


def test_append_memo_creates_and_appends(tmp_path):
    cli = MagicMock()
    cli.issue_search.return_value = []  # 없음 → create
    cli.issue_create.return_value = {"id": "state-1"}
    cli.issue_get.return_value = {"id": "state-1", "description": json.dumps({"logs": {}, "tasks": []})}
    captured: dict = {}

    def fake_update(issue_id, desc):
        captured["id"] = issue_id
        captured["desc"] = desc
        return {"id": issue_id}

    cli.issue_update_description.side_effect = fake_update

    writer = AlienPlanWriter(cli, state_issue_title="title", cache_dir=tmp_path)
    res = writer.append_memo(
        text="첫 메모",
        created_utc=datetime(2026, 6, 5, 0, 24, 11, tzinfo=timezone.utc),
        num=1,
        tag="Idea",
        device_id="pala-memo-01",
    )
    assert res.status == "ok"
    assert res.issue_id == "state-1"
    assert res.date_key == "2026-06-05"
    state = json.loads(captured["desc"])
    sweep = state["logs"]["2026-06-05"]["sweep"]
    assert "pala #1" in sweep
    assert "Idea" in sweep
    assert "첫 메모" in sweep


def test_append_memo_duplicate_via_marker(tmp_path):
    cli = MagicMock()
    cli.issue_search.return_value = [{"id": "state-1", "title": "title"}]
    existing_state = {
        "logs": {
            "2026-06-05": {
                "sweep": "[09:24 KST · pala #1 · Idea · pala-memo-01]\n이전",
                "theOne": {"text": "", "done": False},
                "tinyMove": {"text": "", "done": False},
            }
        },
        "tasks": [],
    }
    cli.issue_get.return_value = {"id": "state-1", "description": json.dumps(existing_state)}

    writer = AlienPlanWriter(cli, state_issue_title="title", cache_dir=tmp_path)
    res = writer.append_memo(
        text="다시",
        created_utc=datetime(2026, 6, 5, 0, 24, 11, tzinfo=timezone.utc),
        num=1,
        tag="Idea",
        device_id="pala-memo-01",
    )
    assert res.status == "duplicate"
    cli.issue_update_description.assert_not_called()


def test_append_memo_retries_then_fails(tmp_path):
    cli = MagicMock()
    cli.issue_search.return_value = [{"id": "state-1", "title": "title"}]
    cli.issue_get.return_value = {"id": "state-1", "description": json.dumps({"logs": {}, "tasks": []})}
    cli.issue_update_description.side_effect = MulticaError("network down")

    writer = AlienPlanWriter(cli, state_issue_title="title", cache_dir=tmp_path, max_retries=3)
    with pytest.raises(RuntimeError, match="3회"):
        writer.append_memo(
            text="x",
            created_utc=datetime(2026, 6, 5, 0, 24, 11, tzinfo=timezone.utc),
            num=2,
            tag="Work",
            device_id="dev-x",
        )
    assert cli.issue_update_description.call_count == 3
