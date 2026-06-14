"""setup-obsidian-vault.py — shared-memory/ 를 Obsidian Vault 로 부트스트랩.

AI 시스템(에이전트들의 메모리)과 기영님의 Obsidian 을 하나의 폴더로 묶어
양방향 기억 순환을 만든다:

    AI 가 쓴다  →  agents/<name>/*.md, daily-logs/, insights/  (파일 변경)
              →  Obsidian 이 즉시 보여줌 (외부 변경 자동 감지)
              →  기영님이 보강 (백링크·태그·메모)
              →  다음 AI 호출이 그 파일을 그대로 읽음

같은 파일을 AI 와 사람이 함께 보므로 순환은 자동. 이 스크립트는 그 위에
*부트스트랩*(설정 + 템플릿 + MOC 인덱스 노트)을 깐다.

설치 내용:
  1. shared-memory/.obsidian/         ← Obsidian 설정 (플러그인·데일리노트·그래프)
  2. shared-memory/_templates/        ← 노트 템플릿 (daily-log·insight·agent-note)
  3. shared-memory/{MOC}.md           ← 진입점 노트 (🏠 Home 등)
  4. shared-memory/{_inbox,_attachments}/  ← Obsidian 작업 폴더

멱등성: 기영님이 편집했을 수 있는 *콘텐츠 노트*(MOC)는 기존에 있으면 덮어쓰지
않는다. *설정*(.obsidian)과 *템플릿*은 항상 최신화(이건 우리가 관리). 어떤
에이전트 메모리도 절대 건드리지 않는다.

사용: python setup-obsidian-vault.py
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent           # alien-config/obsidian
REPO = HERE.parent.parent.parent.parent          # repo root
VAULT = REPO / "shared-memory"                   # Obsidian Vault 루트
CONFIG_SRC = HERE / "vault-config"               # .obsidian 에 들어갈 설정
CONTENT_SRC = HERE / "vault-content"             # Vault 에 들어갈 노트/템플릿


def install_obsidian_config() -> int:
    """vault-config/*.json → shared-memory/.obsidian/ (항상 최신화)."""
    dst = VAULT / ".obsidian"
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for cfg in sorted(CONFIG_SRC.glob("*.json")):
        shutil.copyfile(cfg, dst / cfg.name)
        count += 1
        print(f"  OK   .obsidian/{cfg.name}")
    return count


def install_templates() -> int:
    """vault-content/_templates/*.md → shared-memory/_templates/ (항상 최신화).

    템플릿은 우리가 관리하는 자산이라 항상 덮어쓴다.
    """
    src = CONTENT_SRC / "_templates"
    dst = VAULT / "_templates"
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for tpl in sorted(src.glob("*.md")):
        shutil.copyfile(tpl, dst / tpl.name)
        count += 1
        print(f"  OK   _templates/{tpl.name}")
    return count


def install_moc_notes() -> tuple[int, int]:
    """vault-content/*.md (MOC 진입점) → shared-memory/ 루트.

    멱등성: 기존에 있으면 *덮어쓰지 않음* (기영님이 편집했을 수 있으므로).
    """
    installed = 0
    skipped = 0
    for note in sorted(CONTENT_SRC.glob("*.md")):
        target = VAULT / note.name
        if target.exists():
            print(f"  SKIP {note.name}  (이미 있음 — 보존)")
            skipped += 1
            continue
        shutil.copyfile(note, target)
        print(f"  OK   {note.name}")
        installed += 1
    return installed, skipped


def ensure_work_folders() -> None:
    """Obsidian 작업 폴더 + .gitkeep 보장."""
    for folder in ("_inbox", "_attachments"):
        d = VAULT / folder
        d.mkdir(parents=True, exist_ok=True)
        keep = d / ".gitkeep"
        if not keep.exists():
            keep.write_text("", encoding="utf-8")
        print(f"  OK   {folder}/")


def ensure_dashboard_alias() -> None:
    """dashboard.md 에 alias '🛸 대시보드' 추가 → [[🛸 대시보드]] 링크 작동.

    frontmatter 가 있으면 aliases 만 보강, 없으면 frontmatter 생성.
    멱등성: 이미 alias 있으면 스킵.
    """
    dash = VAULT / "dashboard.md"
    if not dash.exists():
        print("  SKIP dashboard.md alias  (dashboard.md 없음)")
        return
    text = dash.read_text(encoding="utf-8")
    if "🛸 대시보드" in text:
        print("  SKIP dashboard.md alias  (이미 있음)")
        return
    alias_block = '---\naliases: ["🛸 대시보드"]\n---\n'
    if text.startswith("---\n"):
        # 기존 frontmatter 의 첫 --- 다음 줄에 aliases 삽입
        end = text.find("\n---", 4)
        if end != -1:
            head = text[: end]
            rest = text[end:]
            if "aliases" not in head:
                head = head + '\naliases: ["🛸 대시보드"]'
            dash.write_text(head + rest, encoding="utf-8")
            print("  OK   dashboard.md  (aliases 보강)")
            return
    # frontmatter 없음 → 새로 추가
    dash.write_text(alias_block + text, encoding="utf-8")
    print("  OK   dashboard.md  (frontmatter + alias 생성)")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not VAULT.is_dir():
        print(f"FAIL: shared-memory 폴더 없음 -- {VAULT}", file=sys.stderr)
        return 1

    print("========== Obsidian Vault 부트스트랩 ==========")
    print(f"  Vault: {VAULT}")
    print()

    print("[1/5] Obsidian 설정 (.obsidian/)")
    n_cfg = install_obsidian_config()
    print()

    print("[2/5] 노트 템플릿 (_templates/)")
    n_tpl = install_templates()
    print()

    print("[3/5] MOC 진입점 노트")
    n_moc, s_moc = install_moc_notes()
    print()

    print("[4/5] 작업 폴더 (_inbox, _attachments)")
    ensure_work_folders()
    print()

    print("[5/5] dashboard.md alias")
    ensure_dashboard_alias()
    print()

    print("==========================================================")
    print(f"DONE. 설정 {n_cfg} · 템플릿 {n_tpl} · MOC {n_moc}신규/{s_moc}보존")
    print()
    print("다음 단계 (Obsidian 앱에서):")
    print("  1. Obsidian 실행 → '폴더를 보관함으로 열기'")
    print(f"     → {VAULT}")
    print("  2. 설정 → 커뮤니티 플러그인 → 제한 모드 끄기")
    print("  3. 다음 5개 설치·활성화:")
    print("     Dataview · Templater · Calendar · Tasks · Advanced Tables")
    print("  4. 좌측에서 '🏠 Home' 열기 → 양방향 기억 순환 시작")
    print("==========================================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
