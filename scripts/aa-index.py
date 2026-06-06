#!/usr/bin/env python3
"""aa-index.py — OpenViking 폴더 index.md 자동 생성기 (ALI-105 / S6).

폴더 인자를 받아 그 폴더의 모든 .md 를 스캔, 메타(타이틀·태그·수정일·OpenViking 계층)
를 추출해 `index.md` 를 재생성한다. 사양은 `shared-memory/context/index-log-spec.md`.

전제:
  - ALI-101 (`shared-memory/context/openviking-mapping.md`) 도착 시 거기서 룰을 흡수.
  - 미도착이면 `DEFAULT_LAYER_RULES` 로 임시 휴리스틱.
  - std lib only — CI 의존성 0.

사용:
  scripts/aa-index.py shared-memory/context
  scripts/aa-index.py shared-memory/context --recursive
  scripts/aa-index.py --all                   # 모든 후보 폴더 일괄
  scripts/aa-index.py --dry-run shared-memory/context
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9), name="KST")

# ── OpenViking 매핑 (ALI-101 스펙) ──────────────────────────────────────
# 분류 순서: 명시 private/evidence → executable agent/skill → curated shared/member
# → legacy compatibility → unclassified.
DEFAULT_LAYER_RULES: list[tuple[re.Pattern[str], str]] = [
    # L0 — Evidence / private
    (re.compile(r"^shared-memory/_private(?:/|$)"), "L0"),
    (re.compile(r"^shared-memory/context/clients/[^/]+/raw(?:/|$)"), "L0"),
    (re.compile(
        r"^shared-memory/context/clients/[^/]+/"
        r"(?:evidence|source|sources|transcripts|attachments/originals)(?:/|$)"
    ), "L0"),
    (re.compile(r"^shared-memory/context/daily-logs/raw(?:/|$)"), "L0"),
    # L2 — Executable skill/memory (먼저 매칭)
    (re.compile(
        r"^shared-memory/context/agents/[^/]+/(?:work|learnings|decisions|mistakes|README)\.md$"
    ), "L2"),
    (re.compile(r"^shared-memory/members/[^/]+/agents/[^/]+(?:/|$)"), "L2"),
    (re.compile(r"^\.claude/agents/[^/]+\.md$"), "L2"),
    (re.compile(r"^\.codex(?:/|$)"), "L2"),
    # L1 — Curated shared/member
    (re.compile(r"^shared-memory/context/clients/[^/]+(?:/|$)"), "L1"),
    (re.compile(
        r"^shared-memory/context/(?:"
        r"dashboard\.md|"
        r"daily-logs/[^/]+\.md|"
        r"insights(?:/|$)|usage(?:/|$)|messages(?:/|$)|tasks(?:/|$)|interventions(?:/|$)|"
        r"README\.md"
        r")"
    ), "L1"),
    (re.compile(r"^shared-memory/members/[^/]+/notes(?:/|$)"), "L1"),
    # Legacy compatibility (S1 마이그레이션 완료 전)
    (re.compile(r"^shared-memory/agents(?:/|$)"), "L2"),
    (re.compile(r"^shared-memory/clients/[^/]+/raw(?:/|$)"), "L0"),
    (re.compile(r"^shared-memory/clients(?:/|$)"), "L1"),
    (re.compile(r"^shared-memory/(?:daily-logs|insights|usage|messages|tasks|interventions)(?:/|$)"), "L1"),
    (re.compile(r"^shared-memory/dashboard\.md$"), "L1"),
    # 새 path 의 context root (이 폴더 자체 README 등)
    (re.compile(r"^shared-memory/context(?:/|$)"), "L1"),
    (re.compile(r"^shared-memory/members(?:/|$)"), "L1"),
    # 최후 폴백 — shared-memory 안이지만 위 어떤 룰도 안 맞으면 L1 (curated)
    (re.compile(r"^shared-memory/"), "L1"),
]


def classify_path(rel_path: str) -> str:
    """OpenViking 분류. 첫 매칭 룰이 승."""
    rel = rel_path.replace("\\", "/")
    for pat, layer in DEFAULT_LAYER_RULES:
        if pat.search(rel):
            return layer
    return "unclassified"


# ── Front matter 파싱 (yaml 없이 안전 파서) ──────────────────────────
FM_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
TAG_RE = re.compile(r"(?<![A-Za-z0-9_])#([A-Za-z0-9가-힣_/-]+)")
FRONT_LIST_PATHS = ("source_paths", "derived_from", "related", "hands_off_to")
RELATION_KEYS = (
    "derived_from", "summarizes", "decides", "implements", "hands_off_to", "related",
)


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _parse_front_matter(text: str) -> dict[str, object]:
    """간이 YAML 파서 — 평면 key:value 와 `-` 리스트만 지원.

    중첩 dict / 복잡 YAML 은 지원 X. front matter 가 그 정도면 본문에서 따로 추출.
    """
    m = FM_RE.match(text)
    if not m:
        return {}
    out: dict[str, object] = {}
    current_key: str | None = None
    current_list: list[str] | None = None
    for raw in m.group(1).splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if current_list is not None and line.startswith(("  - ", "- ")):
            current_list.append(line.split("-", 1)[1].strip().strip("\"'"))
            continue
        if ":" in line and not line.startswith((" ", "\t")):
            k, _, v = line.partition(":")
            key = k.strip()
            val = v.strip()
            if val == "" or val == "|" or val == ">":
                current_key = key
                current_list = []
                out[key] = current_list
                continue
            if val.startswith("[") and val.endswith("]"):
                out[key] = [
                    x.strip().strip("\"'") for x in val[1:-1].split(",") if x.strip()
                ]
            else:
                out[key] = val.strip("\"'")
            current_list = None
            current_key = None
    # empty list 인 채로 끝난 키는 제거하지 않음 (의도된 빈 리스트)
    return out


@dataclass
class Entry:
    path: str          # relative to index root
    abs_path: Path
    layer: str
    type: str
    updated: str       # ISO date
    summary: str
    tags: list[str] = field(default_factory=list)
    fm: dict[str, object] = field(default_factory=dict)
    front_layer: str | None = None


@dataclass
class LinkEdge:
    src: str
    relation: str
    dst: str


# ── git mtime ────────────────────────────────────────────────────────────
def _git_mtime(rel_path: str) -> str | None:
    """git log 의 가장 최근 commit date (ISO). git 실패 시 None."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", rel_path],
            cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8",
            errors="replace", check=False,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (FileNotFoundError, OSError):
        return None
    return None


