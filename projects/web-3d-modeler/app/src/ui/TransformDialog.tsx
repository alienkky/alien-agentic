/**
 * 바디 변형 다이얼로그: 회전 / 스케일 / 미러. 모두 바디 중심 기준 제자리 변형.
 * transformMode 로 어떤 폼을 보일지 결정한다.
 */
import { useState } from "react";
import { useAppStore, type Axis3 } from "../store/useAppStore";

const AXES: Axis3[] = ["x", "y", "z"];

function AxisPicker({ axis, setAxis }: { axis: Axis3; setAxis: (a: Axis3) => void }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {AXES.map((a) => (
        <button key={a} type="button" onClick={() => setAxis(a)}
          className={["rounded-lg px-2 py-2 text-xs font-medium uppercase transition-colors", axis === a ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable"].join(" ")}>
          {a}
        </button>
      ))}
    </div>
  );
}

export function TransformDialog(): JSX.Element | null {
  const mode = useAppStore((s) => s.transformMode);
  const close = useAppStore((s) => s.closeTransform);
  const rotateBody = useAppStore((s) => s.rotateBody);
  const scaleBody = useAppStore((s) => s.scaleBody);
  const mirrorBody = useAppStore((s) => s.mirrorBody);

  const [axis, setAxis] = useState<Axis3>("z");
  const [angle, setAngle] = useState(90);
  const [factor, setFactor] = useState(2);

  if (!mode) return null;
  const title = mode === "rotate" ? "회전" : mode === "scale" ? "스케일" : "미러";

  const apply = () => {
    if (mode === "rotate") rotateBody(axis, angle);
    else if (mode === "scale") { if (factor > 0) scaleBody(factor); }
    else mirrorBody(axis);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">{title}</div>

        {mode !== "scale" && (
          <>
            <label className="mb-1 block text-xs text-aa-text-dim">{mode === "rotate" ? "회전 축" : "대칭 축"}</label>
            <div className="mb-3"><AxisPicker axis={axis} setAxis={setAxis} /></div>
          </>
        )}

        {mode === "rotate" && (
          <>
            <label className="mb-1 block text-xs text-aa-text-dim">각도 (°)</label>
            <div className="mb-4 flex items-center gap-2">
              <input autoFocus type="number" step="5" value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === "Enter") apply(); else if (e.key === "Escape") close(); }}
                className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
              <div className="flex gap-1">
                {[45, 90, 180].map((v) => (
                  <button key={v} type="button" onClick={() => setAngle(v)}
                    className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable">{v}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === "scale" && (
          <>
            <label className="mb-1 block text-xs text-aa-text-dim">배율</label>
            <div className="mb-4 flex items-center gap-2">
              <input autoFocus type="number" step="0.1" min="0.1" value={factor}
                onChange={(e) => setFactor(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === "Enter") apply(); else if (e.key === "Escape") close(); }}
                className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
              <div className="flex gap-1">
                {[0.5, 2, 3].map((v) => (
                  <button key={v} type="button" onClick={() => setFactor(v)}
                    className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable">×{v}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === "mirror" && <p className="mb-4 text-[11px] leading-relaxed text-aa-text-dim">바디 중심을 지나는 평면 기준으로 좌우 반전합니다.</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">취소</button>
          <button type="button" onClick={apply}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg">{title}</button>
        </div>
      </div>
    </>
  );
}
