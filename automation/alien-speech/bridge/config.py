"""환경 변수 → 타입 안전한 Config 객체."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
PKG_ROOT = HERE.parent  # automation/alien-speech/


def _bool(v: str | None, default: bool = False) -> bool:
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _int(v: str | None, default: int) -> int:
    try:
        return int(v) if v is not None and v.strip() != "" else default
    except ValueError:
        return default


def _path(v: str | None, default: Path) -> Path:
    if v is None or v.strip() == "":
        return default
    return Path(v).expanduser().resolve()


@dataclass(frozen=True)
class Config:
    bridge_token: str
    bridge_host: str
    bridge_port: int
    log_level: str

    stt_mode: str
    openai_api_key: str
    whisper_model: str
    whisper_language: str
    whisper_local_model: str
    whisper_local_device: str
    whisper_local_compute_type: str

    multica_workspace_id: str
    alien_plan_issue_title: str
    multica_cli: str
    alien_plan_parent_issue_id: str

    discord_webhook_alerts: str
    monitor_stuck_seconds: int
    monitor_strike_limit: int
    mention_owner_member_id: str
    mention_owner_agent_id: str
    daily_digest_hour_kst: int
    daily_digest_min_kst: int
    daily_digest_enabled: bool

    data_dir: Path
    log_dir: Path
    cache_dir: Path
    dry_run: bool = False
    _required_for_run: tuple[str, ...] = field(default=("bridge_token", "multica_workspace_id"))

    def require_runtime(self) -> None:
        """배포 시 *반드시* 채워져 있어야 하는 값 검증. dry-run 은 면제."""
        if self.dry_run:
            return
        missing: list[str] = []
        for name in self._required_for_run:
            if not getattr(self, name):
                missing.append(name.upper())
        if self.stt_mode == "openai-api" and not self.openai_api_key:
            missing.append("OPENAI_API_KEY (STT_MODE=openai-api)")
        if missing:
            raise RuntimeError(
                "다음 환경 변수가 비어있습니다: " + ", ".join(missing)
            )


def load_config(env_file: Path | None = None) -> Config:
    if env_file is not None and env_file.exists():
        load_dotenv(env_file, override=True)
    else:
        # 기본 위치: automation/alien-speech/.env
        default = PKG_ROOT / ".env"
        if default.exists():
            load_dotenv(default, override=False)

    data_dir = _path(os.environ.get("DATA_DIR"), PKG_ROOT)
    log_dir = _path(os.environ.get("LOG_DIR"), data_dir / "logs")
    cache_dir = _path(os.environ.get("CACHE_DIR"), data_dir / ".cache")
    log_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    return Config(
        bridge_token=os.environ.get("BRIDGE_TOKEN", "").strip(),
        bridge_host=os.environ.get("BRIDGE_HOST", "0.0.0.0"),
        bridge_port=_int(os.environ.get("BRIDGE_PORT"), 8788),
        log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        stt_mode=os.environ.get("STT_MODE", "openai-api").strip(),
        openai_api_key=os.environ.get("OPENAI_API_KEY", "").strip(),
        whisper_model=os.environ.get("WHISPER_MODEL", "whisper-1"),
        whisper_language=os.environ.get("WHISPER_LANGUAGE", "ko"),
        whisper_local_model=os.environ.get("WHISPER_LOCAL_MODEL", "large-v3"),
        whisper_local_device=os.environ.get("WHISPER_LOCAL_DEVICE", "cuda"),
        whisper_local_compute_type=os.environ.get("WHISPER_LOCAL_COMPUTE_TYPE", "float16"),
        multica_workspace_id=os.environ.get("MULTICA_WORKSPACE_ID", "").strip(),
        alien_plan_issue_title=os.environ.get(
            "ALIEN_PLAN_ISSUE_TITLE",
            "🛸 Alien Plan 저장소 (자동 — 수정·삭제 금지)",
        ),
        multica_cli=os.environ.get("MULTICA_CLI", "multica"),
        alien_plan_parent_issue_id=os.environ.get("ALIEN_PLAN_PARENT_ISSUE_ID", "").strip(),
        discord_webhook_alerts=os.environ.get("DISCORD_WEBHOOK_ALERTS", "").strip(),
        monitor_stuck_seconds=_int(os.environ.get("MONITOR_STUCK_SECONDS"), 300),
        monitor_strike_limit=_int(os.environ.get("MONITOR_STRIKE_LIMIT"), 3),
        mention_owner_member_id=os.environ.get(
            "MENTION_OWNER_MEMBER_ID", "3bf03b6e-fdb3-46bb-a7a9-da4ef9d316ab"
        ),
        mention_owner_agent_id=os.environ.get(
            "MENTION_OWNER_AGENT_ID", "cd966ed7-63ff-40af-b082-b957cbd3c917"
        ),
        daily_digest_hour_kst=_int(os.environ.get("DAILY_DIGEST_HOUR_KST"), 17),
        daily_digest_min_kst=_int(os.environ.get("DAILY_DIGEST_MIN_KST"), 45),
        daily_digest_enabled=_bool(os.environ.get("DAILY_DIGEST_ENABLED"), True),
        data_dir=data_dir,
        log_dir=log_dir,
        cache_dir=cache_dir,
        dry_run=_bool(os.environ.get("ALIEN_SPEECH_DRY_RUN"), False),
    )
