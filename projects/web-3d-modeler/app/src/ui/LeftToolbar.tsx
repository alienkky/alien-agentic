/**
 * 좌측 툴바 (Shapr3D 레이아웃):
 *  - 상단 그룹: 모델링 · 시각화 · 도면 · 항목
 *  - 본체: 검색 · 스케치 · 삽입 · 구성 · 변형 · 도구  (클릭 시 플라이아웃)
 *  - 하단: 단면 뷰 · 측정
 */
import { useState, type ReactNode } from "react";
import { useAppStore, type SketchTool } from "../store/useAppStore";
import {
  BoxIcon, CylinderIcon, SphereIcon, SketchIcon, SearchIcon, InsertIcon,
  ConstructIcon, TransformIcon, ToolsIcon, LayersIcon, SectionIcon, MeasureIcon,
  SubtractIcon, UnionIcon, IntersectIcon,
} from "./icons";

type Category = "search" | "sketch" | "insert" | "construct" | "transform" | "tools";

function Row({
  icon, label, shortcut, active, dot, onClick,
}: {
  icon: ReactNode; label: string; shortcut?: string; active?: boolean; dot?: boolean; onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-aa-surface-2 text-aa-text" : "text-aa-text aa-hoverable",
      ].join(" ")}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[20px]">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {shortcut && <span className="text-[10px] text-aa-text-dim">{shortcut}</span>}
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-aa-accent" />}
    </button>
  );
}

function FlyoutItem({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        disabled ? "opacity-40" : "aa-hoverable active:bg-aa-surface-2",
      ].join(" ")}
    >
      <span className="flex h-6 w-6 items-center justify-center text-[20px] text-aa-accent">{icon}</span>
      {label}
    </button>
  );
}

export function LeftToolbar(): JSX.Element {
  const [open, setOpen] = useState<Category | null>(null);
  const addPrimitive = useAppStore((s) => s.addPrimitive);
  const beginSketch = useAppStore((s) => s.beginSketch);
  const setSketchTool = useAppStore((s) => s.setSketchTool);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const sketchActive = useAppStore((s) => s.sketchActive);

  const toggle = (c: Category) => setOpen((cur) => (cur === c ? null : c));
  const startSketch = (tool: SketchTool) => { beginSketch(); setSketchTool(tool); setOpen(null); };

  return (
    <div className="pointer-events-none absolute left-44 top-14 z-20 flex items-start gap-2 p-2">
      <div className="pointer-events-auto flex w-44 flex-col gap-3 rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
        {/* 상단 그룹 */}
        <div className="flex flex-col gap-0.5">
          <Row icon={<BoxIcon />} label="모델링" active />
          <Row icon={<SphereIcon />} label="시각화" />
          <Row icon={<ConstructIcon />} label="도면" shortcut="⌃⇧\" />
          <Row icon={<LayersIcon />} label="항목" shortcut="⌃⌥S" />
        </div>

        {/* 본체 도구 */}
        <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
          <Row icon={<SearchIcon />} label="검색" shortcut="⌃F" onClick={() => toggle("search")} active={open === "search"} />
          <Row icon={<SketchIcon />} label="스케치" onClick={() => toggle("sketch")} active={open === "sketch" || sketchActive} />
          <Row icon={<InsertIcon />} label="삽입" onClick={() => toggle("insert")} active={open === "insert"} />
          <Row icon={<ConstructIcon />} label="구성" onClick={() => toggle("construct")} active={open === "construct"} />
          <Row icon={<TransformIcon />} label="변형" onClick={() => toggle("transform")} active={open === "transform"} />
          <Row icon={<ToolsIcon />} label="도구" dot onClick={() => toggle("tools")} active={open === "tools"} />
        </div>

        {/* 하단 */}
        <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
          <Row icon={<SectionIcon />} label="단면 뷰" />
          <Row icon={<MeasureIcon />} label="측정" />
        </div>
      </div>

      {/* 플라이아웃 */}
      {open && (
        <div className="pointer-events-auto w-52 rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
          {open === "insert" && (
            <>
              <FlyoutItem icon={<BoxIcon />} label="박스" onClick={() => { void addPrimitive("box"); setOpen(null); }} />
              <FlyoutItem icon={<CylinderIcon />} label="실린더" onClick={() => { void addPrimitive("cylinder"); setOpen(null); }} />
              <FlyoutItem icon={<SphereIcon />} label="구" onClick={() => { void addPrimitive("sphere"); setOpen(null); }} />
            </>
          )}
          {open === "sketch" && (
            <>
              <FlyoutItem icon={<SketchIcon />} label="사각형" onClick={() => startSketch("rectangle")} />
              <FlyoutItem icon={<SketchIcon />} label="원" onClick={() => startSketch("circle")} />
              <FlyoutItem icon={<SketchIcon />} label="선" onClick={() => startSketch("line")} />
            </>
          )}
          {open === "tools" && (
            <>
              <FlyoutItem icon={<SubtractIcon />} label="빼기 (Subtract)" onClick={() => { void booleanOp("cut"); setOpen(null); }} />
              <FlyoutItem icon={<UnionIcon />} label="합치기 (Union)" onClick={() => { void booleanOp("fuse"); setOpen(null); }} />
              <FlyoutItem icon={<IntersectIcon />} label="교집합 (Intersect)" onClick={() => { void booleanOp("common"); setOpen(null); }} />
            </>
          )}
          {open === "transform" && (
            <div className="px-3 py-2 text-xs leading-relaxed text-aa-text-dim">
              이동: 바디를 선택하면 화살표 기즈모가 나옵니다. (회전·스케일 준비 중)
            </div>
          )}
          {open === "construct" && (
            <div className="px-3 py-2 text-xs text-aa-text-dim">구성 평면·축 — 준비 중</div>
          )}
          {open === "search" && (
            <div className="px-3 py-2 text-xs text-aa-text-dim">명령 검색 — 준비 중</div>
          )}
        </div>
      )}
    </div>
  );
}
