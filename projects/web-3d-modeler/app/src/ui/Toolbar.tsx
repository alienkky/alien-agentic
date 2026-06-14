/** 상단 툴바 — Phase 0 핵심 도구. 터치 타깃을 넉넉히(본진이 손가락). */
import { useAppStore } from "../store/useAppStore";

function ToolButton({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "min-h-[44px] min-w-[44px] rounded-lg px-4 text-sm font-medium transition-colors",
        "border border-aa-border",
        active ? "bg-aa-accent text-aa-bg" : "bg-aa-surface text-aa-text aa-hoverable",
        disabled ? "opacity-40" : "active:bg-aa-surface-2",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function Toolbar(): JSX.Element {
  const addBox = useAppStore((s) => s.addBox);
  const clear = useAppStore((s) => s.clear);
  const resetCamera = useAppStore((s) => s.resetCamera);
  const backend = useAppStore((s) => s.backend);
  const setBackend = useAppStore((s) => s.setBackend);
  const busy = useAppStore((s) => s.busy);

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-aa-border bg-aa-surface/90 p-2 backdrop-blur">
        <span className="px-2 text-sm font-semibold tracking-wide text-aa-accent">Nebula</span>
        <div className="h-6 w-px bg-aa-border" />
        <ToolButton label="＋ Box" onClick={() => void addBox()} disabled={busy} />
        <ToolButton label="비우기" onClick={clear} />
        <ToolButton label="카메라 리셋" onClick={resetCamera} />
        <div className="h-6 w-px bg-aa-border" />
        <ToolButton
          label="결정론적"
          onClick={() => void setBackend("deterministic")}
          active={backend === "deterministic"}
        />
        <ToolButton
          label="OCCT"
          onClick={() => void setBackend("occt")}
          active={backend === "occt"}
        />
      </div>
    </div>
  );
}
