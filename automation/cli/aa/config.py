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

def _find_claude_bin() -> Path | None:
    """Claude Code CLI 바이너리 자동 감지 — Max 구독 토큰 경유."""
    from shutil import which

    env = os.environ.get("CLAUDE_BIN")
    if env and Path(env).exists():
        return Path(env)

    in_path = which("claude")
    if in_path:
        return Path(in_path)

    home = Path.home()
    candidates = [
        home / ".local" / "bin" / "claude.exe",
        home / ".local" / "bin" / "claude",
        home / "AppData" / "Local" / "Programs" / "Claude" / "claude.exe",
        Path("C:/Program Files/Claude/claude.exe"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


CLAUDE_BIN = _find_claude_bin()


def _find_codex_bin() -> Path | None:
    """OpenAI Codex CLI 바이너리 자동 감지 — ChatGPT Pro 구독 사용량 경유."""
    from shutil import which

    env = os.environ.get("CODEX_BIN")
    if env and Path(env).exists():
        return Path(env)

    in_path = which("codex")
    if in_path:
        return Path(in_path)

    home = Path.home()
    candidates = [
        home / ".local" / "bin" / "codex.exe",
        home / ".local" / "bin" / "codex",
        home / "AppData" / "Roaming" / "npm" / "codex.cmd",
        home / "AppData" / "Roaming" / "npm" / "codex",
        Path("C:/Program Files/nodejs/codex.cmd"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


CODEX_BIN = _find_codex_bin()

# ChatGPT(Codex) 모델 — 비우면 Codex CLI 의 계정 기본 모델을 그대로 사용.
# 모델명이 바뀌어도 깨지지 않도록 기본값은 빈 문자열.
CODEX_MODEL = os.environ.get("CODEX_MODEL", "")
