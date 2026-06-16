/**
 * 스케치 모드 레이어 (Shapr3D 방식, 다중 획):
 *  - 기준면 미선택: 3개 평면 picker.
 *  - 선택됨: 그 평면 위에서 그리기. 이미 그린 획들(strokes)은 누적 유지.
 *  - 선분 치수는 라벨을 탭하면 입력 박스로 바뀌어 정확한 길이 입력.
 */
import { useMemo, useState } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";
import { adaptiveCellSize } from "./cameraMath";
import {
  planeToWorld, worldToPlane,
  type PlaneId, type SketchPlaneDef, type SketchPoint,
} from "../kernel/sketchPlane";

const PLANE_ROT: Record<PlaneId, [number, number, number]> = {
  xz: [-Math.PI / 2, 0, 0], xy: [0, 0, 0], yz: [0, Math.PI / 2, 0],
};
const PLANE_COLOR: Record<PlaneId, string> = { xz: "#4fd1c5", xy: "#5b9cff", yz: "#e06fae" };
/** 평면 색 — 표준평면이면 고유색, 면 위 평면이면 기본 청록. */
const planeColorFor = (plane: SketchPlaneDef): string => PLANE_COLOR[plane.id as PlaneId] ?? "#4fd1c5";

/** Shapr3D 식 스케치 팔레트 — 선=연한 흰파랑, 점=파랑, 면=파랑, 보조=회색. */
const SK = { line: "#cdd9ee", fill: "#5b9cff", point: "#2f6bff", active: "#5b9cff", guide: "#7d8a9e", selected: "#f59e0b" };

/** 스케치 평면 격자 (local XY, 어댑티브 셀). planeMatrix 그룹 안에 두어 그 평면에 눕는다. */
function SketchGrid({ cell }: { cell: number }): JSX.Element {
  const geo = useMemo(() => {
    const n = Math.min(100, Math.max(10, Math.ceil(24 / cell)));
    const ext = n * cell;
    const pos: number[] = [];
    for (let i = -n; i <= n; i++) {
      const t = i * cell;
      pos.push(t, -ext, 0, t, ext, 0);
      pos.push(-ext, t, 0, ext, t, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    return g;
  }, [cell]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#3a4a5e" transparent opacity={0.45} />
    </lineSegments>
  );
}
const DIM_LABEL = "cursor-pointer whitespace-nowrap rounded bg-aa-bg/90 px-1.5 py-0.5 text-xs font-semibold text-aa-accent ring-1 ring-aa-border";
const DIM_ACTIVE = "whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-1 ring-blue-300";

function planeMatrix(plane: SketchPlaneDef): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...plane.u), new THREE.Vector3(...plane.v), new THREE.Vector3(...plane.normal));
  m.setPosition(new THREE.Vector3(...plane.origin));
  return m;
}
function rectPts(a: SketchPoint, b: SketchPoint): SketchPoint[] {
  return [{ u: a.u, v: a.v }, { u: b.u, v: a.v }, { u: b.u, v: b.v }, { u: a.u, v: b.v }];
}
function circlePts(c: SketchPoint, r: number, seg = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; out.push({ u: c.u + r * Math.cos(a), v: c.v + r * Math.sin(a) }); }
  return out;
}
function ellipsePts(c: SketchPoint, ru: number, rv: number, seg = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; out.push({ u: c.u + ru * Math.cos(a), v: c.v + rv * Math.sin(a) }); }
  return out;
}
function polygonPts(c: SketchPoint, r: number, sides: number): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2 + Math.PI / 2; out.push({ u: c.u + r * Math.cos(a), v: c.v + r * Math.sin(a) }); }
  return out;
}
const POLY_SIDES = 6;
const segLen = (a: SketchPoint, b: SketchPoint) => Math.hypot(b.u - a.u, b.v - a.v);
const midUV = (a: SketchPoint, b: SketchPoint): SketchPoint => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });

function SegmentDimInput({ value, onCommit, onCancel }: { value: number; onCommit: (n: number) => void; onCancel: () => void }): JSX.Element {
  const [text, setText] = useState(value.toFixed(2));
  return (
    <input
      autoFocus type="number" inputMode="decimal" step="0.5" value={text}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { const n = parseFloat(text); if (!Number.isNaN(n)) onCommit(n); } else if (e.key === "Escape") onCancel(); }}
      onBlur={() => { const n = parseFloat(text); if (!Number.isNaN(n) && Math.abs(n - value) > 1e-6) onCommit(n); else onCancel(); }}
      className="w-20 rounded bg-blue-600 px-1.5 py-1 text-center text-sm font-semibold text-white outline-none ring-2 ring-blue-300"
    />
  );
}

function fillGeometry(plane: SketchPlaneDef, pts: SketchPoint[]): THREE.ShapeGeometry | null {
  const first = pts[0];
  if (pts.length < 3 || !first) return null;
  const shape = new THREE.Shape();
  shape.moveTo(first.u, first.v);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p) shape.lineTo(p.u, p.v); }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.applyMatrix4(planeMatrix(plane));
  return geo;
}

