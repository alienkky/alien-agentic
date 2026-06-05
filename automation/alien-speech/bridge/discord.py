"""Discord webhook 어댑터 — `docs/guides/discord-webhook.md` #alerts 채널."""

from __future__ import annotations

import logging

import requests

log = logging.getLogger(__name__)


def post(webhook_url: str, content: str, *, timeout: float = 5.0) -> bool:
    """짧은 메시지 push. 실패해도 예외 X — 호출측이 best-effort 로 다룸."""
    if not webhook_url:
        return False
    try:
        resp = requests.post(
            webhook_url,
            json={"content": content[:1990]},
            timeout=timeout,
        )
        if resp.status_code >= 400:
            log.warning("discord webhook %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except requests.RequestException as e:
        log.warning("discord webhook 호출 실패: %s", e)
        return False
