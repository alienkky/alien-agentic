#!/usr/bin/env python3
"""Inject 사상 (心訣) block into each of 27 agent definition files.

Maps each agent to one 마음 십계 line per ALI-96 follow-up #3.
Inserts a blockquote between the H1 title line and `## 정체`.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / ".claude" / "agents"

MAPPING = {
    "origin-reader":          ("반조자심", "返照自心", "내가 찾는 답은 내 안에 있다"),
    "vision-architect":       ("제행무상", "諸行無常", "모든 것은 영원하지 않고 반드시 지나간다"),
    "culture-linguist":       ("일체유심조", "一切唯心造", "마음이 곧 세계다. 마음을 바꾸면 세상이 달라진다"),
    "pain-interpreter":       ("적정중생혜", "寂靜衆生慧", "고요 속에 지혜가 깃든다"),
    "story-weaver":           ("연기", "緣起", "모든 것은 연결되어 있다"),
    "process-cartographer":   ("연기", "緣起", "모든 것은 연결되어 있다"),
    "agent-architect":        ("일체유심조", "一切唯心造", "마음이 곧 세계다. 마음을 바꾸면 세상이 달라진다"),
    "workflow-engineer":      ("연기", "緣起", "모든 것은 연결되어 있다"),
    "integration-specialist": ("연기", "緣起", "모든 것은 연결되어 있다"),
    "data-strategist":        ("수심", "守心", "마음을 지키는 것이 곧 나를 지키는 것이다"),
    "kpi-translator":         ("당하즉시", "當下卽是", "지금 이 순간에 머물라"),
    "org-designer":           ("일체유심조", "一切唯心造", "마음이 곧 세계다. 마음을 바꾸면 세상이 달라진다"),
    "prompt-engineer":        ("일체유심조", "一切唯心造", "마음이 곧 세계다. 마음을 바꾸면 세상이 달라진다"),
    "subagent-builder":       ("항복자심", "降伏自心", "나를 이기는 자가 가장 강한 자다"),
    "mcp-connector":          ("연기", "緣起", "모든 것은 연결되어 있다"),
    "automation-coder":       ("당하즉시", "當下卽是", "지금 이 순간에 머물라"),
    "knowledge-architect":    ("수심", "守心", "마음을 지키는 것이 곧 나를 지키는 것이다"),
    "ui-ux-designer":         ("반조자심", "返照自心", "내가 찾는 답은 내 안에 있다"),
    "qa-tester":              ("적정중생혜", "寂靜衆生慧", "고요 속에 지혜가 깃든다"),
    "sales-closer":           ("탐심시고근", "貪心是苦根", "탐욕은 고통의 뿌리다"),
    "content-scout":          ("제행무상", "諸行無常", "모든 것은 영원하지 않고 반드시 지나간다"),
    "client-concierge":       ("수심", "守心", "마음을 지키는 것이 곧 나를 지키는 것이다"),
    "finance-tracker":        ("탐심시고근", "貪心是苦根", "탐욕은 고통의 뿌리다"),
    "brand-keeper":           ("진화선소심", "瞋火先燒心", "분노는 남을 태우기 전에 먼저 나를 태운다"),
    "trend-hunter":           ("제행무상", "諸行無常", "모든 것은 영원하지 않고 반드시 지나간다"),
    "case-curator":           ("연기", "緣起", "모든 것은 연결되어 있다"),
    "future-forecaster":      ("제행무상", "諸行無常", "모든 것은 영원하지 않고 반드시 지나간다"),
}

MARKER = "<!-- sashang-injected -->"

def block(hangul: str, hanja: str, line: str) -> str:
    return (
        f"{MARKER}\n"
        f"> **사상 (心訣) — {hangul} ({hanja})**: {line}.\n"
        f"> 이 한 줄이 매 호출 전·후에 통과시킬 거울. 헌법 `DOCTRINE OF MIND` 참조.\n\n"
    )

def main() -> int:
    if not ROOT.is_dir():
        raise SystemExit(f"agents dir missing: {ROOT}")

    touched, skipped, missing = 0, 0, []
    for name, payload in MAPPING.items():
        path = ROOT / f"{name}.md"
        if not path.is_file():
            missing.append(name)
            continue
        text = path.read_text(encoding="utf-8")
        if MARKER in text:
            skipped += 1
            continue
        if "## 정체" not in text:
            raise SystemExit(f"anchor '## 정체' missing in {path}")
        new_text = text.replace("## 정체", block(*payload) + "## 정체", 1)
        path.write_text(new_text, encoding="utf-8")
        touched += 1

    print(f"touched={touched} skipped={skipped} missing={missing}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
