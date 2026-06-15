/**
 * 돌출 다이얼로그 (Shapr3D식): 높이 입력 + 방식(새 바디/빼기/합치기).
 * 도구→돌출 에서 열린다. 스케치가 선택돼 있어야 한다(openExtrude 가 보장).
 */
import { useState } from "react";
import { useAppStore, type ExtrudeMode } from "../store/useAppStore";

const MODES: { id: ExtrudeMode; label: string; hint: string }[] = [
  { id: "new", label: "새 바디", hint: "독립된 새 솔리드로 생성" },
  { id: "cut", label: "빼기", hint: "겹친 바디에서 깎아냄 (구멍)" },
  { id: "fuse", label: "합치기", hint: "겹친 바디에 더함" },
];

export function ExtrudeDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.extrudeOpen);
  const close = useAppStore((s) => s.closeExtrude);
  const extrudeAs = useAppStore((s) => s.extrudeSketchAs);
  const [depth, setDepth] = useState(4);
  const [mode, setMode] = useState<ExtrudeMode>("new");

  if (!open) return null;

  const apply = () => {
    if (depth > 0) extrudeAs(depth, mode);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">돌출</div>

        <label className="mb-1 block text-xs text-aa-text-dim">높이 (mm)</label>
        <div className="mb-3 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.5"
            value={depth}
            onChange={(e) => setDepth(parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); else if (e.key === "Escape") close(); }}
            className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent"
          />
          <div className="flex gap-1">
            {[2, 4, 8].map((v) => (
              <button key={v} type="button" onClick={() => setDepth(v)}
                className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable">{v}</button>
            ))}
          </div>
        </div>

        <label className="mb-1 block text-xs text-aa-text-dim">방식</label>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={[
                "rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                mode === m.id ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-aa-text-dim">{MODES.find((m) => m.id === mode)!.hint}</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">취소</button>
          <button type="button" onClick={apply} disabled={depth <= 0}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg disabled:opacity-40">돌출</button>
        </div>
      </div>
    </>
  );
}
