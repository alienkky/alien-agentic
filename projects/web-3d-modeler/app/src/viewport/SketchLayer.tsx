/**
 * 스케치 모드 레이어 (Shapr3D 방식):
 *  1) 기준면 미선택: 3개 평면(XY/YZ/XZ)을 보여주고 클릭 → 그 면을 정면으로 정렬.
 *  2) 면 선택됨: 그 평면 위에서 드래그로 그리기(러버밴드 + 실시간 치수 + 파란 면).
 */
import { useMemo, useState } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";
import {
  SKETCH_PLANES, planeToWorld, worldToPlane,
  type PlaneId, type SketchPlaneDef, type SketchPoint,
} from "../kernel/sketchPlane";

const PLANE_ROT: Record<PlaneId, [number, number, number]> = {
  xz: [-Math.PI / 2, 0, 0],
  xy: [0, 0, 0],
  yz: [0, Math.PI / 2, 0],
};
const PLANE_COLOR: Record<PlaneId, string> = { xz: "#4fd1c5", xy: "#5b9cff", yz: "#e06fae" };

function planeMatrix(plane: SketchPlaneDef): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...plane.u),
    new THREE.Vector3(...plane.v),
    new THREE.Vector3(...plane.normal),
  );
  m.setPosition(new THREE.Vector3(...plane.origin));
  return m;
}

function rectPts(a: SketchPoint, b: SketchPoint): SketchPoint[] {
  return [
    { u: a.u, v: a.v }, { u: b.u, v: a.v }, { u: b.u, v: b.v }, { u: a.u, v: b.v },
  ];
}
function circlePts(c: SketchPoint, r: number, seg = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push({ u: c.u + r * Math.cos(a), v: c.v + r * Math.sin(a) });
  }
  return out;
}

function segLen(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(b.u - a.u, b.v - a.v);
}
function midUV(a: SketchPoint, b: SketchPoint): SketchPoint {
  return { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 };
}

/** 선분 치수 입력 박스 (펜/터치: inputMode decimal → 숫자 키패드). */
function SegmentDimInput({ value, onCommit, onCancel }: { value: number; onCommit: (n: number) => void; onCancel: () => void }): JSX.Element {
  const [text, setText] = useState(value.toFixed(2));
  return (
    <input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.5"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          const n = parseFloat(text);
          if (!Number.isNaN(n)) onCommit(n);
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={() => {
        const n = parseFloat(text);
        if (!Number.isNaN(n) && Math.abs(n - value) > 1e-6) onCommit(n);
        else onCancel();
      }}
      className="w-20 rounded bg-blue-600 px-1.5 py-1 text-center text-sm font-semibold text-white outline-none ring-2 ring-blue-300"
    />
  );
}

const DIM_LABEL = "whitespace-nowrap rounded bg-aa-bg/90 px-1.5 py-0.5 text-xs font-semibold text-aa-accent";
const DIM_ACTIVE = "whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-1 ring-blue-300";

