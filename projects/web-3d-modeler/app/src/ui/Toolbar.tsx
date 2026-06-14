/** 상단 툴바 — Phase 1 도구. 터치 타깃을 넉넉히(본진이 손가락). */
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
        "min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors",
        "border border-aa-border",
        active ? "bg-aa-accent text-aa-bg" : "bg-aa-surface text-aa-text aa-hoverable",
        disabled ? "opacity-40" : "active:bg-aa-surface-2",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Divider(): JSX.Element {
  return <div className="h-6 w-px bg-aa-border" />;
}

export function Toolbar(): JSX.Element {
  const addPrimitive = useAppStore((s) => s.addPrimitive);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const clear = useAppStore((s) => s.clear);
  const resetCamera = useAppStore((s) => s.resetCamera);
  const backend = useAppStore((s) => s.backend);
  const setBackend = useAppStore((s) => s.setBackend);
  const busy = useAppStore((s) => s.busy);
  const selectedCount = useAppStore((s) => s.selectedShapeIds.length);

  const canBool = selectedCount >= 2 && backend === "occt" && !busy;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex justify-center p-3">
      <div className="pointer-events-auto flex max-w-[96vw] flex-wrap items-center justify-center gap-2 rounded-xl border border-aa-border bg-aa-surface/90 p-2 backdrop-blur">
        <span className="px-2 text-sm font-semibold tracking-widest text-aa-accent">ALIEN SPACE</span>
        <Divider />
        <ToolButton label="＋ Box" onClick={() => void addPrimitive("box")} disabled={busy} />
        <ToolButton label="＋ Cyl" onClick={() => void addPrimitive("cylinder")} disabled={busy} />
        <ToolButton label="＋ Sphere" onClick={() => void addPrimitive("sphere")} disabled={busy} />
        <Divider />
        <ToolButton label="빼기" onClick={() => void booleanOp("cut")} disabled={!canBool} />
        <ToolButton label="합치기" onClick={() => void booleanOp("fuse")} disabled={!canBool} />
        <ToolButton label="교집합" onClick={() => void booleanOp("common")} disabled={!canBool} />
        <Divider />
        <ToolButton label="비우기" onClick={() => void clear()} />
        <ToolButton label="카메라 리셋" onClick={resetCamera} />
        <Divider />
        <ToolButton
          label="결정론적"
          onClick={() => void setBackend("deterministic")}
          active={backend === "deterministic"}
        />
        <ToolButton label="OCCT" onClick={() => void setBackend("occt")} active={backend === "occt"} />
      </div>
    </div>
  );
}
