/**
 * 좌측 툴바 (Shapr3D 레이아웃). 일반 모드 ↔ 스케치 모드에서 도구 세트가 바뀐다.
 */
import { useState, type ReactNode } from "react";
import { useAppStore, type SketchTool } from "../store/useAppStore";
import {
  BoxIcon, CylinderIcon, SphereIcon, SketchIcon, SearchIcon, InsertIcon,
  ConstructIcon, TransformIcon, ToolsIcon, LayersIcon, SectionIcon, MeasureIcon,
  SubtractIcon, UnionIcon, IntersectIcon,
  CloseIcon, LineIcon, ArcIcon, SplineIcon, RectIcon, Circle2DIcon, EllipseIcon,
  PolygonIcon, OffsetIcon, MirrorIcon, PatternIcon, ProjectIcon, TextIcon, TrimIcon, TrashIcon,
} from "./icons";

type Category = "search" | "sketch" | "insert" | "construct" | "transform" | "tools";

function Row({
  icon, label, sub, shortcut, active, dot, disabled, onClick,
}: {
  icon: ReactNode; label: string; sub?: string; shortcut?: string;
  active?: boolean; dot?: boolean; disabled?: boolean; onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        active ? "bg-aa-surface-2 text-aa-text" : "text-aa-text aa-hoverable",
        disabled ? "opacity-45" : "",
      ].join(" ")}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[19px]">{icon}</span>
      <span className="flex-1 leading-tight">
        <span className="block text-sm">{label}</span>
        {sub && <span className="block text-[10px] text-aa-text-dim">{sub}</span>}
      </span>
      {shortcut && <span className="text-[10px] text-aa-text-dim">{shortcut}</span>}
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-aa-accent" />}
    </button>
  );
}

function FlyoutItem({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={["flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", disabled ? "opacity-40" : "aa-hoverable active:bg-aa-surface-2"].join(" ")}>
      <span className="flex h-6 w-6 items-center justify-center text-[20px] text-aa-accent">{icon}</span>
      {label}
    </button>
  );
}

function TopGroup(): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <Row icon={<BoxIcon />} label="모델링" active />
      <Row icon={<SphereIcon />} label="시각화" />
      <Row icon={<ConstructIcon />} label="도면" shortcut="⌃⇧\" />
      <Row icon={<LayersIcon />} label="항목" shortcut="⌃⌥S" />
    </div>
  );
}

function SketchPalette(): JSX.Element {
  const tool = useAppStore((s) => s.sketchTool);
  const setSketchTool = useAppStore((s) => s.setSketchTool);
  const cancelSketch = useAppStore((s) => s.cancelSketch);
  const setStatus = useAppStore((s) => s.setStatus);

  const pick = (t: SketchTool) => setSketchTool(t);
  const soon = (name: string) => setStatus(`${name} — 준비 중`);

  return (
    <div className="flex max-h-[calc(100vh-9rem)] flex-col gap-0.5 overflow-y-auto border-t border-aa-border pt-1.5">
      <Row icon={<SearchIcon />} label="검색" shortcut="⌃F" onClick={() => soon("검색")} />
      <Row icon={<CloseIcon />} label="스케칭 종료" sub="활성 평면: 지면(XZ)" onClick={cancelSketch} />
      <Row icon={<LineIcon />} label="선" shortcut="L" active={tool === "line"} onClick={() => pick("line")} />
      <Row icon={<ArcIcon />} label="호" shortcut="A" onClick={() => soon("호")} />
      <Row icon={<SplineIcon />} label="스플라인" sub="맞춤 점" shortcut="I" onClick={() => soon("스플라인")} />
      <Row icon={<RectIcon />} label="사각형" sub="대각선" shortcut="R" active={tool === "rectangle"} onClick={() => pick("rectangle")} />
      <Row icon={<Circle2DIcon />} label="원" shortcut="C" active={tool === "circle"} onClick={() => pick("circle")} />
      <Row icon={<EllipseIcon />} label="타원" onClick={() => soon("타원")} />
      <Row icon={<PolygonIcon />} label="다각형" sub="오각형" shortcut="G" onClick={() => soon("다각형")} />
      <Row icon={<OffsetIcon />} label="모서리 오프셋" sub="체인" shortcut="O" onClick={() => soon("모서리 오프셋")} />
      <Row icon={<TransformIcon />} label="이동/회전" shortcut="M" onClick={() => soon("이동/회전")} />
      <Row icon={<MirrorIcon />} label="미러" onClick={() => soon("미러")} />
      <Row icon={<PatternIcon />} label="패턴" sub="선형" onClick={() => soon("패턴")} />
      <Row icon={<ProjectIcon />} label="투상" shortcut="P" onClick={() => soon("투상")} />
      <Row icon={<TextIcon />} label="텍스트" onClick={() => soon("텍스트")} />
      <Row icon={<TrimIcon />} label="자르기" shortcut="T" onClick={() => soon("자르기")} />
      <Row icon={<TrashIcon />} label="삭제" onClick={() => soon("삭제")} />
    </div>
  );
}

