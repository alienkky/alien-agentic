/**
 * 상단 바 (Shapr3D 톤): 브랜드 · 실행취소 · 표준 뷰(네비큐브 대응) · 백엔드.
 */
import { IconButton } from "./IconButton";
import { UndoIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";
import type { ViewPreset } from "../viewport/cameraMath";

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "정면" },
  { id: "top", label: "위" },
  { id: "right", label: "우측" },
  { id: "iso", label: "ISO" },
];

export function TopBar(): JSX.Element {
  const undoLast = useAppStore((s) => s.undoLast);
  const setView = useAppStore((s) => s.setView);
  const backend = useAppStore((s) => s.backend);
  const setBackend = useAppStore((s) => s.setBackend);
  const shapeCount = useAppStore((s) => s.shapes.length);

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3">
      {/* 좌: 브랜드 + 실행취소 */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-aa-border bg-aa-surface/90 px-3 py-1.5 backdrop-blur">
        <span className="text-sm font-semibold tracking-[0.2em] text-aa-accent">ALIEN SPACE</span>
        <div className="h-5 w-px bg-aa-border" />
        <IconButton label="실행취소" onClick={() => void undoLast()} disabled={shapeCount === 0}>
          <UndoIcon />
        </IconButton>
      </div>

      {/* 우: 표준 뷰 + 백엔드 */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-aa-border bg-aa-surface/90 p-1.5 backdrop-blur">
        <div className="flex items-center gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className="min-h-[36px] rounded-md px-2 text-xs font-medium text-aa-text-dim aa-hoverable active:bg-aa-surface-2"
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-aa-border" />
        <button
          type="button"
          onClick={() => void setBackend(backend === "occt" ? "deterministic" : "occt")}
          title="커널 백엔드 전환 (불리언은 OCCT 필요)"
          className={[
            "min-h-[36px] rounded-md px-2.5 text-xs font-semibold transition-colors",
            backend === "occt" ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim",
          ].join(" ")}
        >
          {backend === "occt" ? "OCCT" : "FAST"}
        </button>
      </div>
    </div>
  );
}
