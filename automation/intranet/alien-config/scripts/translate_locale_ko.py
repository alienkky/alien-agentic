"""Multica en/ locale을 한국어 ko/ 로 자동 번역 — Claude Max 경유.

24개 namespace JSON 을 순차 번역. Claude CLI subprocess 호출. 토큰 비용은
Max 구독에 포함.

사용:
    cd E:/AlienAgentic/alien-agentic/automation/intranet/alien-config/scripts
    "E:/AlienAgentic/alien-agentic/automation/cli/.venv/Scripts/python.exe" translate_locale_ko.py

idempotent: 이미 ko/ 안에 같은 파일이 *non-empty* 면 SKIP.

진행 로그는 stdout. 실패한 파일은 별도 보고.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

# Windows 콘솔 UTF-8 보장
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass


CLAUDE = Path.home() / ".local" / "bin" / "claude.exe"

HERE = Path(__file__).resolve().parent
# scripts → alien-config → intranet
MULTICA_ROOT = HERE.parent.parent / "multica"
EN_DIR = MULTICA_ROOT / "packages" / "views" / "locales" / "en"
KO_DIR = EN_DIR.parent / "ko"


INSTRUCTION = """stdin 입력은 Alien Agentic (Multica 기반) 의 i18n JSON 파일이다.
한국어로 번역해서 *순수 JSON만* 출력해라 (설명·markdown 코드블록 X).

룰:
1. 키(좌측 영문 식별자) 절대 변경 X
2. 값(우측 문자열)만 자연스러운 한국어로 번역
3. 변수 placeholder ({{name}}, {{count}}, {{0}}) 그대로 유지
4. "Alien Agentic" 은 번역 X (제품명)
5. JSON 형식 유지 (들여쓰기 2칸)
6. 톤: 비즈니스 UI 한국어, Linear/Notion/Slack 스타일. 간결.
7. 용어: 이슈/에이전트/워크스페이스/런타임/스킬/프로젝트/태스크/팀원/대시보드/사이드바
8. 직역 X, 한국어 UI 관습"""


def extract_json(response: str) -> str:
    """Claude 응답에서 JSON만 추출 (markdown 래퍼 제거)."""
    # ```json ... ``` 패턴
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if m:
        return m.group(1)
    s = response.strip()
    if s.startswith("{") and s.endswith("}"):
        return s
    # 첫 { 부터 마지막 } 까지
    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        return s[start : end + 1]
    raise ValueError(
        f"JSON 추출 실패. 응답 앞 300자:\n{response[:300]}"
    )


def translate(content: str) -> str:
    """stdin pipe 로 content 를 claude 에게 전달 — Windows 인자 길이 한계 우회."""
    result = subprocess.run(
        [
            str(CLAUDE),
            "-p",
            INSTRUCTION,
            "--model",
            "sonnet",
            "--output-format",
            "text",
            "--no-session-persistence",
            "--permission-mode",
            "bypassPermissions",
        ],
        input=content,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=600,  # 10분 per file (큰 파일 여유)
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude exit {result.returncode}\nstderr: {result.stderr[:500]}"
        )
    return extract_json(result.stdout)


def _flat_keys(d: dict, prefix: str = "") -> list[str]:
    keys = []
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.extend(_flat_keys(v, full))
        else:
            keys.append(full)
    return keys


def main() -> int:
    if not CLAUDE.exists():
        print(f"ERROR: claude CLI 없음: {CLAUDE}", file=sys.stderr)
        return 1
    if not EN_DIR.exists():
        print(f"ERROR: en locale 폴더 없음: {EN_DIR}", file=sys.stderr)
        return 1

    KO_DIR.mkdir(exist_ok=True)
    en_files = sorted(EN_DIR.glob("*.json"))
    print(f"번역 대상: {len(en_files)} 파일")
    print(f"  출처: {EN_DIR}")
    print(f"  목적지: {KO_DIR}")
    print()

    ok = 0
    skipped = 0
    failed: list[tuple[str, str]] = []
    for f in en_files:
        ko_file = KO_DIR / f.name
        if ko_file.exists() and ko_file.stat().st_size > 0:
            print(f"  SKIP {f.name} (이미 있음, {ko_file.stat().st_size} bytes)")
            skipped += 1
            continue
        en_text = f.read_text(encoding="utf-8")
        size_kb = len(en_text) / 1024
        print(f"  번역 {f.name:<22} ({size_kb:>5.1f}KB)...", end=" ", flush=True)
        try:
            ko_text = translate(en_text)
            # JSON 유효성 + 키 일치 검증
            ko_data = json.loads(ko_text)
            en_data = json.loads(en_text)
            en_keys = set(_flat_keys(en_data))
            ko_keys = set(_flat_keys(ko_data))
            missing = en_keys - ko_keys
            extra = ko_keys - en_keys
            warning = ""
            if missing or extra:
                warning = f" ⚠ 키 차이 (누락 {len(missing)} / 추가 {len(extra)})"
            ko_file.write_text(ko_text, encoding="utf-8")
            print(f"OK {len(ko_text):>6} chars{warning}")
            ok += 1
        except Exception as e:
            print(f"FAIL")
            print(f"     {e}")
            failed.append((f.name, str(e)))

    print()
    print(f"결과: 성공 {ok} / 스킵 {skipped} / 실패 {len(failed)} (총 {len(en_files)})")
    if failed:
        print("\n실패한 파일:")
        for name, err in failed:
            print(f"  {name}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
