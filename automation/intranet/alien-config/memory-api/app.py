"""
Alien Agentic -- Memory API
=============================

호스트의 shared-memory/agents/ 디렉토리를 RESTful 로 노출.
27명 외계 에이전트 각자의 4파일(work/learnings/decisions/mistakes.md)을
Multica UI 에서 읽고 편집할 수 있게 한다.

엔드포인트:
    GET  /health                          -- 헬스체크 + 마운트 진단
    GET  /agents                          -- 27명 목록 + 각 파일 메타
    GET  /agents/{name}/{file}            -- 파일 내용 (raw markdown)
    PUT  /agents/{name}/{file}            -- 파일 저장 (JSON body: {"content": "..."})

보안 모델:
    - 컨테이너는 127.0.0.1:8765 에 LAN-only bind (docker-compose ports)
    - Caddy 가 /api/alien-memory/* 를 여기로 라우팅 (Tailscale tailnet 만 도달)
    - 자체 인증 없음 -- Tailscale + Caddy 경계가 인증 게이트
    - path traversal / 화이트리스트로 파일 보호

"왜 4파일만?" -- 헌법 §6 의 shared-memory/agents/<name>/{work,learnings,decisions,mistakes}.md
규약이 27명 모두에게 통일. 다른 파일을 노출할 이유 없음.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("MEMORY_DATA_DIR", "/data/agents")).resolve()

# 헌법 §6 의 4파일 규약 -- 이게 전부. 다른 이름은 거부.
ALLOWED_FILES = ("work.md", "learnings.md", "decisions.md", "mistakes.md")

# 파일 1개 최대 크기 (4 MB) -- 메모리 폭주 방지
MAX_FILE_BYTES = 4 * 1024 * 1024


# ---------------------------------------------------------------------------
# 검증 헬퍼
# ---------------------------------------------------------------------------
def _safe_agent_dir(name: str) -> Path:
    """agent 디렉토리 경로를 안전하게 해석. path traversal 차단."""
    # 빈 이름 / 숨김 / 슬래시 / 상위 참조 모두 거부
    if not name or name.startswith(".") or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail=f"invalid agent name: {name!r}")
    candidate = (DATA_DIR / name).resolve()
    # DATA_DIR 밖으로 빠져나가는 경로 차단 (resolve 후 한 번 더)
    try:
        candidate.relative_to(DATA_DIR)
    except ValueError:
        raise HTTPException(status_code=400, detail="path escapes data dir")
    return candidate


def _safe_file_path(agent: str, file: str) -> Path:
    """4파일 화이트리스트 + agent 디렉토리 결합."""
    if file not in ALLOWED_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"file must be one of {list(ALLOWED_FILES)}",
        )
    return _safe_agent_dir(agent) / file


def _file_meta(path: Path) -> dict:
    """파일 메타 -- 존재하지 않으면 size/modified 0."""
    if not path.exists():
        return {"name": path.name, "exists": False, "size": 0, "modified": 0}
    stat = path.stat()
    return {
        "name": path.name,
        "exists": True,
        "size": stat.st_size,
        "modified": stat.st_mtime,
    }


# ---------------------------------------------------------------------------
# 요청 모델
# ---------------------------------------------------------------------------
class WriteRequest(BaseModel):
    content: str = Field(..., description="파일에 저장할 markdown 본문")


# ---------------------------------------------------------------------------
# FastAPI 앱
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Alien Agentic -- Memory API",
    version="0.1.0",
    description=(
        "27명 외계 에이전트 메모리 4파일(work/learnings/decisions/mistakes.md) "
        "을 Multica UI 에서 읽고 편집하기 위한 sidecar API."
    ),
)


@app.get("/health")
def health() -> dict:
    """마운트 + 데이터 디렉토리 가용성 진단."""
    return {
        "ok": True,
        "data_dir": str(DATA_DIR),
        "data_dir_exists": DATA_DIR.is_dir(),
        "allowed_files": list(ALLOWED_FILES),
        "max_file_bytes": MAX_FILE_BYTES,
        "ts": time.time(),
    }


@app.get("/agents")
def list_agents() -> dict:
    """27명 디렉토리 + 각 파일 메타. 미존재 파일은 exists=false 로 포함."""
    if not DATA_DIR.is_dir():
        raise HTTPException(
            status_code=500,
            detail=(
                f"DATA_DIR {DATA_DIR} not found -- docker volume mount 확인 "
                "(shared-memory/agents/ 가 /data/agents 에 마운트되어야 함)"
            ),
        )

    agents = []
    for agent_dir in sorted(DATA_DIR.iterdir()):
        if not agent_dir.is_dir() or agent_dir.name.startswith("."):
            continue
        files = [_file_meta(agent_dir / fname) for fname in ALLOWED_FILES]
        agents.append({"name": agent_dir.name, "files": files})

    return {"count": len(agents), "agents": agents}


@app.get("/agents/{name}/{file}", response_class=PlainTextResponse)
def read_file(name: str, file: str) -> str:
    """파일 내용 (raw markdown). 없으면 빈 문자열 (신규 작성용)."""
    path = _safe_file_path(name, file)
    if not path.exists():
        return ""
    if path.stat().st_size > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large (> {MAX_FILE_BYTES} bytes) -- 직접 편집 권장",
        )
    return path.read_text(encoding="utf-8")


@app.put("/agents/{name}/{file}")
def write_file(name: str, file: str, payload: WriteRequest) -> dict:
    """파일 저장. 디렉토리 없으면 생성."""
    path = _safe_file_path(name, file)

    encoded = payload.content.encode("utf-8")
    if len(encoded) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"content too large (> {MAX_FILE_BYTES} bytes)",
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload.content, encoding="utf-8")

    return {"ok": True, **_file_meta(path)}
