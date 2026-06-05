from __future__ import annotations

from bridge.daily_digest import render_comment, summarize_day


def test_summarize_day_counts():
    events = [
        {"kind": "memo", "status": "ok", "took_ms": 1200, "tag": "Work"},
        {"kind": "memo", "status": "ok", "took_ms": 800, "tag": "Idea"},
        {"kind": "memo", "status": "fail", "tag": "Life"},
        {"kind": "memo", "status": "duplicate", "tag": "Work"},
        {"kind": "noise"},
    ]
    s = summarize_day(events)
    assert s["total"] == 4
    assert s["failed"] == 1
    assert s["duplicate"] == 1
    assert s["avg_seconds"] == 1.0
    assert s["by_tag"] == {"Work": 2, "Idea": 1, "Life": 1}


def test_render_comment_zero():
    assert "0건" in render_comment(summarize_day([]), "2026-06-05")


def test_render_comment_full():
    events = [{"kind": "memo", "status": "ok", "took_ms": 2000, "tag": "Work"}]
    c = render_comment(summarize_day(events), "2026-06-05")
    assert "총 1건" in c
    assert "평균 처리 2.0초" in c
    assert "Work:1" in c
