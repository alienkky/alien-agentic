/**
 * 스케치 모드 레이어 (Shapr3D 방식):
 *  - 평면을 정면(탑다운)으로 보고 그린다 (beginSketch 가 카메라를 top 으로).
 *  - 사각형/원: 드래그(누르고 끌어 놓기) — 실시간 러버밴드 미리보기 + 치수 표시.
 *  - 선: 점을 순서대로 탭, 커서까지 미리보기 선.
 */
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";
import type { SketchPoint } from "../kernel/extrude";

/** 닫힌 프로파일 → THREE.Shape (지면 매핑: x, -z). */
function profileShape(pts: SketchPoint[]): THREE.Shape | null {
  const first = pts[0];
  if (pts.length < 3 || !first) return null;
  const shape = new THREE.Shape();
  shape.moveTo(first.x, -first.z);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) shape.lineTo(p.x, -p.z);
  }
  shape.closePath();
  return shape;
}

function rectPts(a: SketchPoint, b: SketchPoint): SketchPoint[] {
  return [
    { x: a.x, z: a.z },
    { x: b.x, z: a.z },
    { x: b.x, z: b.z },
    { x: a.x, z: b.z },
  ];
}

function circlePts(c: SketchPoint, r: number, seg = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push({ x: c.x + r * Math.cos(a), z: c.z + r * Math.sin(a) });
  }
  return out;
}

export function SketchLayer(): JSX.Element | null {
  const active = useAppStore((s) => s.sketchActive);
  const tool = useAppStore((s) => s.sketchTool);
  const draft = useAppStore((s) => s.sketchDraft);
  const hover = useAppStore((s) => s.sketchHover);
  const points = useAppStore((s) => s.sketchPoints);
  const dragStart = useAppStore((s) => s.sketchDragStart);
  const dragMove = useAppStore((s) => s.sketchDragMove);
  const dragEnd = useAppStore((s) => s.sketchDragEnd);
  const clickPoint = useAppStore((s) => s.sketchClickPoint);

  if (!active) return null;

  // 미리보기 프로파일 + 치수
  let preview: SketchPoint[] = [];
  let close = false;
  let dim: { label: string; at: [number, number, number] } | null = null;

  if (draft) {
    const { start, current } = draft;
    if (tool === "circle") {
      const r = Math.hypot(current.x - start.x, current.z - start.z);
      preview = circlePts(start, r);
      close = true;
      dim = { label: `R ${r.toFixed(1)}`, at: [start.x, 0.1, start.z] };
    } else {
      preview = rectPts(start, current);
      close = true;
      dim = {
        label: `${Math.abs(current.x - start.x).toFixed(1)} × ${Math.abs(current.z - start.z).toFixed(1)}`,
        at: [(start.x + current.x) / 2, 0.1, (start.z + current.z) / 2],
      };
    }
  } else if (tool === "line") {
    preview = hover ? [...points, hover] : points;
    close = false;
  } else {
    preview = points;
    close = points.length >= 3;
  }

  const loop: [number, number, number][] = preview.map((p) => [p.x, 0.02, p.z]);
  const linePts = close && loop.length >= 3 ? [...loop, loop[0]!] : loop;

  // 닫힌 면 → 파란색 채움 (돌출 가능 신호, Shapr3D 시그니처).
  // 사각형/원은 항상 닫힘. 선은 점 3개 이상이면 자동 폐합.
  const fillPts = draft ? preview : points;
  const fillShape = profileShape(fillPts);

  return (
    <group>
      {/* 레이캐스트용 지면 평면 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (tool === "line") clickPoint({ x: e.point.x, z: e.point.z });
          else dragStart({ x: e.point.x, z: e.point.z });
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          dragMove({ x: e.point.x, z: e.point.z });
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          dragEnd();
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#4fd1c5" transparent opacity={0.04} />
      </mesh>

      {/* 닫힌 면 파란색 채움 — 돌출 가능 신호 */}
      {fillShape && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial
            color="#5b9cff"
            transparent
            opacity={0.28}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 확정 점 마커 (선 도구) */}
      {tool === "line" &&
        !draft &&
        points.map((p, i) => (
          <mesh key={i} position={[p.x, 0.02, p.z]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#4fd1c5" />
          </mesh>
        ))}

      {/* 프로파일 / 러버밴드 선 */}
      {linePts.length >= 2 && <Line points={linePts} color="#4fd1c5" lineWidth={2} />}

      {/* 실시간 치수 */}
      {dim && (
        <Html position={dim.at} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-aa-bg/90 px-1.5 py-0.5 text-xs font-semibold text-aa-accent">
            {dim.label}
          </div>
        </Html>
      )}
    </group>
  );
}
