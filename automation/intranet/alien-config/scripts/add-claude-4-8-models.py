"""multica server/pkg/agent/models.go 에 Claude 4.8 모델 추가.

multica 가 fresh clone 돼도 자동 복원되도록 alien-config 패치 시스템에 박는다.
restore-korean-locale.py 패턴 따라 idempotent 멱등성 보장.

배경 (2026-05-27):
사용자 CLI 에선 4.8 이 나오는데 Multica picker 엔 4.7 까지만 보임. 진단 결과
multica 의 backend models.go 에 모델 목록이 *정적 하드코딩* 되어 있어 새 모델
출시 시 수동 추가 필요. 두 함수 모두에 추가:
  1. claudeStaticModels() — Claude Code CLI 어댑터용 (ID 형식: claude-opus-4-X)
  2. allModels()? — Direct Anthropic API 모델 목록 (ID 형식: claude-opus-4.X)

사용: 이 스크립트는 setup-multica.ps1 가 자동 호출. fresh clone 후 docker
재빌드 전에 backend 소스를 패치.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent.parent
MULTICA = REPO / "automation" / "intranet" / "multica"
MODELS_GO = MULTICA / "server" / "pkg" / "agent" / "models.go"


def patch_static_models(text: str) -> tuple[str, str]:
    """함수 1 -- claudeStaticModels() 에 claude-opus-4-8 추가.

    형식 (하이픈 ID): {ID: "claude-opus-4-8", Label: "Claude Opus 4.8", Provider: "anthropic"},
    위치: claude-opus-4-7 줄 바로 다음 (Default: true 가 sonnet-4-6 에 박혀 있으니 유지).
    """
    if '"claude-opus-4-8"' in text:
        return text, "SKIP (이미 적용됨)"

    anchor = '{ID: "claude-opus-4-7", Label: "Claude Opus 4.7", Provider: "anthropic"},'
    if anchor not in text:
        return text, "FAIL (앵커 없음 -- claude-opus-4-7 줄)"
    if text.count(anchor) > 1:
        return text, f"FAIL (앵커 중복 {text.count(anchor)}개)"

    # claude-opus-4-7 줄 *위에* 4-8 삽입 (최신이 위로 오게)
    replacement = (
        '{ID: "claude-opus-4-8", Label: "Claude Opus 4.8", Provider: "anthropic"},\n'
        '\t\t' + anchor
    )
    return text.replace(anchor, replacement, 1), "OK"


def patch_dot_models(text: str) -> tuple[str, str]:
    """함수 2 -- Direct Anthropic API 목록에 claude-opus-4.8 추가.

    형식 (점 ID): {ID: "claude-opus-4.8", Label: "Claude Opus 4.8", Provider: "anthropic"},
    위치: claude-opus-4.7 줄 바로 위 (최신이 위로).
    """
    if '"claude-opus-4.8"' in text:
        return text, "SKIP (이미 적용됨)"

    anchor = '{ID: "claude-opus-4.7", Label: "Claude Opus 4.7", Provider: "anthropic"},'
    if anchor not in text:
        return text, "FAIL (앵커 없음 -- claude-opus-4.7 줄)"
    if text.count(anchor) > 1:
        return text, f"FAIL (앵커 중복 {text.count(anchor)}개)"

    replacement = (
        '{ID: "claude-opus-4.8", Label: "Claude Opus 4.8", Provider: "anthropic"},\n'
        '\t\t' + anchor
    )
    return text.replace(anchor, replacement, 1), "OK"


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not MULTICA.exists():
        print(f"FAIL: multica 폴더 없음 -- {MULTICA}", file=sys.stderr)
        return 1
    if not MODELS_GO.exists():
        print(f"FAIL: models.go 없음 -- {MODELS_GO}", file=sys.stderr)
        return 1

    print(f"[패치] {MODELS_GO.relative_to(MULTICA)}")
    text = MODELS_GO.read_text(encoding="utf-8")

    applied = 0
    skipped = 0
    failed = 0

    new_text, status = patch_static_models(text)
    print(f"  M1. claudeStaticModels()  + claude-opus-4-8 .... {status}")
    if status == "OK":
        text = new_text
        applied += 1
    elif status.startswith("SKIP"):
        skipped += 1
    else:
        failed += 1

    new_text, status = patch_dot_models(text)
    print(f"  M2. allModels()           + claude-opus-4.8 .... {status}")
    if status == "OK":
        text = new_text
        applied += 1
    elif status.startswith("SKIP"):
        skipped += 1
    else:
        failed += 1

    if applied > 0:
        MODELS_GO.write_text(text, encoding="utf-8")
        print(f"\n저장됨: {MODELS_GO}")

    print(f"\n결과: 적용 {applied} / 스킵 {skipped} / 실패 {failed}")
    if failed:
        print("\n힌트: multica 업스트림이 models.go 구조를 바꿨을 수 있음.")
        print("       해당 파일에서 'claude-opus' 직접 grep 으로 확인.")
        return 1
    if applied == 0:
        print("\n변경 없음 (이미 모두 적용됨).")
    else:
        print("\n다음: docker 재빌드 (setup-multica.ps1 또는 docker compose up -d --build).")
        print("      Multica 새로고침 후 picker 에 'Claude Opus 4.8' 보임.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
