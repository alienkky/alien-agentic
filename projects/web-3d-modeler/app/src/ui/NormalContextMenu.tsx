/**
 * 일반(모델링) 모드 우클릭 컨텍스트 메뉴 (Shapr3D).
 * 선택이 없으면 배경 메뉴, 있으면 항목 메뉴(면에 스케치/표시·숨기기 등).
 */
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

interface Pos { x: number; y: number }
interface Item { label: string; shortcut?: string; checked?: boolean; divider?: boolean; onClick: () => void }

export function NormalContextMenu(): JSX.Element | null {
  const [pos, setPos] = useState<Pos | null>(null);
  const s = useAppStore();

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      if (useAppStore.getState().sketchActive) return; // 스케치 모드는 별도 메뉴
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, []);

  if (pos === null || s.sketchActive) return null;
  const close = () => setPos(null);
  const run = (fn: () => void) => () => { fn(); close(); };
  const soon = (n: string) => run(() => s.setStatus(`${n} — 준비 중`));
  const hasSel = s.selection.length > 0;

  const common: Item[] = [
    { label: "그리드 표시", checked: s.showGrid, onClick: run(s.toggleGrid) },
    { label: "월드 축 표시", checked: s.showAxes, onClick: run(s.toggleAxes) },
    { label: "에지 표시", checked: s.showEdges, onClick: run(s.toggleEdges) },
    { label: "숨긴 모서리 표시", onClick: soon("숨긴 모서리") },
  ];

  const items: Item[] = hasSel
    ? [
        { label: "모두 선택", shortcut: "Ctrl+A", onClick: run(s.selectAll) },
        { label: "이 지점을 통해 선택...", onClick: soon("관통 선택") },
        { label: "면에 스케치", divider: true, onClick: run(s.beginSketch) },
        { label: "단면 보기", onClick: soon("단면 보기") },
        { label: "표시/숨기기", shortcut: "Ctrl+Shift+H", divider: true, onClick: run(s.hideSelectedBodies) },
        { label: "격리", onClick: soon("격리") },
        { label: "확대/축소", divider: true, onClick: soon("확대/축소") },
        ...common,
        { label: "항목 사이드바에 표시", shortcut: "Shift+Alt+I", checked: s.panels.items, onClick: run(() => s.togglePanel("items")) },
        { label: "명령어 검색", shortcut: "Ctrl+F", divider: true, onClick: soon("명령어 검색") },
      ]
    : [
        { label: "모두 선택", shortcut: "Ctrl+A", onClick: run(s.selectAll) },
        { label: "그리드 표시", divider: true, checked: s.showGrid, onClick: run(s.toggleGrid) },
        { label: "월드 축 표시", checked: s.showAxes, onClick: run(s.toggleAxes) },
        { label: "에지 표시", checked: s.showEdges, onClick: run(s.toggleEdges) },
        { label: "숨긴 모서리 표시", onClick: soon("숨긴 모서리") },
        { label: "숨겨진 바디 표시", shortcut: "Alt+H", onClick: run(s.showAllBodies) },
        { label: "바디 표시 반전", shortcut: "Shift+Alt+H", onClick: run(s.invertBodyVisibility) },
        { label: "명령어 검색", shortcut: "Ctrl+F", divider: true, onClick: soon("명령어 검색") },
      ];

  const left = Math.min(pos.x, window.innerWidth - 260);
  const top = Math.min(pos.y, window.innerHeight - items.length * 34 - 16);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
      <div className="fixed z-50 w-60 rounded-lg border border-aa-border bg-aa-surface/98 p-1 shadow-xl backdrop-blur" style={{ left, top }}>
        {items.map((it, i) => (
          <div key={i}>
            {it.divider && <div className="my-1 h-px bg-aa-border" />}
            <button type="button" onClick={it.onClick} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-aa-text aa-hoverable">
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
