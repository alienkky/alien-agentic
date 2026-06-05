"""FastAPI 진입점 — `POST /memo`, `GET /status`, `POST /replay/{num}`.

펌웨어 → 브릿지 트래픽은 LAN 한정. 인증 = `X-Bridge-Token` 단일 비밀.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse

from .alien_plan import AlienPlanWriter
from .config import Config, load_config
from .daily_digest import DailyDigestScheduler
from .idempotency import IdemStore, make_key
from .logger import JsonlLogger
from .monitor import Monitor
from .multica_cli import MulticaCLI, MulticaError
from .stt import STTError, TranscribeResult, transcribe

log = logging.getLogger(__name__)

MAX_WAV_BYTES = 8 * 1024 * 1024  # 8 MB safety cap (60s WAV 16k mono ≈ 1.9MB)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> datetime:
    # Pala Memo 가 보내는 Z-suffix RFC3339 → datetime.fromisoformat 호환
    s = s.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def create_app(config: Config | None = None) -> FastAPI:
    cfg = config or load_config()
    cfg.require_runtime()
    logging.basicConfig(level=getattr(logging, cfg.log_level, logging.INFO))

    started_at = time.monotonic()
    jsonl = JsonlLogger(cfg.log_dir)
    cli = MulticaCLI(cfg.multica_cli)
    idem = IdemStore(cfg.cache_dir / "idem.sqlite")
    writer = AlienPlanWriter(
        cli,
        state_issue_title=cfg.alien_plan_issue_title,
        cache_dir=cfg.cache_dir,
    )
    monitor = Monitor(
        cli,
        webhook_url=cfg.discord_webhook_alerts,
        stuck_seconds=cfg.monitor_stuck_seconds,
        strike_limit=cfg.monitor_strike_limit,
        parent_issue_id=cfg.alien_plan_parent_issue_id,
        owner_member_id=cfg.mention_owner_member_id,
        owner_agent_id=cfg.mention_owner_agent_id,
    )
    digest = DailyDigestScheduler(
        cli,
        jsonl,
        parent_issue_id=cfg.alien_plan_parent_issue_id,
        hour_kst=cfg.daily_digest_hour_kst,
        min_kst=cfg.daily_digest_min_kst,
        enabled=cfg.daily_digest_enabled,
    )

    app = FastAPI(title="Alien Speech Bridge", version="0.1.0")
    app.state.cfg = cfg
    app.state.idem = idem
    app.state.writer = writer
    app.state.monitor = monitor
    app.state.digest = digest
    app.state.jsonl = jsonl
    app.state.last_memo_at: datetime | None = None

    @app.on_event("startup")
    async def _on_startup() -> None:
        monitor.run_forever()
        digest.run_forever()
        log.info(
            "Alien Speech 브릿지 부팅 — %s:%s (dry_run=%s, stt=%s)",
            cfg.bridge_host, cfg.bridge_port, cfg.dry_run, cfg.stt_mode,
        )

    @app.on_event("shutdown")
    async def _on_shutdown() -> None:
        monitor.shutdown()
        digest.shutdown()

    # ── auth ────────────────────────────────────────────────
    def _check_token(token: str | None) -> None:
        if not token or token != cfg.bridge_token:
            raise HTTPException(status_code=401, detail="invalid_token")

    # ── routes ──────────────────────────────────────────────
    @app.post("/memo")
    async def post_memo(
        request: Request,
        wav: UploadFile = File(...),
        x_bridge_token: str | None = Header(default=None, alias="X-Bridge-Token"),
        x_pala_num: str | None = Header(default=None, alias="X-Pala-Num"),
        x_pala_tag: str | None = Header(default=None, alias="X-Pala-Tag"),
        x_pala_created_utc: str | None = Header(default=None, alias="X-Pala-CreatedUtc"),
        x_pala_device_id: str | None = Header(default=None, alias="X-Pala-DeviceId"),
    ) -> JSONResponse:
        t_start = time.monotonic()
        _check_token(x_bridge_token)

        if not (x_pala_num and x_pala_tag and x_pala_created_utc and x_pala_device_id):
            raise HTTPException(status_code=400, detail="missing_pala_headers")
        try:
            num = int(x_pala_num)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid_num")
        if x_pala_tag not in {"Work", "Idea", "Life"}:
            raise HTTPException(status_code=400, detail="invalid_tag")
        try:
            created_utc = _parse_iso(x_pala_created_utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid_created_utc")

        content_type = (wav.content_type or "").lower()
        if "wav" not in content_type and "octet-stream" not in content_type:
            raise HTTPException(status_code=415, detail="unsupported_media")

        wav_bytes = await wav.read()
        if len(wav_bytes) == 0:
            raise HTTPException(status_code=400, detail="empty_wav")
        if len(wav_bytes) > MAX_WAV_BYTES:
            raise HTTPException(status_code=413, detail="payload_too_large")

        idem_key = make_key(x_pala_device_id, num)
        monitor.start(idem_key, num=num, device_id=x_pala_device_id)
        result_payload: dict[str, Any]
        try:
            if idem.seen(idem_key):
                app.state.last_memo_at = _utcnow()
                monitor.finish_ok(idem_key)
                jsonl.write({
                    "kind": "memo",
                    "status": "duplicate",
                    "num": num,
                    "tag": x_pala_tag,
                    "device_id": x_pala_device_id,
                    "idempotency_key": idem_key,
                })
                return JSONResponse({
                    "status": "ok_duplicate",
                    "idempotency_key": idem_key,
                })

            # STT
            try:
                stt: TranscribeResult = transcribe(wav_bytes, config=cfg)
            except STTError as e:
                raise HTTPException(status_code=502, detail=f"stt_failed: {e}")

            if cfg.dry_run:
                idem.mark(idem_key)
                app.state.last_memo_at = _utcnow()
                monitor.finish_ok(idem_key)
                took_ms = int((time.monotonic() - t_start) * 1000)
                jsonl.write({
                    "kind": "memo",
                    "status": "dry_run",
                    "num": num,
                    "tag": x_pala_tag,
                    "device_id": x_pala_device_id,
                    "idempotency_key": idem_key,
                    "transcript_chars": len(stt.text),
                    "stt_engine": stt.engine,
                    "took_ms": took_ms,
                })
                return JSONResponse({
                    "status": "ok_dry_run",
                    "idempotency_key": idem_key,
                    "transcript": stt.text,
                    "stt_engine": stt.engine,
                    "took_ms": took_ms,
                })

            # Multica append
            try:
                append = writer.append_memo(
                    text=stt.text,
                    created_utc=created_utc,
                    num=num,
                    tag=x_pala_tag,
                    device_id=x_pala_device_id,
                )
            except (RuntimeError, MulticaError) as e:
                raise HTTPException(status_code=502, detail=f"multica_failed: {e}")

            idem.mark(idem_key)
            app.state.last_memo_at = _utcnow()
            monitor.finish_ok(idem_key)
            took_ms = int((time.monotonic() - t_start) * 1000)
            result_payload = {
                "status": "ok" if append.status == "ok" else "ok_duplicate",
                "idempotency_key": idem_key,
                "transcript": stt.text,
                "appended_to": f"logs.{append.date_key}.sweep",
                "issue_id": append.issue_id,
                "took_ms": took_ms,
                "stt_engine": stt.engine,
            }
            jsonl.write({
                "kind": "memo",
                "status": append.status,
                "num": num,
                "tag": x_pala_tag,
                "device_id": x_pala_device_id,
                "idempotency_key": idem_key,
                "transcript_chars": len(stt.text),
                "stt_engine": stt.engine,
                "took_ms": took_ms,
                "issue_id": append.issue_id,
                "date_key": append.date_key,
                "attempts": append.attempts,
            })
            return JSONResponse(result_payload)
        except HTTPException as e:
            monitor.finish_fail(idem_key, error=f"{e.status_code} {e.detail}")
            jsonl.write({
                "kind": "memo",
                "status": "fail",
                "num": num,
                "tag": x_pala_tag,
                "device_id": x_pala_device_id,
                "idempotency_key": idem_key,
                "error": str(e.detail),
                "code": e.status_code,
            })
            raise
        except Exception as e:
            monitor.finish_fail(idem_key, error=str(e))
            jsonl.write({
                "kind": "memo",
                "status": "fail",
                "num": num,
                "tag": x_pala_tag,
                "device_id": x_pala_device_id,
                "idempotency_key": idem_key,
                "error": str(e),
            })
            log.exception("memo 처리 중 예외")
            raise HTTPException(status_code=500, detail="internal_error")

    @app.get("/status")
    def get_status(
        x_bridge_token: str | None = Header(default=None, alias="X-Bridge-Token"),
    ) -> dict[str, Any]:
        _check_token(x_bridge_token)
        snap = monitor.snapshot()
        return {
            "ok": True,
            "version": "0.1.0",
            "uptime_s": int(time.monotonic() - started_at),
            "queue": snap,
            "last_memo_at": app.state.last_memo_at.isoformat()
            if app.state.last_memo_at
            else None,
            "stt": {"engine": cfg.stt_mode},
            "dry_run": cfg.dry_run,
        }

    @app.post("/replay/{num}")
    def post_replay(
        num: int,
        x_bridge_token: str | None = Header(default=None, alias="X-Bridge-Token"),
        x_pala_device_id: str | None = Header(default=None, alias="X-Pala-DeviceId"),
    ) -> dict[str, Any]:
        _check_token(x_bridge_token)
        if not x_pala_device_id:
            raise HTTPException(status_code=400, detail="missing_device_id")
        idem.reset(make_key(x_pala_device_id, num))
        return {"ok": True, "result": "idempotency reset — 다음 /memo 호출 시 재처리"}

    return app


app = None  # populated by `python -m bridge` 진입점에서


def main() -> None:
    import uvicorn

    cfg = load_config()
    application = create_app(cfg)
    uvicorn.run(
        application,
        host=cfg.bridge_host,
        port=cfg.bridge_port,
        log_level=cfg.log_level.lower(),
    )


if __name__ == "__main__":
    main()
