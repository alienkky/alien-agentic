/**
 * 좌측 툴바 (Shapr3D 레이아웃). 일반 모드 ↔ 스케치 모드에서 도구 세트가 바뀐다.
 */
import { useState, type ReactNode } from "react";
import { useAppStore, type SketchTool } from "../store/useAppStore";
import { buildMouse } from "../demo/mouse";
import { buildBracket } from "../demo/bracket";
import { roundedBox } from "../kernel/roundedBox";
import {
  BoxIcon, CylinderIcon, SphereIcon, SketchIcon, SearchIcon, InsertIcon,
  ConstructIcon, TransformIcon, ToolsIcon, LayersIcon, SectionIcon, MeasureIcon,
  SubtractIcon, UnionIcon, IntersectIcon,
  CloseIcon, LineIcon, ArcIcon, SplineIcon, RectIcon, Circle2DIcon, EllipseIcon,
  PolygonIcon, OffsetIcon, MirrorIcon, PatternIcon, ProjectIcon, TextIcon, TrimIcon, TrashIcon,
  ExtrudeIcon,
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

function FlyoutItem({ icon, label, shortcut, onClick, disabled }: { icon: ReactNode; label: string; shortcut?: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={["flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", disabled ? "opacity-45" : "aa-hoverable active:bg-aa-surface-2"].join(" ")}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[19px] text-aa-accent">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-aa-text-dim">{shortcut}</span>}
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
  const finishSketch = useAppStore((s) => s.finishSketch);
  const setStatus = useAppStore((s) => s.setStatus);
  const plane = useAppStore((s) => s.sketchPlane);
  const openSketchTransform = useAppStore((s) => s.openSketchTransform);
  const sketchProject = useAppStore((s) => s.sketchProject);

  const pick = (t: SketchTool) => setSketchTool(t);
  const soon = (name: string) => setStatus(`${name} — 준비 중`);

  return (
    <div className="flex max-h-[calc(100vh-9rem)] flex-col gap-0.5 overflow-y-auto border-t border-aa-border pt-1.5">
      <Row icon={<SearchIcon />} label="검색" shortcut="⌃F" onClick={() => soon("검색")} />
      <Row icon={<CloseIcon />} label="스케칭 종료" sub={plane ? "프로파일 저장" : "활성 평면 없음"} onClick={finishSketch} />
      <Row icon={<LineIcon />} label="선" shortcut="L" active={tool === "line"} onClick={() => pick("line")} />
      <Row icon={<ArcIcon />} label="호" shortcut="A" active={tool === "arc"} onClick={() => pick("arc")} />
      <Row icon={<SplineIcon />} label="스플라인" sub="맞춤 점" shortcut="I" active={tool === "spline"} onClick={() => pick("spline")} />
      <Row icon={<RectIcon />} label="사각형" sub="대각선" shortcut="R" active={tool === "rectangle"} onClick={() => pick("rectangle")} />
      <Row icon={<Circle2DIcon />} label="원" shortcut="C" active={tool === "circle"} onClick={() => pick("circle")} />
      <Row icon={<EllipseIcon />} label="타원" active={tool === "ellipse"} onClick={() => pick("ellipse")} />
      <Row icon={<PolygonIcon />} label="다각형" sub="육각형" shortcut="G" active={tool === "polygon"} onClick={() => pick("polygon")} />
      <Row icon={<OffsetIcon />} label="모서리 오프셋" sub="체인" shortcut="O" onClick={() => openSketchTransform("offset")} />
      <Row icon={<TransformIcon />} label="이동/회전" shortcut="M" onClick={() => openSketchTransform("move")} />
      <Row icon={<MirrorIcon />} label="미러" onClick={() => openSketchTransform("mirror")} />
      <Row icon={<PatternIcon />} label="패턴" sub="선형/원형" onClick={() => openSketchTransform("pattern")} />
      <Row icon={<ProjectIcon />} label="투상" shortcut="P" onClick={() => sketchProject()} />
      <Row icon={<TextIcon />} label="텍스트" onClick={() => soon("텍스트")} />
      <Row icon={<TrimIcon />} label="자르기" shortcut="T" active={tool === "trim"} onClick={() => pick("trim")} />
      <Row icon={<TrashIcon />} label="삭제" active={tool === "delete"} onClick={() => pick("delete")} />
    </div>
  );
}

export function LeftToolbar(): JSX.Element {
  const [open, setOpen] = useState<Category | null>(null);
  const sketchActive = useAppStore((s) => s.sketchActive);
  const addPrimitive = useAppStore((s) => s.addPrimitive);
  const beginSketch = useAppStore((s) => s.beginSketch);
  const booleanOp = useAppStore((s) => s.booleanOp);
  const openExtrude = useAppStore((s) => s.openExtrude);
  const openRevolve = useAppStore((s) => s.openRevolve);
  const openPattern = useAppStore((s) => s.openPattern);
  const openTransform = useAppStore((s) => s.openTransform);
  const toggleMeasure = useAppStore((s) => s.toggleMeasure);
  const measureActive = useAppStore((s) => s.measureActive);
  const addMesh = useAppStore((s) => s.addMesh);
  const setStatus = useAppStore((s) => s.setStatus);

  const toggle = (c: Category) => setOpen((cur) => (cur === c ? null : c));
  const soon = (n: string) => { setStatus(`${n} — 준비 중`); setOpen(null); };

  return (
    <div className="pointer-events-none absolute left-44 top-14 z-20 flex items-start gap-2 p-2">
      <div className="pointer-events-auto flex w-44 flex-col gap-3 rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
        <TopGroup />

        {sketchActive ? (
          <SketchPalette />
        ) : (
          <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
            <Row icon={<SearchIcon />} label="검색" shortcut="⌃F" onClick={() => toggle("search")} active={open === "search"} />
            <Row icon={<SketchIcon />} label="스케치" onClick={() => { setOpen(null); beginSketch(); }} active={sketchActive} />
            <Row icon={<InsertIcon />} label="삽입" onClick={() => toggle("insert")} active={open === "insert"} />
            <Row icon={<ConstructIcon />} label="구성" onClick={() => toggle("construct")} active={open === "construct"} />
            <Row icon={<TransformIcon />} label="변형" onClick={() => toggle("transform")} active={open === "transform"} />
            <Row icon={<ToolsIcon />} label="도구" dot onClick={() => toggle("tools")} active={open === "tools"} />
          </div>
        )}

        <div className="flex flex-col gap-0.5 border-t border-aa-border pt-1.5">
          {sketchActive && <Row icon={<ConstructIcon />} label="구성" sub="끄기" onClick={() => setStatus("구성 — 준비 중")} />}
          <Row icon={<SectionIcon />} label="단면 뷰" sub="끄기" />
          <Row icon={<MeasureIcon />} label="측정" sub={measureActive ? "두 점 클릭" : undefined} active={measureActive} onClick={() => toggleMeasure()} />
        </div>
      </div>

      {!sketchActive && open && (
        <div className="pointer-events-auto max-h-[calc(100vh-7rem)] w-56 overflow-y-auto rounded-2xl border border-aa-border bg-aa-surface/95 p-1.5 backdrop-blur">
          {open === "insert" && (
            <>
              <FlyoutItem icon={<TextIcon />} label="변수" shortcut="⌃⇧V" onClick={() => soon("변수")} />
              <FlyoutItem icon={<InsertIcon />} label="이미지" onClick={() => soon("이미지")} />
              <FlyoutItem icon={<InsertIcon />} label="파일" shortcut="⌃⇧I" onClick={() => soon("파일 가져오기")} />
              <FlyoutItem icon={<InsertIcon />} label="프로젝트" shortcut="⌃⇧P" onClick={() => soon("프로젝트 가져오기")} />
              <div className="my-1 h-px bg-aa-border" />
              <div className="px-3 py-1 text-[10px] text-aa-text-dim">기본 바디</div>
              <FlyoutItem icon={<BoxIcon />} label="박스" onClick={() => { void addPrimitive("box"); setOpen(null); }} />
              <FlyoutItem icon={<BoxIcon />} label="둥근 박스" onClick={() => { addMesh(roundedBox(4, 4, 4, 0.6, `rbox-${Date.now()}`), "둥근 박스"); setOpen(null); }} />
              <FlyoutItem icon={<CylinderIcon />} label="실린더" onClick={() => { void addPrimitive("cylinder"); setOpen(null); }} />
              <FlyoutItem icon={<SphereIcon />} label="구" onClick={() => { void addPrimitive("sphere"); setOpen(null); }} />
              <div className="my-1 h-px bg-aa-border" />
              <div className="px-3 py-1 text-[10px] text-aa-text-dim">데모 (파이프라인 검증)</div>
              <FlyoutItem icon={<SphereIcon />} label="컴퓨터 마우스" onClick={() => { const { mouse } = buildMouse(); addMesh(mouse, "데모: 마우스"); setOpen(null); }} />
              <FlyoutItem icon={<BoxIcon />} label="브래킷" onClick={() => { const { bracket } = buildBracket(); addMesh(bracket, "데모: 브래킷"); setOpen(null); }} />
            </>
          )}
          {open === "construct" && (
            <>
              <FlyoutItem icon={<ConstructIcon />} label="평면" onClick={() => soon("구성 평면")} />
              <FlyoutItem icon={<ConstructIcon />} label="축" onClick={() => soon("구성 축")} />
            </>
          )}
          {open === "transform" && (
            <>
              <FlyoutItem icon={<TransformIcon />} label="이동" shortcut="M" onClick={() => { setStatus("이동: 바디 선택 후 기즈모 드래그"); setOpen(null); }} />
              <FlyoutItem icon={<TransformIcon />} label="축 둘레 회전" onClick={() => { openTransform("rotate"); setOpen(null); }} />
              <FlyoutItem icon={<BoxIcon />} label="스케일" shortcut="S" onClick={() => { openTransform("scale"); setOpen(null); }} />
              <FlyoutItem icon={<MirrorIcon />} label="미러" onClick={() => { openTransform("mirror"); setOpen(null); }} />
              <FlyoutItem icon={<PatternIcon />} label="패턴" onClick={() => { openPattern(); setOpen(null); }} />
              <FlyoutItem icon={<ConstructIcon />} label="정렬" onClick={() => soon("정렬")} />
            </>
          )}
          {open === "tools" && (
            <>
              <FlyoutItem icon={<OffsetIcon />} label="면 오프셋" onClick={() => soon("면 오프셋")} />
              <FlyoutItem icon={<ToolsIcon />} label="모따기/모깎기" shortcut="F" onClick={() => soon("필렛/모따기")} />
              <FlyoutItem icon={<ExtrudeIcon />} label="돌출" shortcut="E" onClick={() => { openExtrude(); setOpen(null); }} />
              <FlyoutItem icon={<BoxIcon />} label="셸" shortcut="H" onClick={() => soon("셸")} />
              <FlyoutItem icon={<SphereIcon />} label="로프트" onClick={() => soon("로프트")} />
              <FlyoutItem icon={<UnionIcon />} label="결합" shortcut="⌃U" onClick={() => { void booleanOp("fuse"); setOpen(null); }} />
              <FlyoutItem icon={<SubtractIcon />} label="빼기" shortcut="⌃B" onClick={() => { void booleanOp("cut"); setOpen(null); }} />
              <FlyoutItem icon={<IntersectIcon />} label="교차" shortcut="⌃I" onClick={() => { void booleanOp("common"); setOpen(null); }} />
              <FlyoutItem icon={<SectionIcon />} label="바디 분할" onClick={() => soon("바디 분할")} />
              <FlyoutItem icon={<CylinderIcon />} label="회전" shortcut="V" onClick={() => { openRevolve(); setOpen(null); }} />
              <FlyoutItem icon={<SplineIcon />} label="스윕" shortcut="W" onClick={() => soon("스윕")} />
              <FlyoutItem icon={<RectIcon />} label="면 교체" onClick={() => soon("면 교체")} />
              <FlyoutItem icon={<OffsetIcon />} label="모서리 오프셋" shortcut="O" onClick={() => soon("모서리 오프셋")} />
              <FlyoutItem icon={<ProjectIcon />} label="투상" shortcut="P" onClick={() => soon("투상")} />
              <FlyoutItem icon={<TextIcon />} label="랩 & 엠보스" onClick={() => soon("랩 & 엠보스")} />
              <FlyoutItem icon={<SphereIcon />} label="시각화" onClick={() => soon("시각화")} />
            </>
          )}
          {open === "search" && <div className="px-3 py-2 text-xs text-aa-text-dim">명령 검색 — 준비 중</div>}
        </div>
      )}
    </div>
  );
}
