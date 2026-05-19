"""Inline-edit multica/packages/views/issues/components/issue-detail.tsx.

업스트림 Multica 가 우리 04 패치 작성 시점보다 앞서가 (CalendarClock,
CalendarDays 추가 등) git apply 가 더 이상 안 맞을 때 — 패치 시스템을
거치지 않고 *유니크 앵커 문자열* 기반으로 4개 변경을 직접 적용한다.

변경 4개:
  A. ArrowDown 을 lucide-react import 에 추가
  B. showScrollToBottom state 추가
  C. useEffect (스크롤 감지) + scrollToBottom callback 추가
  D. CommentInput <div> 를 sticky bottom-0 으로 + 그 위에 floating button

멱등성 보장: 각 변경마다 *이미 적용됨* 검사 → 스킵.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# ─── 경로 ─────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent.parent  # scripts→alien-config→intranet→automation→repo
TARGET = (
    REPO
    / "automation" / "intranet" / "multica"
    / "packages" / "views" / "issues" / "components"
    / "issue-detail.tsx"
)

# ─── 변경 정의 ────────────────────────────────────────────────
# (이름, 멱등성 검사용 마커, 앵커, 교체 결과)
EDITS: list[tuple[str, str, str, str]] = [
    (
        "A. ArrowDown import",
        "  ArrowDown,\n",
        "import {\n  Archive,\n  Calendar,",
        "import {\n  Archive,\n  ArrowDown,\n  Calendar,",
    ),
    (
        "B+C. showScrollToBottom state + useEffect + scrollToBottom callback",
        "setShowScrollToBottom",
        "const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);",
        """const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    const el = scrollContainerEl;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollToBottom(distFromBottom > 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerEl]);

  const scrollToBottom = useCallback(() => {
    scrollContainerEl?.scrollTo({ top: scrollContainerEl.scrollHeight, behavior: "smooth" });
  }, [scrollContainerEl]);""",
    ),
    (
        "D. CommentInput div sticky + floating 맨 아래로 button",
        "showScrollToBottom && (",
        '{/* Bottom comment input — no avatar, full width */}\n            <div className="mt-4">',
        """{showScrollToBottom && (
              <div className="sticky bottom-24 z-20 flex justify-center pointer-events-none">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  맨 아래로
                </button>
              </div>
            )}

            {/* Bottom comment input — no avatar, full width.
                sticky bottom-0: 긴 타임라인을 위로 스크롤하며 읽을 때도
                댓글 입력창이 항상 viewport 하단에 따라붙어, 위 내용을
                참조하면서 바로 댓글을 작성할 수 있도록 한다.
                pr-14: 화면 우하단 ChatFab(absolute bottom-2 right-2 z-50)과
                댓글 보내기 버튼이 겹치지 않도록 입력 영역 우측을 비운다. */}
            <div className="mt-4 sticky bottom-0 z-10 bg-background pt-2 pb-3 pr-14">""",
    ),
]


def main() -> int:
    # Windows 콘솔 UTF-8 보장
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not TARGET.exists():
        print(f"FAIL: 대상 파일 없음 — {TARGET}", file=sys.stderr)
        return 1

    original = TARGET.read_text(encoding="utf-8")
    text = original

    print(f"대상: {TARGET}")
    print(f"원본 크기: {len(original)} chars / {len(original.splitlines())} lines")
    print()

    applied = 0
    skipped = 0
    failed: list[str] = []

    for name, marker, anchor, replacement in EDITS:
        if marker in text:
            print(f"  SKIP {name}  (이미 적용됨)")
            skipped += 1
            continue
        if anchor not in text:
            print(f"  FAIL {name}  (앵커 없음)")
            failed.append(name)
            continue
        if text.count(anchor) > 1:
            print(f"  FAIL {name}  (앵커 중복 {text.count(anchor)}개)")
            failed.append(name)
            continue
        text = text.replace(anchor, replacement, 1)
        print(f"  OK   {name}")
        applied += 1

    # E. 버튼 ↔ 입력창 padding 정규화
    #
    # 두 가지 04 패치 구현이 야생에 존재한다:
    #   (1) 우리가 작성한 별도 sticky : `sticky bottom-N z-20` 컨테이너
    #   (2) 더 영리한 stack 버전     : `flex justify-center pb-N pointer-events-none`
    #     (같은 sticky container 안에 pill 과 input 을 위아래로 stack)
    #
    # 둘 중 어느 쪽이든 N(여백) 을 늘려 시각 분리를 강화한다. 타깃값:
    #   (1) bottom-24 (96px)
    #   (2) pb-4 (16px)
    pat_sticky = re.compile(r"sticky bottom-(\d+) z-20")
    pat_pb     = re.compile(r"flex justify-center pb-(\d+) pointer-events-none")

    sticky_matches = pat_sticky.findall(text)
    pb_matches     = pat_pb.findall(text)

    if sticky_matches:
        if sticky_matches == ["24"]:
            print(f"  SKIP E. bottom-24  (이미 적용됨, 별도 sticky 버전)")
            skipped += 1
        else:
            old_n = sticky_matches[0]
            text = pat_sticky.sub("sticky bottom-24 z-20", text, count=1)
            print(f"  OK   E. bottom-{old_n} → bottom-24  (별도 sticky 버전)")
            applied += 1
    elif pb_matches:
        if pb_matches == ["4"]:
            print(f"  SKIP E. pb-4  (이미 적용됨, stack 버전)")
            skipped += 1
        else:
            old_n = pb_matches[0]
            text = pat_pb.sub("flex justify-center pb-4 pointer-events-none", text, count=1)
            print(f"  OK   E. pb-{old_n} → pb-4  (stack 버전)")
            applied += 1
    else:
        print(f"  FAIL E. padding 정규화  (sticky bottom-N z-20 도 flex pb-N 도 없음)")
        failed.append("E. padding 정규화")

    print()
    print(f"결과: 적용 {applied} / 스킵 {skipped} / 실패 {len(failed)}")

    if failed:
        print("실패한 변경:")
        for n in failed:
            print(f"  - {n}")
        return 1

    if applied > 0:
        # UTF-8, no BOM, LF (TSX 표준)
        TARGET.write_bytes(text.encode("utf-8"))
        print(f"파일 갱신 완료. 새 크기: {len(text)} chars")
    else:
        print("변경 없음 (이미 모두 적용됨).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
