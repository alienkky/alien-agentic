/**
 * 우측 내역(History) 패널 (Shapr3D): 단계별 작업 히스토리.
 * 명세 Module 1.2(HistoryTreeManager) 의 시각 토대 — 현재는 작업 로그 나열.
 */
import { useAppStore } from "../store/useAppStore";

export function HistoryPanel(): JSX.Element {
  const history = useAppStore((s) => s.history);

  return (
    <div className="pointer-events-auto absolute right-0 top-12 bottom-0 z-20 flex w-60 flex-col border-l border-aa-border bg-aa-surface/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-aa-border px-3 py-2.5">
        <span className="flex items-center gap-1 text-sm font-semibold text-aa-text">
          내역 <span className="text-aa-text-dim">▾</span>
        </span>
        <button type="button" className="rounded-md px-2 py-0.5 text-xs text-aa-text-dim aa-hoverable">선택</button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium text-aa-text">작업공간이 비어 있습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-aa-text-dim">
              모델링을 시작하면 여기에 단계별 히스토리가 표시됩니다
            </p>
          </div>
        ) : (
          history.map((h, i) => (
            <div key={h.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 aa-hoverable">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-aa-surface-2 text-[10px] font-bold text-aa-text-dim">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-xs text-aa-text">{h.label}</span>
              <span className="truncate text-[10px] text-aa-text-dim">{h.id}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
