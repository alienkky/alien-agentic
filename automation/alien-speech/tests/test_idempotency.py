from __future__ import annotations

from bridge.idempotency import IdemStore, make_key


def test_make_key():
    assert make_key("pala-memo-01", 42) == "pala-pala-memo-01-42"
    assert make_key("dev-a", "007") == "pala-dev-a-007"


def test_store_roundtrip(tmp_path):
    store = IdemStore(tmp_path / "idem.sqlite")
    key = make_key("dev", 1)
    assert store.seen(key) is False
    store.mark(key)
    assert store.seen(key) is True
    store.mark(key)  # idempotent
    assert store.seen(key) is True
    store.reset(key)
    assert store.seen(key) is False