def _fs_mtime(p: Path) -> str:
    try:
        return datetime.fromtimestamp(p.stat().st_mtime, tz=KST).date().isoformat()
    except OSError:
        return "?"


# ── Type heuristic ───────────────────────────────────────────────────────
def _infer_type(rel: str, fm: dict[str, object]) -> str:
    if isinstance(fm.get("type"), str):
        return str(fm["type"])
    low = rel.lower()
    if "/raw/" in low or low.endswith("/raw.md") or "/raw/" in low:
        return "raw"
    if low.endswith("dashboard.md"):
        return "dashboard"
    if low.endswith("readme.md"):
        return "readme"
    if low.endswith("decisions.md"):
        return "decision"
    if low.endswith(("work.md", "learnings.md", "mistakes.md")):
        return "memory"
    if "diagnosis" in low or "4layer" in low:
        return "diagnosis"
    if "workflow" in low:
        return "workflow"
    if "prompt" in low or "/agents/" in low:
        return "prompt"
    if "/tasks/" in low or low.split("/")[-1].startswith("t-"):
        return "task"
    if "/daily-logs/" in low:
        return "log"
    return "note"


def _infer_summary(text: str, fm: dict[str, object]) -> str:
    s = fm.get("summary") or fm.get("title")
    if isinstance(s, str) and s.strip():
        return s.strip()[:120]
    # body 첫 H1 직후 본문 한 줄
    body = FM_RE.sub("", text, count=1)
    h1 = H1_RE.search(body)
    if h1:
        # h1 다음 비공백 한 줄
        after = body[h1.end():].splitlines()
        for ln in after:
            t = ln.strip()
            if t and not t.startswith("#"):
                return t[:120]
        return h1.group(1).strip()[:120]
    # 본문 첫 비공백 한 줄
    for ln in body.splitlines():
        t = ln.strip()
        if t:
            return t[:120]
    return ""


