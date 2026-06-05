"""테스트 공통 fixture."""

from __future__ import annotations

import sys
from pathlib import Path

# `bridge` 패키지를 패스에 추가 (pytest 가 automation/alien-speech 에서 호출돼야 잡힘)
PKG_ROOT = Path(__file__).resolve().parent.parent
if str(PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(PKG_ROOT))


import pytest

from bridge.config import Config


@pytest.fixture
def tmp_config(tmp_path) -> Config:
    return Config(
        bridge_token="testtoken",
        bridge_host="127.0.0.1",
        bridge_port=8788,
        log_level="INFO",
        stt_mode="openai-api",
        openai_api_key="sk-test",
        whisper_model="whisper-1",
        whisper_language="ko",
        whisper_local_model="large-v3",
        whisper_local_device="cpu",
        whisper_local_compute_type="int8",
        multica_workspace_id="ws-test",
        alien_plan_issue_title="🛸 Alien Plan 저장소 (자동 — 수정·삭제 금지)",
        multica_cli="multica",
        alien_plan_parent_issue_id="parent-test",
        discord_webhook_alerts="",
        monitor_stuck_seconds=300,
        monitor_strike_limit=3,
        mention_owner_member_id="member-1",
        mention_owner_agent_id="agent-1",
        daily_digest_hour_kst=17,
        daily_digest_min_kst=45,
        daily_digest_enabled=False,
        data_dir=tmp_path,
        log_dir=tmp_path / "logs",
        cache_dir=tmp_path / "cache",
        dry_run=True,
    )
