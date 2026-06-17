/**
 * 우측 구속조건 패널 (스케치 모드). Shapr3D 구속 버튼 세트.
 * 현재는 시각/플레이스홀더 — 실제 구속 솔버는 명세 Module 7(PlaneGCS) 에서.
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { GearIcon } from "./icons";
import { DraggablePanel } from "./DraggablePanel";

function Toggle({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={["relative h-5 w-9 rounded-full transition-colors", on ? "bg-aa-accent" : "bg-aa-surface-2"].join(" ")}>
      <span className={["absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-4" : "left-0.5"].join(" ")} />
    </span>
  );
}

function ConstraintSettingsPopup({ onClose }: { onClose: () => void }): JSX.Element {
  const prefs = useAppStore((s) => s.sketchPrefs);
  const setPref = useAppStore((s) => s.setSketchPref);
  return (
    <>
      <div className="fixed inset-0 z-0" onClick={onClose} />
      <div className="absolute right-full top-0 z-10 mr-2 w-64 rounded-xl border border-aa-border bg-aa-surface/98 p-2 shadow-xl backdrop-blur">
        <button type="button" onClick={() => setPref({ auto: !prefs.auto })} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm text-aa-text aa-hoverable">
          자동 구속조건 <Toggle on={prefs.auto} />
        </button>
        <div className="my-1 h-px bg-aa-border" />
        <div className="px-2.5 py-1 text-xs font-semibold text-aa-text-dim">구속조건 및 잠긴 치수 가시성</div>
        <button type="button" onClick={() => setPref({ showConstraints: !prefs.showConstraints })} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm text-aa-text aa-hoverable">
          항상 구속조건 표시 <Toggle on={prefs.showConstraints} />
        </button>
        <button type="button" onClick={() => setPref({ showDims: !prefs.showDims })} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm text-aa-text aa-hoverable">
          항상 치수 표시 <Toggle on={prefs.showDims} />
        </button>
        <div className="my-1 h-px bg-aa-border" />
        <div className="px-2.5 py-1 text-xs font-semibold text-aa-text-dim">앵커 스케치 개체</div>
        <button type="button" onClick={() => setPref({ anchor: "first" })} className={["flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm aa-hoverable", prefs.anchor === "first" ? "text-aa-accent" : "text-aa-text"].join(" ")}>
          <span className="w-3">{prefs.anchor === "first" ? "✓" : ""}</span>처음 선택 항목
        </button>
        <button type="button" onClick={() => setPref({ anchor: "last" })} className={["flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm aa-hoverable", prefs.anchor === "last" ? "text-aa-accent" : "text-aa-text"].join(" ")}>
          <span className="w-3">{prefs.anchor === "last" ? "✓" : ""}</span>마지막 선택 항목
        </button>
      </div>
    </>
  );
}

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
  const applyConstraint = useAppStore((s) => s.applySketchConstraint);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 자체 솔버로 실제 동작하는 구속 (현재: 선택 세그먼트 수평/수직). 나머지는 다음 슬라이스.
  const handlers: Record<string, () => void> = {
    "수평/수직": () => applyConstraint("auto"),
  };

  if (!sketchActive) return null;

  // 기본 위치: 우측(히스토리 패널 왼쪽), 뷰포트 컨트롤 아래 — 겹치지 않게
  const defaultLeft = Math.max(0, window.innerWidth - 240 - 188);
  const defaultTop = 320;

  return (
    <DraggablePanel title="구속조건" defaultLeft={defaultLeft} defaultTop={defaultTop} width={180}>
      <div className="p-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-aa-text aa-hoverable"
          >
            <span className="flex h-5 w-5 items-center justify-center text-[18px]">
              <GearIcon />
            </span>
            구속조건 설정
          </button>
          {settingsOpen && <ConstraintSettingsPopup onClose={() => setSettingsOpen(false)} />}
        </div>
        <div className="my-1 h-px bg-aa-border" />
        {CONSTRAINTS.map((c) => {
          const wired = handlers[c.label];
          return (
            <button
              key={c.label}
              type="button"
              onClick={wired ?? (() => setStatus(`구속: ${c.label} — 준비 중`))}
              className={[
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm aa-hoverable",
                wired ? "text-aa-text" : "text-aa-text-dim",
              ].join(" ")}
            >
              <span>{c.label}</span>
              {c.shortcut && <span className="text-[10px] text-aa-text-dim">{c.shortcut}</span>}
            </button>
          );
        })}
      </div>
    </DraggablePanel>
  );
}
