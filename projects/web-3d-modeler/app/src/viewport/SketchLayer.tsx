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

/** 확정된 한 획: 선 + 채움 + 선분별 치수 라벨(클릭 편집). */
function StrokeView({ plane, pts, strokeIndex }: { plane: SketchPlaneDef; pts: SketchPoint[]; strokeIndex: number }): JSX.Element {
  const selectedSeg = useAppStore((s) => s.sketchSelectedSeg);
  const selectSegment = useAppStore((s) => s.selectSketchSegment);
  const setSegmentLength = useAppStore((s) => s.setSegmentLength);
  const clearSeg = useAppStore((s) => s.clearSketchSegment);

  const toWorld = (p: SketchPoint): [number, number, number] => planeToWorld(plane, p.u, p.v);
  const closed = pts.length >= 3;
  const loop = pts.map(toWorld);
  const linePts = closed ? [...loop, loop[0]!] : loop;
  const fill = useMemo(() => fillGeometry(plane, pts), [plane, pts]);
  const isCircleLike = pts.length > 8;

  return (
    <group>
      {fill && <mesh geometry={fill}><meshBasicMaterial color="#5b9cff" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
      {linePts.length >= 2 && <Line points={linePts} color="#4fd1c5" lineWidth={2} />}
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
        <mesh
          onPointerDown={(e) => { e.stopPropagation(); if (tool === "line") clickPoint(onPlane(e)); else dragStart(onPlane(e)); }}
          onPointerMove={(e) => { e.stopPropagation(); dragMove(onPlane(e)); }}
          onPointerUp={(e) => { e.stopPropagation(); dragEnd(); }}
        >
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color={planeColorFor(plane)} transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 누적된 확정 획들 */}
      {strokes.map((stroke, i) => (
        <StrokeView key={i} plane={plane} pts={stroke} strokeIndex={i} />
      ))}

      {/* 사각형/원 드래그 미리보기 */}
      {draftView && (
        <>
          {draftView.pts.length > 2 && <Line points={draftLoop} color="#4fd1c5" lineWidth={2} />}
          {tool === "circle" && draft && (
            <Line points={[toWorld({ u: 2 * draft.start.u - draft.current.u, v: 2 * draft.start.v - draft.current.v }), toWorld(draft.current)]} color="#e6ebf2" lineWidth={1} />
          )}
          <Html position={toWorld(draftView.dimAt)} center style={{ pointerEvents: "none" }}>
            <div className={DIM_ACTIVE}>{draftView.dim}</div>
          </Html>
        </>
      )}

      {/* 현재 그리는 선 체인 + 러버밴드 */}
      {tool === "line" && chainLoop.length >= 2 && <Line points={chainLoop} color="#4fd1c5" lineWidth={2} />}
      {tool === "line" && points.map((p, i) => (
        <mesh key={i} position={toWorld(p)}><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial color="#4fd1c5" /></mesh>
      ))}
      {lineDrawing && hover && last && (
        <group>
          <Line points={[toWorld(last), toWorld(hover)]} color="#8b97a8" lineWidth={1.5} />
          <Html position={toWorld(midUV(last, hover))} center style={{ pointerEvents: "none" }}>
            <div className={DIM_ACTIVE}>{segLen(last, hover).toFixed(2)} mm</div>
          </Html>
        </group>
      )}
    </group>
  );
}
