/**
 * 패턴 다이얼로그: 선형/원형 복제. 선택 바디를 축 방향 간격 또는 축 둘레 각도로 배열.
 */
import { useState } from "react";
import { useAppStore, type Axis3 } from "../store/useAppStore";

const AXES: Axis3[] = ["x", "y", "z"];

export function PatternDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.patternOpen);
  const close = useAppStore((s) => s.closePattern);
  const linear = useAppStore((s) => s.patternLinear);
  const circular = useAppStore((s) => s.patternCircular);

  const [kind, setKind] = useState<"linear" | "circular">("linear");
  const [axis, setAxis] = useState<Axis3>("x");
  const [count, setCount] = useState(4);
  const [spacing, setSpacing] = useState(5);
  const [angle, setAngle] = useState(360);

  if (!open) return null;

  const apply = () => {
    if (count < 2) return;
    if (kind === "linear") linear(axis, count, spacing);
    else circular(axis, count, angle);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">패턴</div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {([["linear", "선형"], ["circular", "원형"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setKind(id)}
              className={["rounded-lg px-2 py-2 text-xs font-medium transition-colors", kind === id ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable"].join(" ")}>
              {label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-aa-text-dim">{kind === "linear" ? "방향 축" : "회전 축"}</label>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {AXES.map((a) => (
            <button key={a} type="button" onClick={() => setAxis(a)}
              className={["rounded-lg px-2 py-2 text-xs font-medium uppercase transition-colors", axis === a ? "bg-aa-accent text-aa-bg" : "bg-aa-bg text-aa-text aa-hoverable"].join(" ")}>
              {a}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-aa-text-dim">개수</label>
            <input type="number" min="2" step="1" value={count}
              onChange={(e) => setCount(Math.max(2, Math.floor(parseFloat(e.target.value) || 2)))}
              className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-aa-text-dim">{kind === "linear" ? "간격 (mm)" : "총 각도 (°)"}</label>
            {kind === "linear" ? (
              <input type="number" step="0.5" value={spacing}
                onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
            ) : (
              <input type="number" step="5" min="1" max="360" value={angle}
                onChange={(e) => setAngle(Math.min(360, Math.max(1, parseFloat(e.target.value) || 1)))}
                className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent" />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">취소</button>
          <button type="button" onClick={apply} disabled={count < 2}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg disabled:opacity-40">패턴</button>
        </div>
      </div>
    </>
  );
}
