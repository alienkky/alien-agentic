/**
 * 우측 구속조건 패널 (스케치 모드). Shapr3D 구속 버튼 세트.
 * 현재는 시각/플레이스홀더 — 실제 구속 솔버는 명세 Module 7(PlaneGCS) 에서.
 */
import { useAppStore } from "../store/useAppStore";
import { GearIcon } from "./icons";

const CONSTRAINTS: { label: string; shortcut?: string }[] = [
  { label: "평행", shortcut: "⇧A" },
  { label: "수직", shortcut: "⇧P" },
  { label: "접선", shortcut: "⇧T" },
  { label: "일치", shortcut: "⇧N" },
  { label: "중간점", shortcut: "⇧M" },
  { label: "동심", shortcut: "⇧C" },
  { label: "수평/수직", shortcut: "⇧V" },
  { label: "동일", shortcut: "⇧E" },
  { label: "대칭", shortcut: "⇧S" },
  { label: "분리" },
  { label: "잠금", shortcut: "⇧L" },
  { label: "구성 만들기" },
];

export function SketchConstraintsPanel(): JSX.Element | null {
  const sketchActive = useAppStore((s) => s.sketchActive);
  const setStatus = useAppStore((s) => s.setStatus);

  if (!sketchActive) return null;

  return (
    <div className="pointer-events-auto absolute right-64 top-28 z-20 w-44 rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
      <button
        type="button"
        onClick={() => setStatus("구속조건 설정 — 준비 중")}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-aa-text aa-hoverable"
      >
        <span className="flex h-5 w-5 items-center justify-center text-[18px]">
          <GearIcon />
        </span>
        구속조건 설정
      </button>
      <div className="my-1 h-px bg-aa-border" />
      {CONSTRAINTS.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => setStatus(`구속: ${c.label} — 준비 중`)}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-aa-text aa-hoverable"
        >
          <span>{c.label}</span>
          {c.shortcut && <span className="text-[10px] text-aa-text-dim">{c.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
