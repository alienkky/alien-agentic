/**
 * 드래그로 옮길 수 있는 떠다니는 패널. 헤더(그립)를 끌어 위치 이동.
 * 기본 위치는 px(left/top). 화면 밖으로 못 나가게 클램프.
 */
import { useRef, useState, type ReactNode } from "react";

export function DraggablePanel({
  title,
  defaultLeft,
  defaultTop,
  width = 176,
  children,
}: {
  title: string;
  defaultLeft: number;
  defaultTop: number;
  width?: number;
  children: ReactNode;
}): JSX.Element {
  const [pos, setPos] = useState({ x: defaultLeft, y: defaultTop });
  const drag = useRef<{ ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - width, e.clientX - drag.current.ox));
    const y = Math.max(48, Math.min(window.innerHeight - 60, e.clientY - drag.current.oy));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  return (
    <div className="pointer-events-auto fixed z-20" style={{ left: pos.x, top: pos.y, width }}>
      <div className="overflow-hidden rounded-2xl border border-aa-border bg-aa-surface/95 backdrop-blur">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="flex cursor-move touch-none items-center gap-1.5 border-b border-aa-border px-2.5 py-1.5 text-xs font-semibold text-aa-text-dim"
        >
          <span className="text-aa-text-dim">⠿</span>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
