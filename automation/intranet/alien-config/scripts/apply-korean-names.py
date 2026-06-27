"""apply-korean-names.py — Multica 에 시드된 27명 에이전트 이름에 한글을 다시 박는다.

배경 (2026-06-26 사고 복구): prebuilt multica 로 재시작하면서 frontend 한글
표시 패치가 빠졌다. `aa seed` 는 영문 이름(origin-reader 등)으로만 시드한다.
이 스크립트는 multica DB 의 agent.name 자체를 "한글 (영문)" 형태로 UPDATE 해서,
커스텀 frontend 패치 없이 prebuilt multica 에서도 한글 이름이 보이게 한다.

  예: "origin-reader"  →  "심연우 (origin-reader)"
      "agent-architect" → "구도연 (agent-architect)"

idempotent: 이미 한글이 들어간 이름(괄호 앞에 한글)은 SKIP. 영문 식별자는
괄호 안에 유지해서 aa CLI / seed 의 name 매칭이 깨지지 않게 한다.

실행: docker exec 로 컨테이너 안 psql 직접 (postgres 포트 노출 불필요).
    python apply-korean-names.py
    python apply-korean-names.py --revert    # 한글 떼고 영문만으로 되돌림
"""
from __future__ import annotations

import subprocess
import sys

PG_CONTAINER = "multica-postgres-1"

# 영문 식별자 → (한글 인명, 역할). memory-api/app.py 의 KOREAN_NAMES 와 동일.
KOREAN_NAMES: dict[str, tuple[str, str]] = {
    # WHY
    "origin-reader":          ("심연우", "Why발굴"),
    "pain-interpreter":       ("민애린", "페인진단"),
    "vision-architect":       ("윤지평", "비전설계"),
    "culture-linguist":       ("서가온", "컬쳐언어"),
    "story-weaver":           ("한벼리", "내러티브"),
    # HOW
    "process-cartographer":   ("고도현", "프로세스"),
    "agent-architect":        ("구도연", "팀설계"),
    "workflow-engineer":      ("류한길", "워크플로"),
    "integration-specialist": ("연다리", "통합설계"),
    "data-strategist":        ("차곡담", "데이터"),
    "kpi-translator":         ("정도량", "KPI"),
    "org-designer":           ("양터전", "조직설계"),
    # WHAT
    "prompt-engineer":        ("남말씨", "프롬프트"),
    "subagent-builder":       ("표본새", "에이전트빌더"),
    "mcp-connector":          ("방연동", "MCP"),
    "automation-coder":       ("공도율", "자동화"),
    "knowledge-architect":    ("장서윤", "지식설계"),
    "ui-ux-designer":         ("백그림", "UI/UX"),
    "qa-tester":              ("하검수", "QA"),
    # CTRL
    "sales-closer":           ("주결음", "영업"),
    "content-scout":          ("노소문", "콘텐츠"),
    "client-concierge":       ("안다정", "고객관리"),
    "finance-tracker":        ("나재율", "재무"),
    "brand-keeper":           ("문지율", "브랜드검수"),
    # R&D
    "trend-hunter":           ("추세현", "트렌드"),
    "case-curator":           ("모사록", "케이스"),
    "future-forecaster":      ("오먼동", "미래예측"),
}


def psql(sql: str) -> tuple[int, str]:
    """multica-postgres 컨테이너 안에서 psql 실행. (exit, output) 반환."""
    proc = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", "multica", "-d", "multica", "-t", "-A", "-c", sql],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    revert = "--revert" in sys.argv

    # 컨테이너 살아있나
    rc, _ = psql("SELECT 1;")
    if rc != 0:
        print(f"FAIL: {PG_CONTAINER} 에 연결 불가 — multica 가동 후 재시도", file=sys.stderr)
        return 1

    # 현재 agent 이름 목록
    rc, out = psql("SELECT name FROM agent ORDER BY name;")
    if rc != 0:
        print(f"FAIL: agent 조회 실패\n{out}", file=sys.stderr)
        return 1
    current = [n.strip() for n in out.splitlines() if n.strip()]
    print(f"현재 agent {len(current)}명")
    print()

    updated = 0
    skipped = 0
    for eng, (korean, role) in KOREAN_NAMES.items():
        target = f"{korean} ({eng})"

        if revert:
            # 한글 형태 → 영문만
            # "심연우 (origin-reader)" 가 있으면 "origin-reader" 로
            from_name = target
            to_name = eng
        else:
            # 영문 → 한글 형태. 영문 그대로인 행만 대상.
            from_name = eng
            to_name = target

        # 대상이 현재 목록에 있나
        if from_name not in current:
            # 이미 변환됨 or 없음
            if to_name in current:
                skipped += 1
            continue

        # SQL injection 안전: 이름은 우리 상수 딕셔너리에서만 옴. 작은따옴표 이스케이프.
        safe_to = to_name.replace("'", "''")
        safe_from = from_name.replace("'", "''")
        rc, msg = psql(f"UPDATE agent SET name = '{safe_to}' WHERE name = '{safe_from}';")
        if rc == 0:
            arrow = "←" if revert else "→"
            print(f"  {from_name:<24} {arrow} {to_name}")
            updated += 1
        else:
            print(f"  FAIL {from_name}: {msg.strip()}", file=sys.stderr)

    print()
    action = "되돌림" if revert else "한글 이름 적용"
    print(f"결과: {action} {updated}명 · 스킵 {skipped}명")
    if updated:
        print("\n브라우저에서 Multica → 에이전트 새로고침하면 한글 이름이 보입니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
