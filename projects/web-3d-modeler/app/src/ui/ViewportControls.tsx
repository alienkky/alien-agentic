/** 우상단 뷰포트 컨트롤 (Shapr3D): 스냅 · 단위 · 뷰 · 셰이더 팝업 + 백엔드. */
import { useState, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { BoxIcon, EyeIcon, GearIcon } from "./icons";
import type { ViewPreset } from "../viewport/cameraMath";

type Popup = "snap" | "unit" | "view" | "shader" | null;

function Row({ label, on, onClick, right }: { label: string; on?: boolean; onClick: () => void; right?: ReactNode }): JSX.Element {
  return (
    <button type="button" onClick={onClick}
      className={["flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm aa-hoverable", on ? "text-aa-accent" : "text-aa-text"].join(" ")}>
      <span className="flex items-center gap-2"><span className="w-3">{on ? "✓" : ""}</span>{label}</span>
      {right}
    </button>
  );
}
function Toggle({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={["relative h-5 w-9 rounded-full transition-colors", on ? "bg-aa-accent" : "bg-aa-surface-2"].join(" ")}>
      <span className={["absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-4" : "left-0.5"].join(" ")} />
    </span>
  );
}
function Section({ title }: { title: string }): JSX.Element {
  return <div className="px-2.5 py-1 text-xs font-semibold text-aa-text-dim">{title}</div>;
}
function Shell({ children }: { children: ReactNode }): JSX.Element {
  return <div className="w-60 rounded-xl border border-aa-border bg-aa-surface/98 p-1 shadow-xl backdrop-blur">{children}</div>;
}

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "iso", label: "기본 뷰" },
  { id: "top", label: "평면도(위)" },
  { id: "bottom", label: "저면도" },
  { id: "front", label: "정면도" },
  { id: "back", label: "배면도" },
  { id: "right", label: "우측면도" },
  { id: "left", label: "좌측면도" },
];
const UNITS: { id: "mm" | "cm" | "m" | "in" | "ft"; label: string }[] = [
  { id: "mm", label: "밀리미터" }, { id: "cm", label: "센티미터" }, { id: "m", label: "미터" },
  { id: "in", label: "인치" }, { id: "ft", label: "피트" },
];

export function ViewportControls(): JSX.Element {
  const s = useAppStore();
  const [open, setOpen] = useState<Popup>(null);
  const close = () => setOpen(null);
  const toggle = (p: Popup) => setOpen((c) => (c === p ? null : p));
  const run = (fn: () => void) => () => { fn(); close(); };

  const IconBtn = ({ p, title, children }: { p: Popup; title: string; children: ReactNode }): JSX.Element => (
    <button type="button" title={title} onClick={() => toggle(p)}
      className={["flex h-9 w-9 items-center justify-center rounded-xl border border-aa-border text-[18px] backdrop-blur", open === p ? "bg-aa-accent text-aa-bg" : "bg-aa-surface/90 text-aa-text"].join(" ")}>
      {children}
    </button>
  );

  return (
    <div className="pointer-events-auto absolute right-64 top-14 z-20 flex flex-col items-end gap-2 p-2">
      {open && <div className="fixed inset-0 z-0" onClick={close} />}

      <div className="relative z-10 flex items-center gap-2">
        {open === "snap" && <div className="absolute right-11 top-0"><Shell>
          <Section title="스냅" />
          <Row label="그리드" right={<Toggle on={s.snap.grid} />} onClick={() => s.toggleSnap("grid")} />
          <Row label="스케치 가이드 선" right={<Toggle on={s.snap.sketchLine} />} onClick={() => s.toggleSnap("sketchLine")} />
          <Row label="스케치 가이드 점" right={<Toggle on={s.snap.sketchPoint} />} onClick={() => s.toggleSnap("sketchPoint")} />
          <Row label="3D 가이드 점" right={<Toggle on={s.snap.guide3d} />} onClick={() => s.toggleSnap("guide3d")} />
          <Row label="먼 에지" right={<Toggle on={s.snap.farEdge} />} onClick={() => s.toggleSnap("farEdge")} />
          <div className="my-1 h-px bg-aa-border" />
          <Section title="표시" />
          <Row label="가이드 점" right={<Toggle on={s.snap.guidePoint} />} onClick={() => s.toggleSnap("guidePoint")} />
          <Row label="스냅핑 힌트" right={<Toggle on={s.snap.snapHint} />} onClick={() => s.toggleSnap("snapHint")} />
        </Shell></div>}
        <IconBtn p="snap" title="스냅 설정"><GearIcon /></IconBtn>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        {open === "unit" && <div className="absolute right-11 top-0"><Shell>
          <Section title="단위" />
          {UNITS.map((u) => <Row key={u.id} label={u.label} on={s.unit === u.id} onClick={run(() => s.setUnit(u.id))} />)}
          <div className="my-1 h-px bg-aa-border" />
          <Section title="그리드" />
          <Row label="그리드 크기 잠금" right={<Toggle on={s.snap.grid} />} onClick={() => s.toggleSnap("grid")} />
          <div className="my-1 h-px bg-aa-border" />
          <Section title="각도 포맷" />
          <Row label="십진법 (예: 27.15°)" on onClick={close} />
          <Row label="도/분/초 (예: 27° 15′)" onClick={run(() => s.setStatus("각도 포맷: 도/분/초 — 준비 중"))} />
        </Shell></div>}
        <IconBtn p="unit" title="단위"><span className="text-[11px] font-bold">{s.unit}</span></IconBtn>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        {open === "view" && <div className="absolute right-11 top-0"><Shell>
          <Section title="뷰" />
          {VIEWS.map((v) => <Row key={v.id} label={v.label} onClick={run(() => s.setView(v.id))} />)}
        </Shell></div>}
        <IconBtn p="view" title="표준 뷰"><BoxIcon /></IconBtn>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        {open === "shader" && <div className="absolute right-11 top-0"><Shell>
          <Section title="셰이더" />
          <Row label="와이어프레임" on={s.displayMode === "wireframe"} onClick={run(() => s.setDisplayMode("wireframe"))} />
          <Row label="X-Ray" on={s.displayMode === "xray"} onClick={run(() => s.setDisplayMode("xray"))} />
          <Row label="음영" on={s.displayMode === "shaded"} onClick={run(() => s.setDisplayMode("shaded"))} />
          <div className="my-1 h-px bg-aa-border" />
          <Section title="옵션" />
          <Row label="에지 표시" right={<Toggle on={s.showEdges} />} onClick={() => s.toggleEdges()} />
          <Row label="숨긴 모서리 표시" right={<Toggle on={false} />} onClick={() => s.setStatus("숨긴 모서리 — 준비 중")} />
        </Shell></div>}
        <IconBtn p="shader" title="디스플레이 모드"><EyeIcon /></IconBtn>
      </div>

      <div className="z-10 flex items-center gap-1 rounded-xl border border-aa-border bg-aa-surface/90 p-1 backdrop-blur">
        <button type="button" title="커널: FAST(메시) / OCCT(B-rep)"
          onClick={() => void s.setBackend(s.backend === "occt" ? "deterministic" : "occt")}
          className={["min-h-[32px] rounded-md px-2 text-xs font-semibold", s.backend === "occt" ? "bg-aa-accent text-aa-bg" : "bg-aa-surface-2 text-aa-text-dim"].join(" ")}>
          {s.backend === "occt" ? "OCCT" : "FAST"}
        </button>
      </div>
    </div>
  );
}
