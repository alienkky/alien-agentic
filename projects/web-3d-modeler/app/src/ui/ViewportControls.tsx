/** 우상단 뷰포트 컨트롤 (Shapr3D): 표준 뷰(네비) · 단위 · 디스플레이 모드 · 스크린샷 · 백엔드. */
import { useAppStore } from "../store/useAppStore";
import { CameraIcon, EyeIcon } from "./icons";
import type { ViewPreset } from "../viewport/cameraMath";

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "정면" },
  { id: "top", label: "위" },
  { id: "right", label: "우측" },
  { id: "iso", label: "ISO" },
];

export function ViewportControls(): JSX.Element {
  const setView = useAppStore((s) => s.setView);
  const backend = useAppStore((s) => s.backend);
  const setBackend = useAppStore((s) => s.setBackend);

  return (
    <div className="pointer-events-auto absolute right-64 top-14 z-20 flex flex-col items-end gap-2 p-2">
      <div className="flex items-center gap-1 rounded-xl border border-aa-border bg-aa-surface/90 p-1 backdrop-blur">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className="min-h-[32px] rounded-md px-2 text-xs font-medium text-aa-text-dim aa-hoverable active:bg-aa-surface-2"
          >
            {v.label}
          </button>
        ))}
        <div className="mx-0.5 h-5 w-px bg-aa-border" />
        <span className="px-1.5 text-xs font-semibold text-aa-text">1 mm</span>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-aa-border bg-aa-surface/90 p-1 backdrop-blur">
        <button
          type="button"
          title="커널: FAST(메시) / OCCT(B-rep)"
          onClick={() => void setBackend(backend === "occt" ? "deterministic" : "occt")}
          className={[
            "min-h-[32px] rounded-md px-2 text-xs font-semibold",
            backend === "occt" ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim",
          ].join(" ")}
        >
          {backend === "occt" ? "OCCT" : "FAST"}
        </button>
        <button type="button" title="디스플레이 모드: 음영" className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text aa-hoverable">
          <EyeIcon />
        </button>
        <button type="button" title="스크린 샷 (준비 중)" className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text aa-hoverable">
          <CameraIcon />
        </button>
      </div>
    </div>
  );
}