/** 확정된 한 획: 선 + 채움 + 선분별 치수 라벨(클릭 편집) + 드래그 가능한 점 핸들. */
function StrokeView({ plane, pts, strokeIndex, ptSize }: { plane: SketchPlaneDef; pts: SketchPoint[]; strokeIndex: number; ptSize: number }): JSX.Element {
  const selectedSeg = useAppStore((s) => s.sketchSelectedSeg);
  const selectSegment = useAppStore((s) => s.selectSketchSegment);
  const setSegmentLength = useAppStore((s) => s.setSegmentLength);
  const clearSeg = useAppStore((s) => s.clearSketchSegment);
  const startPointDrag = useAppStore((s) => s.startPointDrag);
  const selectedPoint = useAppStore((s) => s.sketchSelectedPoint);

  const toWorld = (p: SketchPoint): [number, number, number] => planeToWorld(plane, p.u, p.v);
  const closed = pts.length >= 3;
  const loop = pts.map(toWorld);
  const linePts = closed ? [...loop, loop[0]!] : loop;
  const fill = useMemo(() => fillGeometry(plane, pts), [plane, pts]);
  const isCircleLike = pts.length > 8;

  return (
    <group>
      {fill && <mesh geometry={fill}><meshBasicMaterial color={SK.fill} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
      {linePts.length >= 2 && <Line points={linePts} color={SK.line} lineWidth={2} />}
      {!isCircleLike &&
        pts.map((p, i) => {
          const selPt = selectedPoint?.s === strokeIndex && selectedPoint?.i === i;
          return (
            <mesh
              key={`pt${i}`}
              position={toWorld(p)}
              renderOrder={5}
              onPointerDown={(e) => { e.stopPropagation(); startPointDrag(strokeIndex, i); }}
            >
              <sphereGeometry args={[ptSize, 14, 14]} />
              <meshBasicMaterial color={selPt ? SK.selected : SK.point} depthTest={false} />
            </mesh>
          );
        })}
      {!isCircleLike &&
        pts.map((a, i) => {
          const b = pts[i + 1];
          if (!b) return null;
          const sel = selectedSeg?.s === strokeIndex && selectedSeg?.i === i;
          return (
            <Html key={i} position={toWorld(midUV(a, b))} center style={{ pointerEvents: "auto" }}>
              {sel ? (
                <SegmentDimInput value={segLen(a, b)} onCommit={(n) => setSegmentLength(strokeIndex, i, n)} onCancel={clearSeg} />
              ) : (
                <button type="button" className={DIM_LABEL} onClick={(e) => { e.stopPropagation(); selectSegment(strokeIndex, i); }}>
                  {segLen(a, b).toFixed(2)} mm
                </button>
              )}
            </Html>
          );
        })}
    </group>
  );
}

function PlanePicker(): JSX.Element {
  const pickPlane = useAppStore((s) => s.pickPlane);
  const ids: PlaneId[] = ["xz", "xy", "yz"];
  return (
    <group>
      {ids.map((id) => (
        <mesh key={id} rotation={PLANE_ROT[id]} onClick={(e) => { e.stopPropagation(); pickPlane(id); }}>
          <planeGeometry args={[8, 8]} />
          <meshBasicMaterial color={PLANE_COLOR[id]} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Html position={[0, 0.2, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-aa-bg/90 px-2 py-1 text-xs text-aa-text">기준면을 선택하세요</div>
      </Html>
    </group>
  );
}

export function SketchLayer(): JSX.Element | null {
  const active = useAppStore((s) => s.sketchActive);
  const plane = useAppStore((s) => s.sketchPlane);
  const tool = useAppStore((s) => s.sketchTool);
  const draft = useAppStore((s) => s.sketchDraft);
  const hover = useAppStore((s) => s.sketchHover);
  const points = useAppStore((s) => s.sketchPoints);
  const strokes = useAppStore((s) => s.sketchStrokes);
  const lineDrawing = useAppStore((s) => s.sketchLineDrawing);
  const dragStart = useAppStore((s) => s.sketchDragStart);
  const dragMove = useAppStore((s) => s.sketchDragMove);
  const dragEnd = useAppStore((s) => s.sketchDragEnd);
  const clickPoint = useAppStore((s) => s.sketchClickPoint);
  const trimAtPoint = useAppStore((s) => s.trimSketchAt);
  const deleteAtPoint = useAppStore((s) => s.deleteSketchStrokeAt);
  const draggingPoint = useAppStore((s) => s.sketchDraggingPoint);
  const movePointDrag = useAppStore((s) => s.movePointDrag);
  const endPointDrag = useAppStore((s) => s.endPointDrag);
  const guides = useAppStore((s) => s.sketchGuides);
  const gridAdaptive = useAppStore((s) => s.snap.gridAdaptive);
  const radius = useAppStore((s) => s.camera.radius);
  const isPointTool = tool === "line" || tool === "spline" || tool === "arc";
  // 점 핸들 크기를 화면에서 일정하게 (줌에 비례) — Shapr3D 식
  const ptSize = Math.max(0.05, radius * 0.012);
  // 격자 셀: 적응(잘아짐) 또는 고정 1
  const cell = gridAdaptive ? adaptiveCellSize(radius) : 1;

  // 드래그 중 미리보기(사각형/원)
  const draftView = useMemo(() => {
    if (!draft) return null;
    const { start, current } = draft;
    if (tool === "circle") {
      const r = Math.hypot(current.u - start.u, current.v - start.v);
      return { pts: circlePts(start, r), dim: `⌀ ${(r * 2).toFixed(2)} mm`, dimAt: midUV(start, current) };
    }
    if (tool === "ellipse") {
      const ru = Math.abs(current.u - start.u);
      const rv = Math.abs(current.v - start.v);
      return { pts: ellipsePts(start, ru, rv), dim: `${(ru * 2).toFixed(2)} × ${(rv * 2).toFixed(2)} mm`, dimAt: midUV(start, current) };
    }
    if (tool === "polygon") {
      const r = Math.hypot(current.u - start.u, current.v - start.v);
      return { pts: polygonPts(start, r, POLY_SIDES), dim: `${POLY_SIDES}각 ⌀ ${(r * 2).toFixed(2)} mm`, dimAt: midUV(start, current) };
    }
    return {
      pts: rectPts(start, current),
      dim: `${Math.abs(current.u - start.u).toFixed(2)} × ${Math.abs(current.v - start.v).toFixed(2)} mm`,
      dimAt: { u: (start.u + current.u) / 2, v: (start.v + current.v) / 2 },
    };
  }, [draft, tool]);

  if (!active) return null;
  if (!plane) return <PlanePicker />;

  const toWorld = (p: SketchPoint): [number, number, number] => planeToWorld(plane, p.u, p.v);
  const onPlane = (e: { point: THREE.Vector3 }) => worldToPlane(plane, e.point.x, e.point.y, e.point.z);
  const draftLoop = draftView ? [...draftView.pts.map(toWorld), toWorld(draftView.pts[0]!)] : [];
  const chainLoop = points.map(toWorld);
  const last = points[points.length - 1];

  return (
    <group>
      {/* 그리기 평면 — 표준/면위 평면 모두 basis 행렬로 정렬 (local XY → 평면) */}
      <group matrixAutoUpdate={false} matrix={planeMatrix(plane)}>
        <SketchGrid cell={cell} />
        <mesh
          onPointerDown={(e) => { e.stopPropagation(); if (tool === "trim") trimAtPoint(onPlane(e)); else if (tool === "delete") deleteAtPoint(onPlane(e)); else if (isPointTool) clickPoint(onPlane(e)); else dragStart(onPlane(e)); }}
          onPointerMove={(e) => { e.stopPropagation(); if (draggingPoint) movePointDrag(onPlane(e)); else dragMove(onPlane(e)); }}
          onPointerUp={(e) => { e.stopPropagation(); if (draggingPoint) endPointDrag(); else dragEnd(); }}
        >
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color={planeColorFor(plane)} transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 누적된 확정 획들 */}
      {strokes.map((stroke, i) => (
        <StrokeView key={i} plane={plane} pts={stroke} strokeIndex={i} ptSize={ptSize} />
      ))}

      {/* 보라색 정렬 안내선 (수평/수직/끝점) */}
      {guides.map((g, i) => (
        <Line key={`g${i}`} points={[toWorld(g.anchor), toWorld(g.to)]} color="#a855f7" lineWidth={1} dashed dashSize={0.25} gapSize={0.18} />
      ))}

      {/* 사각형/원 드래그 미리보기 */}
      {draftView && (
        <>
          {draftView.pts.length > 2 && <Line points={draftLoop} color={SK.active} lineWidth={2} />}
          {tool === "circle" && draft && (
            <Line points={[toWorld({ u: 2 * draft.start.u - draft.current.u, v: 2 * draft.start.v - draft.current.v }), toWorld(draft.current)]} color={SK.guide} lineWidth={1} />
          )}
          <Html position={toWorld(draftView.dimAt)} center style={{ pointerEvents: "none" }}>
            <div className={DIM_ACTIVE}>{draftView.dim}</div>
          </Html>
        </>
      )}

      {/* 현재 그리는 점 체인(선·스플라인·호) + 러버밴드 */}
      {isPointTool && chainLoop.length >= 2 && <Line points={chainLoop} color={SK.active} lineWidth={2} />}
      {isPointTool && points.map((p, i) => (
        <mesh key={i} position={toWorld(p)} renderOrder={4}><sphereGeometry args={[ptSize, 14, 14]} /><meshBasicMaterial color={SK.point} depthTest={false} /></mesh>
      ))}
      {lineDrawing && hover && last && (
        <group>
          <Line points={[toWorld(last), toWorld(hover)]} color={SK.guide} lineWidth={1.5} />
          <Html position={toWorld(midUV(last, hover))} center style={{ pointerEvents: "none" }}>
            <div className={DIM_ACTIVE}>{segLen(last, hover).toFixed(2)} mm</div>
          </Html>
        </group>
      )}
    </group>
  );
}
