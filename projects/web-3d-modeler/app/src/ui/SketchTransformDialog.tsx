/**
 * 스케치 변형 다이얼로그: 미러 / 패턴(선형·원형) / 오프셋. 확정 획에 적용.
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { UVAxis } from "../kernel/sketchTransform2d";

export function SketchTransformDialog(): JSX.Element | null {
  const mode = useAppStore((s) => s.sketchTransformMode);
  const close = useAppStore((s) => s.closeSketchTransform);
  const mirror = useAppStore((s) => s.sketchMirror);
  const patLinear = useAppStore((s) => s.sketchPatternLinear);
  const patCircular = useAppStore((s) => s.sketchPatternCircular);
  const offset = useAppStore((s) => s.sketchOffset);

  const [axis, setAxis] = useState<UVAxis>("v");
  const [patKind, setPatKind] = useState<"linear" | "circular">("linear");
  const [count, setCount] = useState(4);
  const [spacing, setSpacing] = useState(5);
  const [angle, setAngle] = useState(360);
  const [dist, setDist] = useState(1);

  if (!mode) return null;
  const title = mode === "mirror" ? "미러" : mode === "pattern" ? "패턴" : "모서리 오프셋";

  const apply = () => {
    if (mode === "mirror") mirror(axis);
    else if (mode === "offset") offset(dist);
    else if (patKind === "linear") patLinear(axis, count, spacing);
    else patCircular(count, angle);
  };

  const AxisBtns = (
    <div className="grid grid-cols-2 gap-1.5">
      {([["u", "가로축(U)"], ["v", "세로축(V)"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setAxis(id)}
          className={["rounded-lg px-2 py-2 text-xs font-medium transition-colors", axis === id ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable"].join(" ")}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">{title}</div>

        {mode === "mirror" && (
          <>
            <label className="mb-1 block text-xs text-aa-text-dim">대칭 축</label>
            <div className="mb-4">{AxisBtns}</div>
          </>
        )}

        {mode === "offset" && (
          <>
            <label className="mb-1 block text-xs text-aa-text-dim">거리 (mm, 음수=반대방향)</label>
            <input autoFocus type="number" step="0.5" value={dist}
              onChange={(e) => setDist(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); else if (e.key === "Escape") close(); }}
              className="mb-4 w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
          </>
        )}

        {mode === "pattern" && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {([["linear", "선형"], ["circular", "원형"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setPatKind(id)}
                  className={["rounded-lg px-2 py-2 text-xs font-medium transition-colors", patKind === id ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable"].join(" ")}>
                  {label}
                </button>
              ))}
            </div>
            {patKind === "linear" && <div className="mb-3">{AxisBtns}</div>}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-aa-text-dim">개수</label>
                <input type="number" min="2" step="1" value={count}
                  onChange={(e) => setCount(Math.max(2, Math.floor(parseFloat(e.target.value) || 2)))}
                  className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-aa-text-dim">{patKind === "linear" ? "간격 (mm)" : "총 각도 (°)"}</label>
                {patKind === "linear" ? (
                  <input type="number" step="0.5" value={spacing} onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
                ) : (
                  <input type="number" step="5" min="1" max="360" value={angle} onChange={(e) => setAngle(Math.min(360, Math.max(1, parseFloat(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">취소</button>
          <button type="button" onClick={apply} className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg">{title}</button>
        </div>
      </div>
    </>
  );
}
