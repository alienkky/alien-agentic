/** 하단 좌측 슬림 상태 표시 — 상태 메시지 + 디바이스(폴더블 인지). */
import { useAppStore } from "../store/useAppStore";
import type { ScreenLayout } from "../device/posture";

export function StatusPill({ layout }: { layout: ScreenLayout }): JSX.Element {
  const status = useAppStore((s) => s.status);

  const deviceLabel =
    layout.posture === "folded"
      ? "폴더블(접힘)"
      : layout.horizontalSegments >= 2
        ? "폴더블(펼침)"
        : "단일";

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto rounded-lg border border-aa-border bg-aa-surface/80 px-3 py-1.5 text-xs text-aa-text-dim backdrop-blur">
        {status} · {deviceLabel}
      </div>
    </div>
  );
}