export function LeftToolbar(): JSX.Element {
  const [open, setOpen] = useState<Category | null>(null);
  const sketchActive = useAppStore((s) => s.sketchActive);
  const addPrimitive = useAppStore((s) => s.addPrimitive);
  const beginSketch = useAppStore((s) => s.beginSketch);
  const setSketchTool = useAppStore((s) => s.setSketchTool);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const setStatus = useAppStore((s) => s.setStatus);

  const toggle = (c: Category) => setOpen((cur) => (cur === c ? null : c));
  const startSketch = (tool: SketchTool) => { beginSketch(); setSketchTool(tool); setOpen(null); };

  return (
    <div className="pointer-events-none absolute left-44 top-14 z-20 flex items-start gap-2 p-2">
      <div className="pointer-events-auto flex w-44 flex-col gap-3 rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
        <TopGroup />

        {sketchActive ? (
          <SketchPalette />
        ) : (
          <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
            <Row icon={<SearchIcon />} label="검색" shortcut="⌃F" onClick={() => toggle("search")} active={open === "search"} />
            <Row icon={<SketchIcon />} label="스케치" onClick={() => toggle("sketch")} active={open === "sketch"} />
            <Row icon={<InsertIcon />} label="삽입" onClick={() => toggle("insert")} active={open === "insert"} />
            <Row icon={<ConstructIcon />} label="구성" onClick={() => toggle("construct")} active={open === "construct"} />
            <Row icon={<TransformIcon />} label="변형" onClick={() => toggle("transform")} active={open === "transform"} />
            <Row icon={<ToolsIcon />} label="도구" dot onClick={() => toggle("tools")} active={open === "tools"} />
          </div>
        )}

        <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
          {sketchActive && <Row icon={<ConstructIcon />} label="구성" sub="끄기" onClick={() => setStatus("구성 — 준비 중")} />}
          <Row icon={<SectionIcon />} label="단면 뷰" sub="끄기" />
          <Row icon={<MeasureIcon />} label="측정" />
        </div>
      </div>

      {!sketchActive && open && (
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
              <FlyoutItem icon={<RectIcon />} label="사각형" onClick={() => startSketch("rectangle")} />
              <FlyoutItem icon={<Circle2DIcon />} label="원" onClick={() => startSketch("circle")} />
              <FlyoutItem icon={<LineIcon />} label="선" onClick={() => startSketch("line")} />
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
            <div className="px-3 py-2 text-xs leading-relaxed text-aa-text-dim">이동: 바디 선택 후 화살표 기즈모. (회전·스케일 준비 중)</div>
          )}
          {open === "construct" && <div className="px-3 py-2 text-xs text-aa-text-dim">구성 평면·축 — 준비 중</div>}
          {open === "search" && <div className="px-3 py-2 text-xs text-aa-text-dim">명령 검색 — 준비 중</div>}
        </div>
      )}
    </div>
  );
}
