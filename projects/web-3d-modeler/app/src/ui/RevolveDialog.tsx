/**
 * 회전 다이얼로그 (Shapr3D식): 각도 + 회전축(세로/가로).
 * 도구→회전 에서 열린다. 스케치가 선택돼 있어야 한다(openRevolve 가 보장).
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { RevolveAxis } from "../kernel/revolve";

export function RevolveDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.revolveOpen);
  const close = useAppStore((s) => s.closeRevolve);
  const revolveAs = useAppStore((s) => s.revolveSketchAs);
  const [angle, setAngle] = useState(360);
  const [axis, setAxis] = useState<RevolveAxis>("v");

  if (!open) return null;

  const apply = () => {
    if (angle > 0) revolveAs(angle, axis);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">회전</div>

        <label className="mb-1 block text-xs text-aa-text-dim">각도 (°)</label>
        <div className="mb-3 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="5"
            min="1"
            max="360"
            value={angle}
            onChange={(e) => setAngle(Math.min(360, Math.max(1, parseFloat(e.target.value) || 0)))}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); else if (e.key === "Escape") close(); }}
            className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent"
          />
          <div className="flex gap-1">
            {[90, 180, 360].map((v) => (
              <button key={v} type="button" onClick={() => setAngle(v)}
                className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable">{v}</button>
            ))}
          </div>
        </div>

        <label className="mb-1 block text-xs text-aa-text-dim">회전축</label>
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {([["v", "세로축"], ["u", "가로축"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAxis(id)}
              className={[
                "rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                axis === id ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-aa-text-dim">프로파일은 회전축 한쪽에 그려야 깔끔합니다 (축을 가로지르면 접힘).</p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">취소</button>
          <button type="button" onClick={apply} disabled={angle <= 0}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg disabled:opacity-40">회전</button>
        </div>
      </div>
    </>
  );
}
