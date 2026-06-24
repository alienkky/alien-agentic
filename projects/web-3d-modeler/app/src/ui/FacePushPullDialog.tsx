/**
 * 면 Push/Pull 다이얼로그 — 평면 면을 법선 방향으로 밀고(−)/당기는(+) 거리 입력.
 * ContextBar 의 면 액션에서 열린다. 부호 있는 거리(음수=밀기) 허용.
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function FacePushPullDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.facePushPullOpen);
  const close = useAppStore((s) => s.closeFacePushPull);
  const apply = useAppStore((s) => s.applyFacePushPull);
  const [value, setValue] = useState(1);

  if (!open) return null;

  const submit = () => {
    if (Math.abs(value) > 0) void apply(value);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-1 text-sm font-semibold text-aa-text">면 Push/Pull</div>
        <div className="mb-3 text-xs text-aa-text-dim">+ 당기기(grow) · − 밀기(shrink) · 법선 방향</div>

        <label className="mb-1 block text-xs text-aa-text-dim">거리 (mm)</label>
        <div className="mb-4 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") close();
            }}
            className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent"
          />
          <div className="flex gap-1">
            {[-2, -1, 1, 2].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue(v)}
                className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable"
              >
                {v > 0 ? `+${v}` : v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-aa-text aa-hoverable">
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={Math.abs(value) <= 0}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg disabled:opacity-40"
          >
            {value >= 0 ? "당기기" : "밀기"}
          </button>
        </div>
      </div>
    </>
  );
}
