/** 상단 메뉴바 (Shapr3D): 프로젝트명 · 메뉴 · 실행취소/다시실행 · 공유. */
import { useAppStore } from "../store/useAppStore";
import { UndoIcon, RedoIcon } from "./icons";

const MENUS = ["파일", "편집", "항목", "뷰", "도움말"];

export function TopMenuBar(): JSX.Element {
  const undoLast = useAppStore((s) => s.undoLast);
  const shapeCount = useAppStore((s) => s.shapes.length);

  return (
    <div className="pointer-events-auto absolute left-0 right-0 top-0 z-30 flex h-12 items-center justify-between border-b border-aa-border bg-aa-surface/95 px-2 backdrop-blur">
      {/* 좌측: 브랜드 + 프로젝트 + 메뉴 */}
      <div className="flex items-center gap-1">
        <span className="px-2 text-sm font-semibold tracking-[0.18em] text-aa-accent">ALIEN SPACE</span>
        <span className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-aa-text aa-hoverable">
          무제 프로젝트 <span className="text-aa-text-dim">▾</span>
        </span>
        <div className="mx-1 h-5 w-px bg-aa-border" />
        {MENUS.map((m) => (
          <button key={m} type="button" className="rounded-md px-2.5 py-1 text-sm text-aa-text aa-hoverable">
            {m}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-aa-border" />
        <button
          type="button"
          title="실행취소"
          onClick={() => void undoLast()}
          disabled={shapeCount === 0}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text aa-hoverable disabled:opacity-30"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          title="다시실행 (준비 중)"
          disabled
          className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text-dim opacity-30"
        >
          <RedoIcon />
        </button>
      </div>

      {/* 중앙: 제한 액세스 배지 */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-full bg-aa-bg px-3 py-1 text-xs text-aa-text-dim">제한된 액세스 버전</span>
      </div>

      {/* 우측: 공유 */}
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-lg bg-aa-accent px-3 py-1.5 text-sm font-semibold text-aa-bg">
          공유
        </button>
      </div>
    </div>
  );
}
