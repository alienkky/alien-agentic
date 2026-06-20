/**
 * 모서리 피처 다이얼로그 — 필렛(반지름) / 모따기(거리) 단일 수치 입력.
 * ContextBar 의 모서리 액션에서 열린다. OCCT 전용(store 가 백엔드 가드).
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function EdgeFeatureDialog(): JSX.Element | null {
  const kind = useAppStore((s) => s.edgeFeatureOpen);
  const close = useAppStore((s) => s.closeEdgeFeature);
  const apply = useAppStore((s) => s.applyEdgeFeature);
  const [value, setValue] = useState(1);

  if (!kind) return null;

  const isFillet = kind === "fillet";
  const title = isFillet ? "필렛 (모깎기)" : "모따기 (챔퍼)";
  const fieldLabel = isFillet ? "반지름 (mm)" : "거리 (mm)";

  const submit = () => {
    if (value > 0) void apply(kind, value);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={close} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aa-border bg-aa-surface/98 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 text-sm font-semibold text-aa-text">{title}</div>

        <label className="mb-1 block text-xs text-aa-text-dim">{fieldLabel}</label>
        <div className="mb-4 flex items-center gap-2">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") close();
            }}
            className="w-full rounded-lg border border-aa-border bg-aa-bg px-3 py-2 text-sm text-aa-text outline-none focus:border-aa-accent"
          />
          <div className="flex gap-1">
            {[0.5, 1, 2].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue(v)}
                className="rounded-md bg-aa-bg px-2 py-2 text-xs text-aa-text-dim aa-hoverable"
              >
                {v}
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
            disabled={value <= 0}
            className="rounded-lg bg-aa-accent px-4 py-2 text-sm font-semibold text-aa-bg disabled:opacity-40"
          >
            {isFillet ? "필렛" : "모따기"}
          </button>
        </div>
      </div>
    </>
  );
}