/** 평면 선택 UI — 3개 클릭 가능한 사각형. */
function PlanePicker(): JSX.Element {
  const pickPlane = useAppStore((s) => s.pickPlane);
  const ids: PlaneId[] = ["xz", "xy", "yz"];
  return (
    <group>
      {ids.map((id) => (
        <mesh
          key={id}
          rotation={PLANE_ROT[id]}
          onClick={(e) => {
            e.stopPropagation();
            pickPlane(id);
          }}
        >
          <planeGeometry args={[8, 8]} />
          <meshBasicMaterial color={PLANE_COLOR[id]} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Html position={[0, 0.2, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-aa-bg/90 px-2 py-1 text-xs text-aa-text">
          기준면을 선택하세요
        </div>
      </Html>
    </group>
  );
}

export function SketchLayer(): JSX.Element | null {
  const active = useAppStore((s) => s.sketchActive);
  const planeId = useAppStore((s) => s.sketchPlane);
  const tool = useAppStore((s) => s.sketchTool);
  const draft = useAppStore((s) => s.sketchDraft);
  const hover = useAppStore((s) => s.sketchHover);
  const points = useAppStore((s) => s.sketchPoints);
  const dragStart = useAppStore((s) => s.sketchDragStart);
  const dragMove = useAppStore((s) => s.sketchDragMove);
  const dragEnd = useAppStore((s) => s.sketchDragEnd);
  const clickPoint = useAppStore((s) => s.sketchClickPoint);
  const selectedSeg = useAppStore((s) => s.sketchSelectedSeg);
  const selectSegment = useAppStore((s) => s.selectSketchSegment);
  const setSegmentLength = useAppStore((s) => s.setSegmentLength);
  const lineDrawing = useAppStore((s) => s.sketchLineDrawing);

  const plane = planeId ? SKETCH_PLANES[planeId] : null;

  // 미리보기 프로파일(u,v) + 치수
  const { preview, close, dim } = useMemo(() => {
    let preview: SketchPoint[] = [];
    let close = false;
    let dim: { label: string; uv: SketchPoint } | null = null;
    if (draft) {
      const { start, current } = draft;
      if (tool === "circle") {
        const r = Math.hypot(current.u - start.u, current.v - start.v);
        preview = circlePts(start, r); close = true;
        dim = { label: `⌀ ${(r * 2).toFixed(4)} mm`, uv: midUV(start, current) };
      } else {
        preview = rectPts(start, current); close = true;
        dim = {
          label: `${Math.abs(current.u - start.u).toFixed(2)} × ${Math.abs(current.v - start.v).toFixed(2)} mm`,
          uv: { u: (start.u + current.u) / 2, v: (start.v + current.v) / 2 },
        };
      }
    } else if (tool === "line") {
      preview = hover ? [...points, hover] : points; close = false;
    } else {
      preview = points; close = points.length >= 3;
    }
    return { preview, close, dim };
  }, [draft, hover, points, tool]);

  const fillGeo = useMemo(() => {
    if (!plane) return null;
    const fillPts = draft ? preview : points;
    const first = fillPts[0];
    if (fillPts.length < 3 || !first) return null;
    const shape = new THREE.Shape();
    shape.moveTo(first.u, first.v);
    for (let i = 1; i < fillPts.length; i++) {
      const p = fillPts[i];
      if (p) shape.lineTo(p.u, p.v);
    }
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.applyMatrix4(planeMatrix(plane));
    return geo;
  }, [plane, preview, points, draft]);

  if (!active) return null;
  if (!plane) return <PlanePicker />;

  const toWorld = (p: SketchPoint): [number, number, number] => planeToWorld(plane, p.u, p.v);
  const loop = preview.map(toWorld);
  const linePts = close && loop.length >= 3 ? [...loop, loop[0]!] : loop;
  const onPlane = (e: { point: THREE.Vector3 }) => worldToPlane(plane, e.point.x, e.point.y, e.point.z);

  return (
    <group>
      {/* 선택 평면 위 레이캐스트용 큰 면 */}
      <mesh
        rotation={PLANE_ROT[plane.id]}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (tool === "line") clickPoint(onPlane(e));
          else dragStart(onPlane(e));
        }}
        onPointerMove={(e) => { e.stopPropagation(); dragMove(onPlane(e)); }}
        onPointerUp={(e) => { e.stopPropagation(); dragEnd(); }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={PLANE_COLOR[plane.id]} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>

      {fillGeo && (
        <mesh geometry={fillGeo}>
          <meshBasicMaterial color="#5b9cff" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* 선 도구: 선분별 클릭+치수, 그 외: 단일 루프 */}
      {tool === "line" ? (
        <>
          {points.map((p, i) => (
            <mesh key={`pt${i}`} position={toWorld(p)}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshBasicMaterial color="#4fd1c5" />
            </mesh>
          ))}

          {points.map((a, i) => {
            const b = points[i + 1];
            if (!b) return null;
            const isSel = selectedSeg === i;
            return (
              <group key={`seg${i}`}>
                <Line
                  points={[toWorld(a), toWorld(b)]}
                  color={isSel ? "#5b9cff" : "#4fd1c5"}
                  lineWidth={isSel ? 4 : 2}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectSegment(i);
                  }}
                />
                <Html position={toWorld(midUV(a, b))} center style={{ pointerEvents: isSel ? "auto" : "none" }}>
                  {isSel ? (
                    <SegmentDimInput
                      value={segLen(a, b)}
                      onCommit={(n) => setSegmentLength(i, n)}
                      onCancel={() => useAppStore.getState().clearSketchSegment()}
                    />
                  ) : (
                    <div className={DIM_LABEL}>{segLen(a, b).toFixed(2)} mm</div>
                  )}
                </Html>
              </group>
            );
          })}

          {/* 러버밴드: 그리는 중에만, 마지막 점 → 커서 + 실시간 길이(파란 박스) */}
          {lineDrawing && hover && points.length > 0 && (
            <group>
              <Line points={[toWorld(points[points.length - 1]!), toWorld(hover)]} color="#8b97a8" lineWidth={1.5} />
              <Html position={toWorld(midUV(points[points.length - 1]!, hover))} center style={{ pointerEvents: "none" }}>
                <div className={DIM_ACTIVE}>{segLen(points[points.length - 1]!, hover).toFixed(2)} mm</div>
              </Html>
            </group>
          )}
        </>
      ) : (
        <>
          {linePts.length >= 2 && <Line points={linePts} color="#4fd1c5" lineWidth={2} />}
          {/* 원: 지름선 표시 */}
          {draft && tool === "circle" && (
            <Line
              points={[
                toWorld({ u: 2 * draft.start.u - draft.current.u, v: 2 * draft.start.v - draft.current.v }),
                toWorld(draft.current),
              ]}
              color="#e6ebf2"
              lineWidth={1}
            />
          )}
          {dim && (
            <Html position={toWorld(dim.uv)} center style={{ pointerEvents: "none" }}>
              <div className={DIM_ACTIVE}>{dim.label}</div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
