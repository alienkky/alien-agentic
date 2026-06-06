#!/usr/bin/env python3
"""aa-pr.py — Write-time Compile PR pipeline (ALI-103).

기영님 정책:
  - 에이전트는 main 에 직접 push 하지 않는다.
  - 모든 변경은 `agent/<name>/<slug>` 브랜치 → PR → *사람만* 머지.
  - PR 본문 = 충돌 보고서 + OpenViking(임시) 계층 추정 + 머지 권장.
  - 같은 검증을 .github/workflows/pr-knowledge-check.yml 이 CI 에서 재실행.

이 스크립트는 std lib 만 사용한다 (CI 의존성 제로). gh CLI 와 git 만 외부 의존.

사용:
  scripts/aa-pr.py check   --base main          # 충돌 보고서만 (stdout, CI 용)
  scripts/aa-pr.py report  --base main -o BODY  # 보고서 → 파일
  scripts/aa-pr.py submit  --base main \\
                           --title "..." \\
                           --body-from-report   # gh pr create 까지 한번에
  scripts/aa-pr.py verify-branch                # 브랜치 네이밍 강제
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
BRANCH_RE = re.compile(r"^agent/[a-z0-9][a-z0-9-]{0,40}/[a-z0-9][a-z0-9._-]{0,60}$")

# OpenViking 임시 매핑 — ALI-101 (`shared-memory/context/openviking-mapping.md`) 도착 시
# `_load_openviking_mapping()` 가 이 표를 덮어쓴다. 현 폴더 구조 기준 골격.
DEFAULT_LAYER_RULES: list[tuple[str, str]] = [
    (r"^shared-memory/_private/", "L0"),
    (r"^shared-memory/[^/]+/raw/", "L0"),
    (r"^shared-memory/context/clients/[^/]+/raw/", "L0"),
    (r"^shared-memory/messages/", "L0"),
    (r"^shared-memory/interventions/", "L0"),
    (r"^shared-memory/daily-logs/", "L1"),
    (r"^shared-memory/insights/", "L1"),
    (r"^shared-memory/clients/", "L1"),
    (r"^shared-memory/context/", "L1"),
    (r"^shared-memory/dashboard\.md$", "L1"),
    (r"^shared-memory/members/[^/]+/notes/", "L1"),
    (r"^shared-memory/agents/", "L2"),
    (r"^shared-memory/context/agents/", "L2"),
    (r"^shared-memory/members/[^/]+/agents/", "L2"),
    (r"^\.claude/agents/", "L2"),
]


@dataclass
class Conflict:
    kind: str            # duplicate-title | missing-link | decision-contradiction | layer-mismatch
    severity: str        # error | warn | info
    path: str
    detail: str

    def line(self) -> str:
        emoji = {"error": "❌", "warn": "⚠️", "info": "ℹ️"}[self.severity]
        return f"{emoji} **{self.kind}** · `{self.path}` — {self.detail}"


@dataclass
class Report:
    branch: str
    base: str
    changed: list[tuple[str, str]] = field(default_factory=list)  # (status, path)
    layer_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    conflicts: list[Conflict] = field(default_factory=list)
    branch_ok: bool = True
    branch_detail: str = ""

    def has_errors(self) -> bool:
        return any(c.severity == "error" for c in self.conflicts) or not self.branch_ok

    def to_json(self) -> str:
        return json.dumps({
            "branch": self.branch,
            "base": self.base,
            "branch_ok": self.branch_ok,
            "branch_detail": self.branch_detail,
            "changed": self.changed,
            "layer_counts": dict(self.layer_counts),
            "conflicts": [c.__dict__ for c in self.conflicts],
            "has_errors": self.has_errors(),
        }, ensure_ascii=False, indent=2)


# ── git helpers ──────────────────────────────────────────────────────────
def _git(*args: str) -> str:
    res = subprocess.run(
        ["git", *args], cwd=str(ROOT),
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 실패: {res.stderr.strip()}")
    return res.stdout


def _current_branch() -> str:
    return _git("rev-parse", "--abbrev-ref", "HEAD").strip()


def _merge_base(base: str) -> str:
    # base 가 origin/main 이든 main 이든 양쪽 모두 시도
    candidates = [base, f"origin/{base}" if not base.startswith("origin/") else base]
    for ref in candidates:
        try:
            return _git("merge-base", ref, "HEAD").strip()
        except RuntimeError:
            continue
    raise RuntimeError(f"merge-base 를 찾을 수 없음 (base={base})")


def _changed_files(base_sha: str) -> list[tuple[str, str]]:
    """base..HEAD 의 파일 목록 — (status, path). 신규는 A, 수정은 M, 삭제는 D."""
    out = _git("diff", "--name-status", f"{base_sha}..HEAD")
    rows: list[tuple[str, str]] = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0][:1]  # R100 같은 rename 도 R 한 글자
        path = parts[-1].replace("\\", "/")
        rows.append((status, path))
    return rows


# ── OpenViking 계층 추정 ────────────────────────────────────────────────
def _load_openviking_mapping() -> list[tuple[str, str]]:
    """ALI-101 산출물이 도착하면 이 자리에서 흡수.

    스펙은 `shared-memory/context/openviking-mapping.md` 의 코드블록에
    `pattern -> Lx` 형식으로 박힌다(예상). 미도착이면 기본 룰 반환.
    """
    spec = ROOT / "shared-memory" / "context" / "openviking-mapping.md"
    if not spec.exists():
        return DEFAULT_LAYER_RULES
    rules: list[tuple[str, str]] = []
    for line in spec.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"\s*`([^`]+)`\s*->\s*(L[0-2])\s*$", line)
        if m:
            rules.append((m.group(1), m.group(2)))
    return rules or DEFAULT_LAYER_RULES


def _classify(path: str, rules: list[tuple[str, str]]) -> str:
    for pat, layer in rules:
        if re.search(pat, path):
            return layer
    return "?"


# ── 충돌 검사 ──────────────────────────────────────────────────────────
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _collect_index_titles() -> dict[str, list[str]]:
    """기존 index.md / log.md 의 H1 제목 → 파일 목록."""
    titles: dict[str, list[str]] = defaultdict(list)
    for p in ROOT.rglob("index.md"):
        for m in H1_RE.finditer(_read(p)):
            titles[m.group(1).strip().lower()].append(str(p.relative_to(ROOT)))
    for p in ROOT.rglob("log.md"):
        for m in H1_RE.finditer(_read(p)):
            titles[m.group(1).strip().lower()].append(str(p.relative_to(ROOT)))
    return titles


def _check_duplicate_titles(
    changed_md: list[str], existing: dict[str, list[str]],
) -> list[Conflict]:
    out: list[Conflict] = []
    for rel in changed_md:
        p = ROOT / rel
        if not p.exists():
            continue
        for m in H1_RE.finditer(_read(p)):
            t = m.group(1).strip().lower()
            others = [o for o in existing.get(t, []) if o != rel]
            if others:
                out.append(Conflict(
                    kind="duplicate-title", severity="warn", path=rel,
                    detail=f"같은 H1 제목이 이미 존재: {', '.join(others[:3])}",
                ))
    return out


def _check_missing_links(changed_md: list[str]) -> list[Conflict]:
    out: list[Conflict] = []
    for rel in changed_md:
        p = ROOT / rel
        if not p.exists():
            continue
        text = _read(p)
        for m in LINK_RE.finditer(text):
            target = m.group(2).split("#")[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:", "mention://", "#")):
                continue
            resolved = (p.parent / target).resolve()
            if not resolved.exists():
                out.append(Conflict(
                    kind="missing-link", severity="error", path=rel,
                    detail=f"링크 대상 없음: `{target}` (해소: {resolved})",
                ))
    return out


# 결정-모순 휴리스틱 — 같은 키워드가 들어간 *결정* 줄들이 부정/긍정으로 갈리면 경고.
DECISION_RE = re.compile(
    r"^\s*[-*]\s*(?:결정|decision|채택|폐기|선택)\s*[:：]\s*(.+)$",
    re.MULTILINE | re.IGNORECASE,
)
NEGATIVE_RE = re.compile(r"(?:안\s*|않|폐기|취소|reject|deny|drop|kill|stop)")


def _check_decision_contradictions(changed_md: list[str]) -> list[Conflict]:
    """모순 가능성 *후보*만 띄운다 (false-positive 허용 — 사람이 본다)."""
    decisions: list[tuple[str, str]] = []  # (path, text)
    for p in (ROOT / "shared-memory").rglob("decisions.md"):
        for m in DECISION_RE.finditer(_read(p)):
            decisions.append((str(p.relative_to(ROOT)), m.group(1).strip()))
    out: list[Conflict] = []
    for rel in changed_md:
        p = ROOT / rel
        if not p.exists() or "decisions" not in rel:
            continue
        for m in DECISION_RE.finditer(_read(p)):
            new_text = m.group(1).strip()
            new_negative = bool(NEGATIVE_RE.search(new_text))
            # 신규 결정에서 명사 2개 추출 → 기존 결정과 매칭
            keywords = [w for w in re.findall(r"[가-힣A-Za-z]{2,}", new_text) if len(w) >= 2][:3]
            if not keywords:
                continue
            for opath, otext in decisions:
                if opath == rel:
                    continue
                if not all(k in otext for k in keywords[:2]):
                    continue
                old_negative = bool(NEGATIVE_RE.search(otext))
                if new_negative != old_negative:
                    out.append(Conflict(
                        kind="decision-contradiction", severity="warn", path=rel,
                        detail=(
                            f"기존 결정과 방향이 다를 수 있음 — "
                            f"신규: \"{new_text[:60]}\" vs "
                            f"`{opath}` 의 \"{otext[:60]}\""
                        ),
                    ))
                    break
    return out


# ── 메인 보고서 빌더 ────────────────────────────────────────────────────
def build_report(base: str) -> Report:
    branch = _current_branch()
    rep = Report(branch=branch, base=base)

    if not BRANCH_RE.match(branch):
        rep.branch_ok = False
        rep.branch_detail = (
            f"브랜치명 `{branch}` 은 `agent/<name>/<slug>` 형식이 아닙니다. "
            "예: `agent/automation-coder/pr-pipeline`. "
            "(소문자·숫자·하이픈만, 두 슬래시 강제)"
        )

    try:
        base_sha = _merge_base(base)
    except RuntimeError as e:
        rep.branch_detail += f"\n{e}"
        return rep

    rep.changed = _changed_files(base_sha)
    rules = _load_openviking_mapping()
    for _, p in rep.changed:
        rep.layer_counts[_classify(p, rules)] += 1

    changed_md = [p for st, p in rep.changed if st != "D" and p.lower().endswith(".md")]
    existing_titles = _collect_index_titles()

    rep.conflicts += _check_duplicate_titles(changed_md, existing_titles)
    rep.conflicts += _check_missing_links(changed_md)
    rep.conflicts += _check_decision_contradictions(changed_md)
    return rep


# ── 보고서 → 마크다운 ────────────────────────────────────────────────────
def render_markdown(rep: Report) -> str:
    lines: list[str] = []
    lines.append("# 🛸 Write-time Compile — 자동 충돌 보고서")
    lines.append("")
    lines.append(f"- 브랜치: `{rep.branch}` → 머지 대상: `{rep.base}`")
    lines.append(f"- 변경 파일: **{len(rep.changed)}** 건")
    if rep.layer_counts:
        layer_str = " · ".join(
            f"{k}={v}" for k, v in sorted(rep.layer_counts.items())
        )
        lines.append(f"- OpenViking 계층 분포: {layer_str}")
    lines.append("")

    # 브랜치 네이밍
    if rep.branch_ok:
        lines.append("## ✅ 브랜치 네이밍 — 통과")
    else:
        lines.append("## ❌ 브랜치 네이밍 — 위반")
        lines.append("")
        lines.append(f"> {rep.branch_detail}")
    lines.append("")

    # 충돌
    if not rep.conflicts:
        lines.append("## ✅ 지식 충돌 — 발견 없음")
    else:
        errors = [c for c in rep.conflicts if c.severity == "error"]
        warns = [c for c in rep.conflicts if c.severity == "warn"]
        infos = [c for c in rep.conflicts if c.severity == "info"]
        lines.append(
            f"## ⚠ 지식 충돌 — error {len(errors)} / warn {len(warns)} / info {len(infos)}"
        )
        lines.append("")
        for c in errors + warns + infos:
            lines.append(f"- {c.line()}")
    lines.append("")

    # 머지 권장
    lines.append("## 🚦 머지 권장")
    lines.append("")
    if rep.has_errors():
        lines.append(
            "- **머지 보류 권장.** error 표시 항목을 먼저 해소하세요. "
            "(missing-link 가 가장 흔한 원인 — 옮긴 파일을 참조하는 곳을 같이 갱신)"
        )
    else:
        lines.append("- **사람 리뷰어 1명 확인 후 머지 가능.**")
        lines.append("- 머지는 사람만. CI 의 auto-merge 는 금지.")
    lines.append("")

    # 변경 파일 표
    if rep.changed:
        lines.append("## 📁 변경 파일")
        lines.append("")
        lines.append("| 상태 | 경로 | 계층 |")
        lines.append("|---|---|---|")
        rules = _load_openviking_mapping()
        for st, p in rep.changed[:200]:
            lines.append(f"| {st} | `{p}` | {_classify(p, rules)} |")
        if len(rep.changed) > 200:
            lines.append(f"| … | (생략 {len(rep.changed) - 200} 건) | |")
        lines.append("")

    lines.append("---")
    lines.append("*생성: `scripts/aa-pr.py` — ALI-103 Write-time Compile pipeline.*")
    return "\n".join(lines)


# ── 라벨 결정 (CI 용) ────────────────────────────────────────────────────
def labels_for(rep: Report) -> list[str]:
    out = ["aa-pr"]
    if not rep.branch_ok:
        out.append("branch-naming-violation")
    if any(c.severity == "error" for c in rep.conflicts):
        out.append("knowledge-conflict")
    elif any(c.severity == "warn" for c in rep.conflicts):
        out.append("review-needed")
    else:
        out.append("clean")
    return out


# ── 서브커맨드 ──────────────────────────────────────────────────────────
def cmd_check(args: argparse.Namespace) -> int:
    rep = build_report(args.base)
    if args.json:
        print(rep.to_json())
    else:
        print(render_markdown(rep))
    if args.fail_on_error and rep.has_errors():
        return 2
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    rep = build_report(args.base)
    out = Path(args.out)
    out.write_text(render_markdown(rep), encoding="utf-8")
    print(f"보고서 저장: {out}")
    if args.fail_on_error and rep.has_errors():
        return 2
    return 0


def cmd_verify_branch(args: argparse.Namespace) -> int:
    name = _current_branch()
    if BRANCH_RE.match(name):
        print(f"✅ {name}")
        return 0
    sys.stderr.write(
        f"❌ {name} — `agent/<name>/<slug>` 형식이 아닙니다.\n"
        "   예: agent/automation-coder/pr-pipeline\n"
    )
    return 1


def cmd_submit(args: argparse.Namespace) -> int:
    rep = build_report(args.base)
    if args.fail_on_error and rep.has_errors():
        sys.stderr.write("충돌 보고서에 error 가 있어 PR 생성 중단.\n")
        sys.stderr.write(render_markdown(rep) + "\n")
        return 2

    body_path = Path(args.body_file) if args.body_file else ROOT / ".aa-pr-body.md"
    body_path.write_text(render_markdown(rep), encoding="utf-8")

    # 현재 브랜치를 origin 으로 푸시 (gh pr create 가 base 필요)
    try:
        _git("push", "-u", "origin", rep.branch)
    except RuntimeError as e:
        sys.stderr.write(f"git push 실패: {e}\n")
        return 3

    cmd = [
        "gh", "pr", "create",
        "--base", args.base,
        "--head", rep.branch,
        "--title", args.title,
        "--body-file", str(body_path),
    ]
    for label in labels_for(rep):
        cmd += ["--label", label]
    res = subprocess.run(cmd, cwd=str(ROOT))
    return res.returncode


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Alien Agentic Write-time Compile PR pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_check = sub.add_parser("check", help="충돌 보고서를 stdout 으로 출력")
    p_check.add_argument("--base", default="main")
    p_check.add_argument("--json", action="store_true")
    p_check.add_argument("--fail-on-error", action="store_true")
    p_check.set_defaults(func=cmd_check)

    p_report = sub.add_parser("report", help="충돌 보고서를 파일로 저장")
    p_report.add_argument("--base", default="main")
    p_report.add_argument("-o", "--out", default=".aa-pr-body.md")
    p_report.add_argument("--fail-on-error", action="store_true")
    p_report.set_defaults(func=cmd_report)

    p_verify = sub.add_parser("verify-branch", help="브랜치 네이밍 강제")
    p_verify.set_defaults(func=cmd_verify_branch)

    p_submit = sub.add_parser("submit", help="gh pr create 까지 한 번에")
    p_submit.add_argument("--base", default="main")
    p_submit.add_argument("--title", required=True)
    p_submit.add_argument("--body-file", default=None,
                          help="비우면 .aa-pr-body.md 에 자동 생성")
    p_submit.add_argument("--fail-on-error", action="store_true", default=True)
    p_submit.set_defaults(func=cmd_submit)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
