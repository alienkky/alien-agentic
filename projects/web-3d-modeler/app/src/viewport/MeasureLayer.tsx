/**
 * 측정 레이어 — 측정 모드에서 클릭한 두 점을 잇고 거리를 표시한다.
 */
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";

export function MeasureLayer(): JSX.Element | null {
  const active = useAppStore((s) => s.measureActive);
  const pts = useAppStore((s) => s.measurePoints);
  if (!active && pts.length === 0) return null;

  const a = pts[0];
  const b = pts[1];
  const mid = a && b ? new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2) : null;
  const dist = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) : 0;

  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={p} renderOrder={5}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#ffd24a" depthTest={false} />
        </mesh>
      ))}
      {a && b && <Line points={[a, b]} color="#ffd24a" lineWidth={2} dashed dashSize={0.3} gapSize={0.2} depthTest={false} />}
      {mid && (
        <Html position={mid} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-black ring-1 ring-amber-300">
            {dist.toFixed(2)} mm
          </div>
        </Html>
      )}
    </group>
  );
}
