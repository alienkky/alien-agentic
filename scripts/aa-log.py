#!/usr/bin/env python3
"""aa-log.py — OpenViking 폴더 log.md append (ALI-105 / S6).

`git log -- <folder>` 의 최근 N 개 커밋을 폴더 `log.md` 끝에 append. 중복 방지.
스펙: `shared-memory/context/index-log-spec.md` (event vocabulary).

사용:
  scripts/aa-log.py shared-memory/context
  scripts/aa-log.py --all --limit 50
  scripts/aa-log.py shared-memory/context --since 2026-06-01
  scripts/aa-log.py shared-memory/context --append-event index_regenerated \\
                    --actor automation-coder --detail "21 entries, 0 unknown"

`--append-event` 가 있으면 그 한 줄을 append (예: S6 후 index_regenerated 기록).
없으면 `git log` 기반 append/update/move/delete 이벤트를 자동으로 적는다.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9), name="KST")

# Lazy import to avoid a hard dependency: aa-index 의 classify_path 를 재사용.
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from importlib.util import spec_from_file_location, module_from_spec

    _spec = spec_from_file_location("_aa_index", Path(__file__).resolve().parent / "aa-index.py")
    if _spec is None or _spec.loader is None:
        raise ImportError("cannot load aa-index.py")
    _aai = module_from_spec(_spec)
    sys.modules["_aa_index"] = _aai  # dataclass 가 cls.__module__ 로 lookup
    _spec.loader.exec_module(_aai)
    classify_path = _aai.classify_path  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    def classify_path(rel_path: str) -> str:  # pragma: no cover
        return "?"


# ── 헤더 + 한 줄 포맷 ──────────────────────────────────────────────────
HEADER_LINES = [
    "| Time | Event | Actor | Path | Layer | Detail |",
    "|---|---|---|---|---|---|",
]
VALID_EVENTS = {
    "append", "update", "move", "delete_proposed",
    "classify", "classify:unknown", "classify:conflict",
    "redact", "index_regenerated",
}


@dataclass
class LogRow:
    time: str
    event: str
    actor: str
    path: str
    layer: str
    detail: str

    def to_line(self) -> str:
        return (
            f"| {self.time} | {self.event} | {self.actor} "
            f"| {self.path} | {self.layer} | {_escape(self.detail)} |"
        )

    def key(self) -> tuple[str, str, str, str]:
        # 동일 (time, event, path, detail) 은 한 번만 기록.
        return (self.time, self.event, self.path, self.detail.strip())


def _escape(s: str) -> str:
    s = s.replace("\n", " ").replace("|", "\\|").strip()
    if len(s) > 180:
        s = s[:177] + "…"
    return s


# ── 기존 log.md 파싱 ──────────────────────────────────────────────────
ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|"
                    r"\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*$")


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _existing_keys(log_path: Path) -> set[tuple[str, str, str, str]]:
    keys: set[tuple[str, str, str, str]] = set()
    for line in _read(log_path).splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        time, event, _actor, path, _layer, detail = (g.strip() for g in m.groups())
        if event in {"Event", "---"}:
            continue
        keys.add((time, event, path, detail.replace("\\|", "|")))
    return keys


def _ensure_header(log_path: Path, folder_name: str) -> None:
    if log_path.exists() and "| Time | Event |" in _read(log_path):
        return
    header = [
        f"# Log: {folder_name}",
        "",
        "Append-only OpenViking folder log. Newest entries at bottom.",
        "",
        *HEADER_LINES,
        "",
    ]
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("\n".join(header), encoding="utf-8")


# ── git log → 이벤트 행 ─────────────────────────────────────────────────
def _git(*args: str) -> str:
    res = subprocess.run(
        ["git", *args], cwd=str(ROOT),
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 실패: {res.stderr.strip()}")
    return res.stdout


def _git_events_for(folder: Path, limit: int, since: str | None) -> list[LogRow]:
    """git log <folder> 의 최근 commit 별 (event, path) 행을 만든다.

    한 커밋의 여러 파일은 줄을 나눈다 — 정확성·검색성 우선.
    """
    rel = folder.relative_to(ROOT).as_posix()
    args = ["log", f"-n{limit}", "--name-status",
            "--date=iso-strict", "--pretty=format:%H%x1f%an%x1f%cI%x1f%s"]
    if since:
        args.append(f"--since={since}")
    args += ["--", rel]
    try:
        out = _git(*args)
    except RuntimeError as e:
        sys.stderr.write(f"⚠ {rel}: {e}\n")
        return []

    rows: list[LogRow] = []
    cur_commit: tuple[str, str, str, str] | None = None
    for line in out.splitlines():
        if "\x1f" in line:
            parts = line.split("\x1f")
            if len(parts) >= 4:
                cur_commit = (parts[0], parts[1], parts[2], parts[3])
            continue
        if not line.strip() or cur_commit is None:
            continue
        cols = line.split("\t")
        if len(cols) < 2:
            continue
        status_raw = cols[0].strip()
        status = status_raw[:1]
        path = cols[-1].replace("\\", "/")
        # rename: A<from>\tB<to>
        from_path = cols[1].replace("\\", "/") if status == "R" and len(cols) >= 3 else None
        event = {
            "A": "append",
            "M": "update",
            "D": "delete_proposed",
            "R": "move",
            "C": "append",
            "T": "update",
        }.get(status, "update")
        layer = classify_path(path)
        sha, author, cdate, subject = cur_commit
        sha7 = sha[:7]
        detail = f"{sha7} \"{subject}\""
        if event == "move" and from_path:
            detail = f"{sha7} {from_path} -> {path}"
        rows.append(LogRow(
            time=cdate, event=event, actor=author,
            path=path, layer=layer, detail=detail,
        ))
    return rows


# ── --append-event 한 줄 ────────────────────────────────────────────────
def _now_kst() -> str:
    return datetime.now(tz=KST).replace(microsecond=0).isoformat()


def _explicit_row(
    folder: Path, event: str, actor: str, detail: str,
    path: str | None, layer: str | None,
) -> LogRow:
    folder_rel = folder.relative_to(ROOT).as_posix()
    p = path or folder_rel
    return LogRow(
        time=_now_kst(), event=event, actor=actor or "automation",
        path=p, layer=layer or classify_path(p), detail=detail,
    )


# ── append loop ────────────────────────────────────────────────────────
def append_for(folder: Path, *, limit: int, since: str | None, dry_run: bool,
               explicit: LogRow | None) -> int:
    if not folder.exists() or not folder.is_dir():
        sys.stderr.write(f"⚠ skip — 폴더 없음: {folder}\n")
        return 0
    log_path = folder / "log.md"
    _ensure_header(log_path, folder.name or folder.relative_to(ROOT).as_posix())
    keys = _existing_keys(log_path)

    rows: list[LogRow] = []
    if explicit is not None:
        rows.append(explicit)
    else:
        rows.extend(_git_events_for(folder, limit=limit, since=since))

    new_lines: list[str] = []
    appended = 0
    for r in rows:
        if r.key() in keys:
            continue
        keys.add(r.key())
        new_lines.append(r.to_line())
        appended += 1

    if not new_lines:
        return 0
    if dry_run:
        sys.stdout.write(f"=== DRY-RUN {log_path.relative_to(ROOT).as_posix()} ===\n")
        for ln in new_lines:
            sys.stdout.write(ln + "\n")
        return appended

    body = _read(log_path)
    if not body.endswith("\n"):
        body += "\n"
    body += "\n".join(new_lines) + "\n"
    log_path.write_text(body, encoding="utf-8")
    sys.stdout.write(f"📝 {log_path.relative_to(ROOT).as_posix()} (+{appended})\n")
    return appended


# ── --all 후보 폴더 (aa-index.INDEX_TARGETS 와 일치) ────────────────────
LOG_TARGETS = [
    "shared-memory/context",
    "shared-memory/context/clients",
    "shared-memory/context/agents",
    "shared-memory/context/daily-logs",
    "shared-memory/context/insights",
    "shared-memory/context/tasks",
    "shared-memory/members",
    "shared-memory/agents",          # legacy
    "shared-memory/clients",         # legacy
    "shared-memory/tasks",           # legacy
    "shared-memory/_private",
]


def _existing_targets() -> list[Path]:
    out: list[Path] = []
    for rel in LOG_TARGETS:
        p = ROOT / rel
        if p.exists() and p.is_dir():
            out.append(p)
    for parent_rel in ("shared-memory/context/clients", "shared-memory/clients",
                       "shared-memory/context/agents", "shared-memory/agents",
                       "shared-memory/members"):
        p = ROOT / parent_rel
        if p.exists():
            for child in p.iterdir():
                if child.is_dir() and child not in out:
                    out.append(child)
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="aa-log — append git events to folder log.md")
    p.add_argument("folders", nargs="*")
    p.add_argument("--all", action="store_true")
    p.add_argument("--limit", type=int, default=30)
    p.add_argument("--since", default=None, help="git --since (예: 2026-06-01)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--append-event", default=None,
                   help=f"명시 이벤트 한 줄 (택: {sorted(VALID_EVENTS)})")
    p.add_argument("--actor", default="automation",
                   help="명시 이벤트의 actor (기본: automation)")
    p.add_argument("--detail", default="",
                   help="명시 이벤트의 detail (한 줄)")
    p.add_argument("--path", default=None,
                   help="명시 이벤트의 path (생략 시 폴더 경로)")
    p.add_argument("--layer", default=None, help="명시 이벤트의 layer")
    args = p.parse_args(argv)

    if args.append_event and args.append_event not in VALID_EVENTS:
        sys.stderr.write(
            f"❌ --append-event 값이 사양 밖: {args.append_event}\n"
            f"   허용: {sorted(VALID_EVENTS)}\n"
        )
        return 2

    targets: list[Path] = []
    if args.all:
        targets += _existing_targets()
    for f in args.folders:
        path = Path(f)
        if not path.is_absolute():
            path = (ROOT / f).resolve()
        targets.append(path)
    if not targets:
        sys.stderr.write("대상 폴더 없음. 폴더 인자나 --all 을 지정.\n")
        return 1

    total = 0
    for folder in targets:
        explicit = None
        if args.append_event:
            explicit = _explicit_row(
                folder, args.append_event, args.actor,
                args.detail, args.path, args.layer,
            )
        total += append_for(
            folder, limit=args.limit, since=args.since,
            dry_run=args.dry_run, explicit=explicit,
        )
    sys.stdout.write(f"\n— log append: {total} new rows.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