def _infer_tags(text: str, fm: dict[str, object]) -> list[str]:
    tags: list[str] = []
    raw = fm.get("tags")
    if isinstance(raw, list):
        tags.extend(str(t) for t in raw)
    elif isinstance(raw, str):
        tags.extend(t.strip() for t in raw.split(",") if t.strip())
    # 본문 #tag (코드 블록 안 제외)
    body = FM_RE.sub("", text, count=1)
    body = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    body = re.sub(r"`[^`\n]*`", "", body)
    for m in TAG_RE.finditer(body):
        tags.append(m.group(1))
    # uniq + 안정 순서
    seen = set()
    out: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:12]


# ── Folder walk ──────────────────────────────────────────────────────────
SKIP_DIR_NAMES = {".git", "node_modules", "__pycache__", ".venv", "venv"}
SKIP_FILE_NAMES = {"index.md", "log.md"}


def _walk_md(folder: Path, recursive: bool) -> Iterable[Path]:
    if recursive:
        for p in folder.rglob("*.md"):
            if any(part in SKIP_DIR_NAMES for part in p.parts):
                continue
            if p.name in SKIP_FILE_NAMES:
                continue
            yield p
    else:
        for p in sorted(folder.iterdir()):
            if p.is_file() and p.suffix.lower() == ".md" and p.name not in SKIP_FILE_NAMES:
                yield p


# ── Entry build ──────────────────────────────────────────────────────────
def build_entry(folder: Path, p: Path) -> Entry:
    rel_root = p.relative_to(folder).as_posix()
    rel_repo = p.relative_to(ROOT).as_posix()
    layer = classify_path(rel_repo)
    text = _read_text(p)
    fm = _parse_front_matter(text)
    updated = _git_mtime(rel_repo) or _fs_mtime(p)
    summary = _infer_summary(text, fm)
    typ = _infer_type(rel_repo, fm)
    tags = _infer_tags(text, fm)
    front_layer = fm.get("openviking_layer") if isinstance(fm.get("openviking_layer"), str) else None
    return Entry(
        path=rel_root,
        abs_path=p,
        layer=layer,
        type=typ,
        updated=updated,
        summary=summary,
        tags=tags,
        fm=fm,
        front_layer=front_layer,
    )


def collect_link_graph(folder: Path, entries: list[Entry]) -> list[LinkEdge]:
    """엔트리들의 front matter / 본문 링크에서 관계 그래프 빌드."""
    edges: list[LinkEdge] = []

    def _add(src: str, relation: str, dst: str) -> None:
        edges.append(LinkEdge(src=src, relation=relation, dst=dst))

    folder_rel = folder.relative_to(ROOT).as_posix()

    for e in entries:
        # front matter 관계
        for key in RELATION_KEYS:
            vals = e.fm.get(key)
            if isinstance(vals, list):
                for v in vals:
                    if isinstance(v, str) and v.strip():
                        _add(e.path, key, str(v).strip())
            elif isinstance(vals, str) and vals.strip():
                _add(e.path, key, vals.strip())
        # 본문 wiki / markdown 링크 → related
        text = _read_text(e.abs_path)
        body = re.sub(r"```.*?```", "", FM_RE.sub("", text, count=1), flags=re.DOTALL)
        body = re.sub(r"`[^`\n]*`", "", body)
        for m in WIKILINK_RE.finditer(body):
            _add(e.path, "related_to", m.group(1).strip())
        for m in LINK_RE.finditer(body):
            target = m.group(2).split("#")[0].strip()
            if not target or target.startswith(
                ("http://", "https://", "mailto:", "mention://", "#")
            ):
                continue
            # 같은 폴더 내부 링크만 그래프에 노출 (외부 자유 링크는 노이즈)
            if target.startswith("/") or ".." in target:
                continue
            _add(e.path, "related_to", target)
    # dedupe
    seen = set()
    out: list[LinkEdge] = []
    for ed in edges:
        key = (ed.src, ed.relation, ed.dst)
        if key in seen:
            continue
        seen.add(key)
        out.append(ed)
    return out


