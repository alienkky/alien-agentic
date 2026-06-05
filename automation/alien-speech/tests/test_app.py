"""dry-run 통합 테스트 — 외부 호출 mock."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from bridge.app import create_app
from bridge.stt import TranscribeResult


@pytest.fixture
def client(tmp_config):
    with patch("bridge.app.transcribe") as stt_mock:
        stt_mock.return_value = TranscribeResult(text="가짜 전사", engine="mock")
        app = create_app(tmp_config)
        yield TestClient(app)


def _headers(token: str = "testtoken") -> dict:
    return {
        "X-Bridge-Token": token,
        "X-Pala-Num": "42",
        "X-Pala-Tag": "Idea",
        "X-Pala-CreatedUtc": "2026-06-05T08:24:11Z",
        "X-Pala-DeviceId": "pala-memo-01",
    }


def _wav() -> dict:
    return {"wav": ("memo.wav", b"RIFFfake", "audio/wav")}


def test_status_requires_token(client):
    r = client.get("/status")
    assert r.status_code == 401


def test_status_ok(client):
    r = client.get("/status", headers={"X-Bridge-Token": "testtoken"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["dry_run"] is True


def test_memo_dry_run_returns_transcript(client):
    r = client.post("/memo", headers=_headers(), files=_wav())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok_dry_run"
    assert body["transcript"] == "가짜 전사"
    assert body["idempotency_key"] == "pala-pala-memo-01-42"


def test_memo_invalid_token(client):
    r = client.post("/memo", headers=_headers(token="wrong"), files=_wav())
    assert r.status_code == 401


def test_memo_invalid_tag(client):
    h = _headers()
    h["X-Pala-Tag"] = "Spam"
    r = client.post("/memo", headers=h, files=_wav())
    assert r.status_code == 400


def test_memo_duplicate_marks_ok(client):
    r1 = client.post("/memo", headers=_headers(), files=_wav())
    assert r1.status_code == 200
    r2 = client.post("/memo", headers=_headers(), files=_wav())
    assert r2.status_code == 200
    assert r2.json()["status"] == "ok_duplicate"


def test_replay_resets_idem(client):
    client.post("/memo", headers=_headers(), files=_wav())
    r = client.post(
        "/replay/42",
        headers={"X-Bridge-Token": "testtoken", "X-Pala-DeviceId": "pala-memo-01"},
    )
    assert r.status_code == 200
    # 다음 /memo 는 다시 처리되어야 함
    r2 = client.post("/memo", headers=_headers(), files=_wav())
    assert r2.json()["status"] == "ok_dry_run"
