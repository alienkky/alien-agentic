/**
 * 스케치 모드 하단 바 — 점 되돌리기 · 돌출 · 취소.
 * 스케치 활성일 때만 ContextBar 대신 표시.
 */
import { IconButton } from "./IconButton";
import { UndoIcon, ExtrudeIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";

const EXTRUDE_DEPTH = 4;

export function SketchBar(): JSX.Element | null {
  const active = useAppStore((s) => s.sketchActive);
  const count = useAppStore((s) => s.sketchPoints.length);
  const undoSketchPoint = useAppStore((s) => s.undoSketchPoint);
  const commitExtrude = useAppStore((s) => s.commitExtrude);
  const cancelSketch = useAppStore((s) => s.cancelSketch);

  if (!active) return null;

  const canExtrude = count >= 3;

  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-aa-border bg-aa-surface/95 px-2 py-2 shadow-lg backdrop-blur">
        <span className="px-2 text-xs text-aa-text-dim">
          스케치 · 점 {count}개 {canExtrude ? "" : "(3개 이상 필요)"}
        </span>
        <IconButton label="점 되돌리기" onClick={undoSketchPoint} disabled={count === 0}>
          <UndoIcon />
        </IconButton>
        <button
          type="button"
          onClick={() => commitExtrude(EXTRUDE_DEPTH)}
          disabled={!canExtrude}
          className={[
            "flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
            canExtrude ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim opacity-50",
          ].join(" ")}
        >
          <span className="text-[18px]">
            <ExtrudeIcon />
          </span>
          돌출 (높이 {EXTRUDE_DEPTH})
        </button>
        <div className="h-6 w-px bg-aa-border" />
        <button
          type="button"
          onClick={cancelSketch}
          className="min-h-[44px] rounded-lg px-3 text-sm text-aa-text-dim aa-hoverable"
        >
          취소
        </button>
      </div>
    </div>
  );
}
