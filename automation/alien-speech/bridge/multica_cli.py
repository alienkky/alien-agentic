"""`multica` CLI subprocess 래퍼 — JSON 출력 강제."""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class MulticaError(RuntimeError):
    pass


class MulticaCLI:
    def __init__(self, exe: str = "multica", *, default_timeout: float = 60.0) -> None:
        self.exe = exe
        self.default_timeout = default_timeout

    def _run(self, args: list[str], *, timeout: float | None = None) -> str:
        cmd = [self.exe, *args]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout or self.default_timeout,
                check=False,
            )
        except FileNotFoundError as e:
            raise MulticaError(f"multica CLI 실행 불가: {e}") from e
        except subprocess.TimeoutExpired as e:
            raise MulticaError(f"multica timeout ({cmd[:3]})") from e
        if proc.returncode != 0:
            raise MulticaError(
                f"multica failed ({proc.returncode}): "
                f"{(proc.stderr or proc.stdout or '').strip()[:500]}"
            )
        return proc.stdout

    # ── high-level ──────────────────────────────────────────────
    def issue_get(self, issue_id: str) -> dict[str, Any]:
        out = self._run(["issue", "get", issue_id, "--output", "json"])
        return json.loads(out)

    def issue_search(self, query: str, *, limit: int = 20, include_closed: bool = True) -> list[dict[str, Any]]:
        args = ["issue", "search", query, "--output", "json", "--limit", str(limit)]
        if include_closed:
            args.append("--include-closed")
        out = self._run(args)
        data = json.loads(out) if out.strip() else []
        return data if isinstance(data, list) else []

    def issue_create(
        self,
        *,
        title: str,
        description: str,
        status: str = "todo",
        priority: str | None = None,
    ) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", suffix=".md", delete=False
        ) as tf:
            tf.write(description)
            tf_path = Path(tf.name)
        try:
            args = [
                "issue",
                "create",
                "--title",
                title,
                "--description-file",
                str(tf_path),
                "--status",
                status,
                "--output",
                "json",
            ]
            if priority:
                args += ["--priority", priority]
            out = self._run(args)
            return json.loads(out)
        finally:
            tf_path.unlink(missing_ok=True)

    def issue_update_description(self, issue_id: str, description: str) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", suffix=".md", delete=False
        ) as tf:
            tf.write(description)
            tf_path = Path(tf.name)
        try:
            args = [
                "issue",
                "update",
                issue_id,
                "--description-file",
                str(tf_path),
                "--output",
                "json",
            ]
            out = self._run(args)
            return json.loads(out)
        finally:
            tf_path.unlink(missing_ok=True)

    def issue_comment_add(
        self,
        issue_id: str,
        content: str,
        *,
        parent: str | None = None,
    ) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", suffix=".md", delete=False
        ) as tf:
            tf.write(content)
            tf_path = Path(tf.name)
        try:
            args = [
                "issue",
                "comment",
                "add",
                issue_id,
                "--content-file",
                str(tf_path),
                "--output",
                "json",
            ]
            if parent:
                args += ["--parent", parent]
            out = self._run(args)
            return json.loads(out) if out.strip() else {}
        finally:
            tf_path.unlink(missing_ok=True)
