/** 우상단 뷰포트 컨트롤 (Shapr3D): 스냅 설정 · 표준 뷰 · 단위 · 디스플레이 · 백엔드. */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { CameraIcon, EyeIcon, GearIcon } from "./icons";
import type { ViewPreset } from "../viewport/cameraMath";

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "정면" },
  { id: "top", label: "위" },
  { id: "right", label: "우측" },
  { id: "iso", label: "ISO" },
];

type SnapKey = "grid" | "sketchLine" | "sketchPoint" | "guide3d" | "farEdge" | "guidePoint" | "snapHint";
const SNAP_GROUP: { key: SnapKey; label: string }[] = [
  { key: "grid", label: "그리드" },
  { key: "sketchLine", label: "스케치 가이드 선" },
  { key: "sketchPoint", label: "스케치 가이드 점" },
  { key: "guide3d", label: "3D 가이드 점" },
  { key: "farEdge", label: "먼 에지" },
];
const SHOW_GROUP: { key: SnapKey; label: string }[] = [
  { key: "guidePoint", label: "가이드 점" },
  { key: "snapHint", label: "스냅핑 힌트" },
];

function ToggleRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-aa-text aa-hoverable">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[11px] text-aa-text-dim">{on ? "켬" : "끔"}</span>
        <span className={["relative h-5 w-9 rounded-full transition-colors", on ? "bg-aa-accent" : "bg-aa-surface-2"].join(" ")}>
          <span className={["absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-4" : "left-0.5"].join(" ")} />
        </span>
      </span>
    </button>
  );
}

function SnapPopup(): JSX.Element {
  const snap = useAppStore((s) => s.snap);
  const toggleSnap = useAppStore((s) => s.toggleSnap);
  return (
    <div className="w-72 rounded-xl border border-aa-border bg-aa-surface/98 p-2 shadow-xl backdrop-blur">
      <div className="px-2 py-1 text-xs font-semibold text-aa-text-dim">스냅</div>
      {SNAP_GROUP.map((r) => (
        <ToggleRow key={r.key} label={r.label} on={snap[r.key]} onClick={() => toggleSnap(r.key)} />
      ))}
      <div className="my-1 h-px bg-aa-border" />
      <div className="px-2 py-1 text-xs font-semibold text-aa-text-dim">표시</div>
      {SHOW_GROUP.map((r) => (
        <ToggleRow key={r.key} label={r.label} on={snap[r.key]} onClick={() => toggleSnap(r.key)} />
      ))}
    </div>
  );
}

export function ViewportControls(): JSX.Element {
  const setView = useAppStore((s) => s.setView);
  const backend = useAppStore((s) => s.backend);
  const setBackend = useAppStore((s) => s.setBackend);
  const [snapOpen, setSnapOpen] = useState(false);

  return (
    <div className="pointer-events-auto absolute right-64 top-14 z-20 flex flex-col items-end gap-2 p-2">
      {/* 스냅 설정 */}
      <div className="relative">
        <button
          type="button"
          title="스냅 설정"
          onClick={() => setSnapOpen((o) => !o)}
          className={["flex h-9 w-9 items-center justify-center rounded-xl border border-aa-border text-[20px] backdrop-blur", snapOpen ? "bg-aa-accent text-aa-bg" : "bg-aa-surface/90 text-aa-text"].join(" ")}
        >
          <GearIcon />
        </button>
        {snapOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setSnapOpen(false)} />
            <div className="absolute right-0 top-11 z-20">
              <SnapPopup />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-aa-border bg-aa-surface/90 p-1 backdrop-blur">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" onClick={() => setView(v.id)}
            className="min-h-[32px] rounded-md px-2 text-xs font-medium text-aa-text-dim aa-hoverable active:bg-aa-surface-2">
            {v.label}
          </button>
        ))}
        <div className="mx-0.5 h-5 w-px bg-aa-border" />
        <span className="px-1.5 text-xs font-semibold text-aa-text">0.5 mm</span>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-aa-border bg-aa-surface/90 p-1 backdrop-blur">
        <button type="button" title="커널: FAST(메시) / OCCT(B-rep)"
          onClick={() => void setBackend(backend === "occt" ? "deterministic" : "occt")}
          className={["min-h-[32px] rounded-md px-2 text-xs font-semibold", backend === "occt" ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim"].join(" ")}>
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