# ── Rendering ────────────────────────────────────────────────────────────
def render_index(folder: Path, entries: list[Entry], edges: list[LinkEdge],
                 unknown_count: int, owner: str, default_layer: str,
                 redact: bool) -> str:
    rel = folder.relative_to(ROOT).as_posix()
    now = datetime.now(tz=KST).replace(microsecond=0).isoformat()
    name = folder.name or rel
    lines: list[str] = []
    lines.append("---")
    lines.append("index_version: 1")
    lines.append(f"generated_at: {now}")
    lines.append(f"root: {rel}")
    lines.append(f"default_layer: {default_layer}")
    lines.append(f"owner: {owner}")
    lines.append("source: auto")
    lines.append("---")
    lines.append("")
    lines.append(f"# Index: {name}")
    lines.append("")

    # Scope
    lines.append("## Scope")
    lines.append(f"- Layer: {default_layer}")
    lines.append(f"- Owner: {owner}")
    lines.append(f"- Contains: {_scope_contains(default_layer)}")
    lines.append(f"- Do not include: {_scope_exclude(default_layer)}")
    lines.append("")

    # Entry Points
    lines.append("## Entry Points")
    lines.append("| Path | Layer | Type | Updated | Summary |")
    lines.append("|---|---|---|---|---|")
    for e in sorted(entries, key=lambda x: (x.layer, x.path)):
        summary = e.summary if not (redact and e.layer == "L0") else "[redacted L0 entry]"
        summary = _escape_pipe(summary)
        lines.append(
            f"| {e.path} | {e.layer} | {e.type} | {e.updated} | {summary} |"
        )
    if not entries:
        lines.append("| (none) | | | | |")
    lines.append("")

    # Link Graph
    lines.append("## Link Graph")
    lines.append("| From | Relation | To |")
    lines.append("|---|---|---|")
    if edges:
        for ed in edges[:200]:
            lines.append(f"| {ed.src} | {ed.relation} | {_escape_pipe(ed.dst)} |")
        if len(edges) > 200:
            lines.append(f"| … | … | (생략 {len(edges) - 200} 건) |")
    else:
        lines.append("| (none) | | |")
    lines.append("")

    # Open Questions — 본문에서 자동 발견 어려움. 빈 표 보존, 인간 채움.
    lines.append("## Open Questions")
    lines.append("| ID | Question | Owner | Created |")
    lines.append("|---|---|---|---|")
    lines.append("")

    # Automation Notes
    lines.append("## Automation Notes")
    lines.append(f"- Last classifier run: {now}")
    lines.append(f"- Unknown files: {unknown_count}")
    conflicts = [e for e in entries if e.front_layer and e.front_layer != e.layer]
    if conflicts:
        lines.append(f"- Front matter / path layer conflicts: {len(conflicts)}")
        for c in conflicts[:10]:
            lines.append(
                f"  - `{c.path}` — front={c.front_layer} path={c.layer}"
            )
    lines.append("")
    lines.append("---")
    lines.append("*generated by `scripts/aa-index.py` — ALI-105*")
    return "\n".join(lines)


def _scope_contains(layer: str) -> str:
    return {
        "L0": "evidence / sealed source material",
        "L1": "curated shared knowledge and decisions",
        "L2": "executable agent memory and skills",
    }.get(layer, "mixed")


def _scope_exclude(layer: str) -> str:
    return {
        "L0": "summaries (those live in L1)",
        "L1": "raw transcripts; sealed private notes",
        "L2": "client-confidential bodies; raw evidence",
    }.get(layer, "off-scope artifacts")


