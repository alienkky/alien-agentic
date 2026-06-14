/**
 * 우측 바디 패널 (Shapr3D 의 "Items" 패널 대응).
 * 생성된 솔리드 목록 — 행 클릭으로 선택(불리언 대상), 휴지통으로 삭제.
 */
import { TrashIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";

export function ItemsPanel(): JSX.Element {
  const shapes = useAppStore((s) => s.shapes);
  const selected = useAppStore((s) => s.selectedShapeIds);
  const toggleShapeSelection = useAppStore((s) => s.toggleShapeSelection);
  const removeShape = useAppStore((s) => s.removeShape);
  const clear = useAppStore((s) => s.clear);

  return (
    <div className="pointer-events-auto absolute right-3 top-16 z-10 flex max-h-[70vh] w-56 flex-col rounded-2xl border border-aa-border bg-aa-surface/90 backdrop-blur">
      <div className="flex items-center justify-between border-b border-aa-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-aa-text">바디 ({shapes.length})</span>
        {shapes.length > 0 && (
          <button
            type="button"
            onClick={() => void clear()}
            className="text-xs text-aa-text-dim aa-hoverable rounded px-1.5 py-0.5"
          >
            전체 삭제
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {shapes.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-aa-text-dim">
            왼쪽 도구로 박스·실린더·구를 추가하세요. 두 개를 선택하면 불리언(빼기/합치기/교집합)이 켜집니다.
          </p>
        ) : (
          shapes.map((m, i) => {
            const isSel = selected.includes(m.shapeId);
            const order = selected.indexOf(m.shapeId);
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
                  onClick={() => toggleShapeSelection(m.shapeId)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                      isSel ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim",
                    ].join(" ")}
                  >
                    {isSel ? order + 1 : i + 1}
                  </span>
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
    </div>
  );
}
