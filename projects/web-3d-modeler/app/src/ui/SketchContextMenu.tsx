/**
 * 스케치 모드 우클릭 컨텍스트 메뉴 (Shapr3D).
 * 스케칭 종료 · 모두 선택 · 에지 표시 · 숨긴/숨겨진 표시 · 명령어 검색.
 * Esc 로도 스케칭 종료.
 */
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

interface Pos {
  x: number;
  y: number;
}

export function SketchContextMenu(): JSX.Element | null {
  const sketchActive = useAppStore((s) => s.sketchActive);
  const showEdges = useAppStore((s) => s.showEdges);
  const [pos, setPos] = useState<Pos | null>(null);

  const cancelSketch = useAppStore((s) => s.cancelSketch);
  const selectAll = useAppStore((s) => s.selectAll);
  const toggleEdges = useAppStore((s) => s.toggleEdges);
  const setStatus = useAppStore((s) => s.setStatus);

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      if (!useAppStore.getState().sketchActive) return;
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
    };
    const onKey = (e: KeyboardEvent) => {
      const st = useAppStore.getState();
      if (!st.sketchActive) return;
      if (e.key === "Escape") {
        // 선 그리는 중이면 선만 종료(선택 모드로), 아니면 스케치 종료
        if (st.sketchLineDrawing) st.finishLine();
        else st.cancelSketch();
        setPos(null);
      }
    };
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!sketchActive || !pos) return null;
  const close = () => setPos(null);
  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const items = [
    { label: "스케칭 종료", shortcut: "Esc", onClick: run(cancelSketch) },
    { label: "모두 선택", shortcut: "Ctrl+A", onClick: run(selectAll) },
    { label: "에지 표시", checked: showEdges, onClick: run(toggleEdges), divider: true },
    { label: "숨긴 모서리 표시", onClick: run(() => setStatus("숨긴 모서리 — 준비 중")) },
    { label: "숨겨진 바디 표시", shortcut: "Alt+H", onClick: run(() => setStatus("숨겨진 바디 — 준비 중")) },
    { label: "바디 표시 반전", shortcut: "Shift+Alt+H", onClick: run(() => setStatus("표시 반전 — 준비 중")) },
    { label: "명령어 검색", shortcut: "Ctrl+F", divider: true, onClick: run(() => setStatus("명령어 검색 — 준비 중")) },
  ];

  const left = Math.min(pos.x, window.innerWidth - 240);
  const top = Math.min(pos.y, window.innerHeight - items.length * 36 - 16);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
      <div className="fixed z-50 w-56 rounded-lg border border-aa-border bg-aa-surface/98 p-1 shadow-xl backdrop-blur" style={{ left, top }}>
        {items.map((it, i) => (
          <div key={i}>
            {it.divider && <div className="my-1 h-px bg-aa-border" />}
            <button
              type="button"
              onClick={it.onClick}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-aa-text aa-hoverable"
            >
              <span className="w-4 text-aa-accent">{it.checked ? "✓" : ""}</span>
              <span className="flex-1">{it.label}</span>
              {it.shortcut && <span className="text-[10px] text-aa-text-dim">{it.shortcut}</span>}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
