/** 하단 상태바 — 상태 메시지 + 디바이스 레이아웃(폴더블 인지) 표시. */
import { useAppStore } from "../store/useAppStore";
import type { ScreenLayout } from "../device/posture";

export function StatusBar({ layout }: { layout: ScreenLayout }): JSX.Element {
  const status = useAppStore((s) => s.status);
  const shapes = useAppStore((s) => s.shapes);

  const deviceLabel =
    layout.posture === "folded"
      ? "폴더블(접힘)"
      : layout.horizontalSegments >= 2
        ? "폴더블(펼침·분할)"
        : "단일 화면";

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex justify-between gap-2 p-3 text-xs text-aa-text-dim">
      <div className="pointer-events-auto rounded-lg border border-aa-border bg-aa-surface/90 px-3 py-2 backdrop-blur">
        {status}
      </div>
      <div className="pointer-events-auto rounded-lg border border-aa-border bg-aa-surface/90 px-3 py-2 backdrop-blur">
        셰이프 {shapes.length} · {deviceLabel} · {layout.width}×{layout.height}
      </div>
    </div>
  );
}