def _escape_pipe(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ").strip()


# ── Folder defaults (owner / default_layer) ─────────────────────────────
def _owner_for(folder: Path) -> str:
    rel = folder.relative_to(ROOT).as_posix()
    parts = rel.split("/")
    if len(parts) >= 3 and parts[0] == "shared-memory" and parts[1] == "context" and parts[2] == "agents":
        return parts[3] if len(parts) > 3 else "agents"
    if len(parts) >= 3 and parts[0] == "shared-memory" and parts[1] == "members":
        return parts[2]
    if rel.startswith("shared-memory/agents/"):
        return parts[2] if len(parts) > 2 else "agents"
    if rel.startswith("shared-memory/context/clients/"):
        return "client-concierge"
    if rel.startswith("shared-memory/context"):
        return "data-strategist"
    if rel.startswith("shared-memory/tasks") or rel.startswith("shared-memory/context/tasks"):
        return "workflow-engineer"
    return "automation-coder"


def _default_layer_for(folder: Path) -> str:
    rel = folder.relative_to(ROOT).as_posix() + "/"
    if rel.startswith("shared-memory/_private/"):
        return "L0"
    # 폴더 자체의 분류 = 첫 .md 의 매칭 룰과 동일 분류 시도
    fake = rel + "_probe.md"
    layer = classify_path(fake)
    return layer if layer != "unclassified" else "L1"


def _is_sensitive(folder: Path) -> bool:
    rel = folder.relative_to(ROOT).as_posix()
    return rel.startswith("shared-memory/_private")


# ── Folder discovery for --all ──────────────────────────────────────────
INDEX_TARGETS = [
    "shared-memory/context",
    "shared-memory/context/clients",
    "shared-memory/context/agents",
    "shared-memory/context/daily-logs",
    "shared-memory/context/insights",
    "shared-memory/context/tasks",
    "shared-memory/context/usage",
    "shared-memory/members",
    "shared-memory/agents",          # legacy
    "shared-memory/clients",         # legacy
    "shared-memory/tasks",           # legacy
    "shared-memory/daily-logs",      # legacy
    "shared-memory/insights",        # legacy
    "shared-memory/_private",        # redacted
]


def _existing_targets() -> list[Path]:
    out: list[Path] = []
    for rel in INDEX_TARGETS:
        p = ROOT / rel
        if p.exists() and p.is_dir():
            out.append(p)
    # 추가: clients/{client}/ 와 agents/{agent}/ 하위까지
    for parent_rel in ("shared-memory/context/clients", "shared-memory/clients",
                       "shared-memory/context/agents", "shared-memory/agents",
                       "shared-memory/members"):
        p = ROOT / parent_rel
        if p.exists():
            for child in p.iterdir():
                if child.is_dir() and child not in out:
                    out.append(child)
    return out


# ── Main per-folder pipeline ────────────────────────────────────────────
def regenerate(folder: Path, *, recursive: bool, dry_run: bool,
               owner: str | None = None, default_layer: str | None = None) -> tuple[bool, int]:
    """폴더 하나의 index.md 를 재생성. (변경 여부, unknown_count) 반환."""
    if not folder.exists() or not folder.is_dir():
        sys.stderr.write(f"⚠ skip — 폴더 없음: {folder}\n")
        return False, 0
    md_files = list(_walk_md(folder, recursive=recursive))
    if not md_files and folder.name not in {"_private"}:
        # 본질적으로 빈 폴더 — README 한 줄 인덱스만 남김 (스펙: 12+ 일 때 강제)
        pass
    entries: list[Entry] = []
    for p in md_files:
        try:
            entries.append(build_entry(folder, p))
        except OSError as e:
            sys.stderr.write(f"⚠ {p}: {e}\n")
    unknown = sum(1 for e in entries if e.layer == "unclassified")
    edges = collect_link_graph(folder, entries)
    own = owner or _owner_for(folder)
    layer = default_layer or _default_layer_for(folder)
    redact = _is_sensitive(folder)
    body = render_index(folder, entries, edges, unknown, own, layer, redact)
    target = folder / "index.md"
    if dry_run:
        sys.stdout.write(f"=== DRY-RUN {target.relative_to(ROOT).as_posix()} ===\n")
        sys.stdout.write(body + "\n")
        return False, unknown
    prev = _read_text(target) if target.exists() else ""
    if prev == body:
        return False, unknown
    target.write_text(body, encoding="utf-8")
    sys.stdout.write(f"✏️  {target.relative_to(ROOT).as_posix()} ({len(entries)} entries)\n")
    return True, unknown


# ── Entrypoint ──────────────────────────────────────────────────────────
def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="aa-index — regenerate OpenViking folder index.md")
    p.add_argument("folders", nargs="*", help="대상 폴더 (저장소 상대 또는 절대)")
    p.add_argument("--all", action="store_true",
                   help="기본 인덱스 후보 폴더(`INDEX_TARGETS`) 전체")
    p.add_argument("--recursive", action="store_true",
                   help="폴더 하위 .md 까지 수집 (기본: 즉시 자식만)")
    p.add_argument("--dry-run", action="store_true", help="파일에 쓰지 않고 stdout 만")
    p.add_argument("--owner", default=None, help="index front matter owner 강제 지정")
    p.add_argument("--default-layer", default=None,
                   help="index front matter default_layer 강제 지정 (L0/L1/L2)")
    args = p.parse_args(argv)

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

    total_unknown = 0
    changed_count = 0
    for folder in targets:
        ch, unk = regenerate(
            folder,
            recursive=args.recursive,
            dry_run=args.dry_run,
            owner=args.owner,
            default_layer=args.default_layer,
        )
        changed_count += int(ch)
        total_unknown += unk
    sys.stdout.write(
        f"\n— index regenerate: {changed_count} folders updated, "
        f"{total_unknown} unclassified entries.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
