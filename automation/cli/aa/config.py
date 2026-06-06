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
    return Path("E:/AlienAgentic/alien-agentic")


ROOT = _find_root()
AGENTS_DIR = ROOT / ".claude" / "agents"
SHARED_MEMORY = ROOT / "shared-memory"
DAILY_LOGS = SHARED_MEMORY / "daily-logs"
MESSAGES = SHARED_MEMORY / "messages"
INTERVENTIONS = SHARED_MEMORY / "interventions"
TASKS = SHARED_MEMORY / "tasks"
DASHBOARD = SHARED_MEMORY / "dashboard.md"
AGENT_MEMORY = SHARED_MEMORY / "agents"
USAGE_DIR = SHARED_MEMORY / "usage"
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

# Claude 모델 — Claude CLI `--model` 에 그대로 전달되는 명시적 ID.
# 기본값은 최신 4.X 라인. `.env` 에 박아 두면 신모델 출시 시 한 줄로 갱신된다.
# Claude CLI 는 alias("opus"/"sonnet") 도 받지만, 여기선 버전을 분명히 박아
# "어느 모델로 돌렸는지" 가 usage 로그에 그대로 남도록 한다.
CLAUDE_OPUS_MODEL = os.environ.get("CLAUDE_OPUS_MODEL", "claude-opus-4-8")
CLAUDE_SONNET_MODEL = os.environ.get("CLAUDE_SONNET_MODEL", "claude-sonnet-4-6")
CLAUDE_HAIKU_MODEL = os.environ.get("CLAUDE_HAIKU_MODEL", "claude-haiku-4-5")

# ComfyUI — 4090 로컬 GPU 경유. 무-API-키, 이미지·동영상 둘 다.
COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://localhost:8188")
COMFYUI_WORKFLOWS_DIR = ROOT / "automation" / "cli" / "aa" / "comfyui_workflows"
COMFYUI_OUTPUT_TIMEOUT = int(os.environ.get("COMFYUI_OUTPUT_TIMEOUT", "600"))

# Ollama — 4090 로컬 GPU 의 오픈 LLM 게이트웨이.
# 무-API-키. `ollama serve` 가 떠 있으면 설치된 모든 오픈 모델(llama3.1, qwen2.5,
# deepseek-r1, mixtral 등)을 그대로 골라 쓸 수 있다.
# 모델 목록은 `aa models` 로 실시간 조회.
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_DEFAULT_MODEL = os.environ.get("OLLAMA_DEFAULT_MODEL", "llama3.1:8b")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "300"))
