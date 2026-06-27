/**
 * 우측 구속조건 패널 (스케치 모드). Shapr3D 구속 버튼 세트.
 * 핵심 6종(수평·수직·평행·직교·동일·일치)은 직접 보정으로 실제 동작한다.
 * 사용법: 뷰포트에서 Shift+클릭으로 선분/점을 고른 뒤(초록), 해당 구속을 누른다.
 * (본격 GCS 양방향 솔버는 명세 Module 7 — PlaneGCS 단계.)
 */
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { GearIcon } from "./icons";
import { DraggablePanel } from "./DraggablePanel";
import { CONSTRAINT_SPECS, type ConstraintKind } from "../kernel/sketchConstraints";

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

/** 실제 동작하는 구속 6종 (직접 보정). */
const CONSTRAINTS: { kind: ConstraintKind; label: string; shortcut?: string }[] = [
  { kind: "horizontal", label: "수평", shortcut: "⇧H" },
  { kind: "vertical", label: "수직", shortcut: "⇧V" },
  { kind: "parallel", label: "평행", shortcut: "⇧A" },
  { kind: "perpendicular", label: "직교", shortcut: "⇧P" },
  { kind: "equal", label: "동일", shortcut: "⇧E" },
  { kind: "coincident", label: "일치", shortcut: "⇧N" },
];
/** 추후(GCS) — 양방향 솔버 필요해 아직 비활성. */
const PENDING: string[] = ["접선", "중간점", "동심", "대칭", "분리", "잠금", "구성 만들기"];

export function SketchConstraintsPanel(): JSX.Element | null {
  const sketchActive = useAppStore((s) => s.sketchActive);
  const constraintSel = useAppStore((s) => s.constraintSel);
  const apply = useAppStore((s) => s.applySketchConstraint);
  const clearSel = useAppStore((s) => s.clearConstraintSel);
  const setStatus = useAppStore((s) => s.setStatus);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!sketchActive) return null;

  const segCount = constraintSel.filter((r) => r.type === "seg").length;
  const ptCount = constraintSel.filter((r) => r.type === "point").length;
  const ready = (kind: ConstraintKind): boolean => {
    const spec = CONSTRAINT_SPECS[kind];
    return (spec.target === "seg" ? segCount : ptCount) === spec.count;
  };
  const hint = (kind: ConstraintKind): string => {
    const spec = CONSTRAINT_SPECS[kind];
    return `${spec.target === "seg" ? "선분" : "점"}${spec.count}`;
  };

  // 기본 위치: 우측(히스토리 패널 왼쪽), 뷰포트 컨트롤 아래 — 겹치지 않게
  const defaultLeft = Math.max(0, window.innerWidth - 240 - 188);
  const defaultTop = 320;

  return (
    <DraggablePanel title="구속조건" defaultLeft={defaultLeft} defaultTop={defaultTop} width={188}>
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

        {/* 선택 상태 안내 — Shift+클릭으로 선분/점 고르기 */}
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-aa-text-dim">
          <span>
            Shift+클릭 선택 · 선분 {segCount} · 점 {ptCount}
          </span>
          {constraintSel.length > 0 && (
            <button type="button" onClick={clearSel} className="text-aa-accent hover:underline">
              해제
            </button>
          )}
        </div>

        {CONSTRAINTS.map((c) => {
          const ok = ready(c.kind);
          return (
            <button
              key={c.kind}
              type="button"
              onClick={() => apply(c.kind)}
              className={[
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm aa-hoverable",
                ok ? "text-aa-text" : "text-aa-text-dim",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5">
                {ok && <span className="text-aa-accent">✓</span>}
                {c.label}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded bg-aa-surface-2 px-1 text-[9px] text-aa-text-dim">{hint(c.kind)}</span>
                {c.shortcut && <span className="text-[10px] text-aa-text-dim">{c.shortcut}</span>}
              </span>
            </button>
          );
        })}

        <div className="my-1 h-px bg-aa-border" />
        <div className="px-2.5 py-1 text-[10px] text-aa-text-dim">추후(GCS 솔버)</div>
        {PENDING.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatus(`구속: ${label} — 추후(GCS) 단계`)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left text-[13px] text-aa-text-dim/70 aa-hoverable"
          >
            <span>{label}</span>
          </button>
        ))}
      </div>
    </DraggablePanel>
  );
}
