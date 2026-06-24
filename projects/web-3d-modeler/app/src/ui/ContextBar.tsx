/**
 * 하단 컨텍스트 액션바 (Shapr3D 의 선택 컨텍스트 툴바 대응).
 * 선택이 있을 때만 등장. 2개 선택 → 불리언(빼기/합치기/교집합).
 */
import { IconButton } from "./IconButton";
import { SubtractIcon, UnionIcon, IntersectIcon } from "./icons";
import { useAppStore, selectionBodyIds, selectionEdges, selectionFace } from "../store/useAppStore";

export function ContextBar(): JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const openEdgeFeature = useAppStore((s) => s.openEdgeFeature);
  const openFacePushPull = useAppStore((s) => s.openFacePushPull);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const busy = useAppStore((s) => s.busy);

  if (selection.length === 0) return null;

  const bodyCount = selectionBodyIds(selection).length;
  const ready = bodyCount >= 2;
  const edges = selectionEdges(selection);
  const face = selectionFace(selection);

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-aa-border bg-aa-surface/95 px-2 py-2 shadow-lg backdrop-blur">
        {edges ? (
          <>
            <span className="px-2 text-xs text-aa-text-dim">모서리 {edges.edgeIds.length}개</span>
            <button
              type="button"
              onClick={() => openEdgeFeature("fillet")}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-aa-bg px-3 text-sm text-aa-text aa-hoverable disabled:opacity-40"
            >
              필렛 (반지름)
            </button>
            <button
              type="button"
              onClick={() => openEdgeFeature("chamfer")}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-aa-bg px-3 text-sm text-aa-text aa-hoverable disabled:opacity-40"
            >
              모따기 (거리)
            </button>
            <div className="h-6 w-px bg-aa-border" />
          </>
        ) : face ? (
          <>
            <span className="px-2 text-xs text-aa-text-dim">면 1개</span>
            <button
              type="button"
              onClick={openFacePushPull}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-aa-bg px-3 text-sm text-aa-text aa-hoverable disabled:opacity-40"
            >
              Push/Pull (거리)
            </button>
            <div className="h-6 w-px bg-aa-border" />
          </>
        ) : (
          <>
            <span className="px-2 text-xs text-aa-text-dim">
              {ready ? "불리언" : `바디 ${bodyCount}/2 — 하나 더`}
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
          </>
        )}

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
