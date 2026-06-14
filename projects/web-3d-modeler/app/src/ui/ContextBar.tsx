/**
 * 하단 컨텍스트 액션바 (Shapr3D 의 선택 컨텍스트 툴바 대응).
 * 선택이 있을 때만 등장. 2개 선택 → 불리언(빼기/합치기/교집합).
 */
import { IconButton } from "./IconButton";
import { SubtractIcon, UnionIcon, IntersectIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";

export function ContextBar(): JSX.Element | null {
  const selected = useAppStore((s) => s.selectedShapeIds);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const busy = useAppStore((s) => s.busy);

  if (selected.length === 0) return null;

  const ready = selected.length === 2;

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-aa-border bg-aa-surface/95 px-2 py-2 shadow-lg backdrop-blur">
        <span className="px-2 text-xs text-aa-text-dim">
          {ready ? "불리언" : `${selected.length}/2 선택 — 하나 더`}
        </span>

        {ready && (
          <>
            <IconButton label="빼기 (Subtract)" onClick={() => void booleanOp("cut")} disabled={busy}>
              <SubtractIcon />
            </IconButton>
            <IconButton label="합치기 (Union)" onClick={() => void booleanOp("fuse")} disabled={busy}>
              <UnionIcon />
            </IconButton>
            <IconButton label="교집합 (Intersect)" onClick={() => void booleanOp("common")} disabled={busy}>
              <IntersectIcon />
            </IconButton>
          </>
        )}

        <div className="h-6 w-px bg-aa-border" />
        <button
          type="button"
          onClick={clearSelection}
          className="min-h-[44px] rounded-lg px-3 text-sm text-aa-text-dim aa-hoverable"
        >
          선택 해제
        </button>
      </div>
    </div>
  );
}
