"""경로·상수 — Alien Agentic 프로젝트 구조의 자리."""

from __future__ import annotations

import os
from pathlib import Path


def _find_root() -> Path:
    """CLAUDE.md + .claude/agents/ 가 있는 자리를 프로젝트 루트로."""
    env = os.environ.get("AA_ROOT")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "CLAUDE.md").exists() and (parent / ".claude" / "agents").exists():
            return parent
    return Path("C:/Alien Agentic")


ROOT = _find_root()
AGENTS_DIR = ROOT / ".claude" / "agents"
SHARED_MEMORY = ROOT / "shared-memory"
DAILY_LOGS = SHARED_MEMORY / "daily-logs"
MESSAGES = SHARED_MEMORY / "messages"
INTERVENTIONS = SHARED_MEMORY / "interventions"
TASKS = SHARED_MEMORY / "tasks"
DASHBOARD = SHARED_MEMORY / "dashboard.md"
AGENT_MEMORY = SHARED_MEMORY / "agents"
ENV_FILE = ROOT / "automation" / "cli" / ".env"

# 호칭·회사명 — 헌법 응답 규칙 1번
USER_NAME = "기영님"
COMPANY = "Alien Agentic"

# Anthropic 모델 별칭 → API 모델 ID
MODEL_MAP = {
    "opus": "claude-opus-4-5",
    "sonnet": "claude-sonnet-4-5",
    "haiku": "claude-haiku-4-5",
}
