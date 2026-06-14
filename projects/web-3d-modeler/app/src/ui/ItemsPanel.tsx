/**
 * 좌측 항목(Items) 패널 (Shapr3D): "모든 항목" 목록.
 * 행 클릭 = 바디 선택, 휴지통 = 삭제.
 */
import { TrashIcon } from "./icons";
import { useAppStore, selectionBodyIds } from "../store/useAppStore";

export function ItemsPanel(): JSX.Element | null {
  const shapes = useAppStore((s) => s.shapes);
  const selection = useAppStore((s) => s.selection);
  const selectEntity = useAppStore((s) => s.selectEntity);
  const removeShape = useAppStore((s) => s.removeShape);
  const clear = useAppStore((s) => s.clear);
  const show = useAppStore((s) => s.panels.items);

  if (!show) return null;
  const bodyIds = selectionBodyIds(selection);

  return (
    <div className="pointer-events-auto absolute left-0 top-12 bottom-0 z-20 flex w-44 flex-col border-r border-aa-border bg-aa-surface/95 backdrop-blur">
      <div className="border-b border-aa-border px-3 py-2.5">
        <span className="text-sm font-semibold text-aa-text">항목</span>
        <div className="mt-1.5 flex items-center justify-between rounded-md bg-aa-bg px-2 py-1.5 text-xs text-aa-text">
          모든 항목 <span className="text-aa-text-dim">▾</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {shapes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <p className="text-sm font-medium text-aa-text">작업공간이 비어 있습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-aa-text-dim">
              모델링을 시작하면 여기에 항목이 표시됩니다
            </p>
          </div>
        ) : (
          shapes.map((m) => {
            const isSel = bodyIds.includes(m.shapeId);
            return (
              <div
                key={m.shapeId}
                className={[
                  "group flex items-center gap-2 rounded-lg px-2 py-1.5",
                  isSel ? "bg-aa-accent/15" : "aa-hoverable",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => selectEntity({ kind: "body", shapeId: m.shapeId, index: -1 })}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className={["h-2 w-2 rounded-full", isSel ? "bg-aa-accent" : "bg-aa-text-dim"].join(" ")} />
                  <span className="truncate text-xs text-aa-text">{m.shapeId}</span>
                </button>
                <button
                  type="button"
                  title="삭제"
                  aria-label={`${m.shapeId} 삭제`}
                  onClick={() => void removeShape(m.shapeId)}
                  className="text-[16px] text-aa-text-dim opacity-60 transition-opacity hover:text-aa-text group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })
        )}
      </div>

      {shapes.length > 0 && (
        <button
          type="button"
          onClick={() => void clear()}
          className="border-t border-aa-border px-3 py-2 text-xs text-aa-text-dim aa-hoverable"
        >
          전체 삭제
        </button>
      )}
    </div>
  );
}
