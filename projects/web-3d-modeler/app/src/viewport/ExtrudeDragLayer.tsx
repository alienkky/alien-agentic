/**
 * 돌출 드래그 핸들 (Shapr3D 손맛): 스케치 1개를 선택하면 법선 방향 핸들이 뜨고,
 * 끌면 실시간으로 돌출 높이가 변하며 미리보기 솔리드가 자란다. 놓으면 새 바디로 확정.
 * 정밀 입력은 도구→돌출 다이얼로그(빼기/합치기 포함)를 쓴다.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";
import type { TessellatedMesh } from "../kernel/types";
import { extrudeProfile } from "../kernel/extrude";

function PreviewSolid({ mesh }: { mesh: TessellatedMesh }): JSX.Element {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    return g;
  }, [mesh]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#5b9cff" transparent opacity={0.45} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function ExtrudeDragLayer(): JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const sketches = useAppStore((s) => s.sketches);
  const drag = useAppStore((s) => s.extrudeDrag);
  const pressing = useRef(false);

  const single = selection.length === 1 && selection[0]!.kind === "sketch" ? selection[0]! : null;
  const sketch = single ? sketches.find((s) => s.id === single.shapeId) : undefined;

  const active = !!sketch && drag?.sketchId === sketch.id;
  const height = active ? drag!.height : 0;

  const preview = useMemo(() => {
    if (!sketch || !active || height <= 0) return [];
    return sketch.profiles
      .filter((p) => p.length >= 3)
      .map((p, i) => extrudeProfile(p, sketch.plane, height, `preview-${i}`));
  }, [sketch, active, height]);

  if (!sketch) return null;

  const o = sketch.plane.origin;
  const N = sketch.plane.normal;
  const d = active ? Math.max(height, 0.3) : 1.5;
  const hp: [number, number, number] = [o[0] + N[0] * d, o[1] + N[1] * d, o[2] + N[2] * d];

  return (
    <group>
      {preview.map((m, i) => (
        <PreviewSolid key={i} mesh={m} />
      ))}
      <Line points={[[o[0], o[1], o[2]], hp]} color="#4fd1c5" lineWidth={2} />
      <mesh
        position={hp}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pressing.current = true;
          if (!useAppStore.getState().extrudeDrag) useAppStore.getState().startExtrudeDrag();
        }}
        onPointerMove={(e) => {
          if (!pressing.current) return;
          const st = useAppStore.getState();
          if (!st.extrudeDrag) return;
          e.stopPropagation();
          // 위로 끌면(movementY 음수) 높이 증가. 화면 픽셀 → 높이.
          st.setExtrudeDragHeight(st.extrudeDrag.height - e.nativeEvent.movementY * 0.05);
        }}
        onPointerUp={(e) => {
          if (!pressing.current) return;
          pressing.current = false;
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          e.stopPropagation();
          if (useAppStore.getState().extrudeDrag) useAppStore.getState().commitExtrudeDrag();
        }}
      >
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshBasicMaterial color={active ? "#5b9cff" : "#4fd1c5"} />
      </mesh>
      {active && (
        <Html position={hp} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-1 ring-blue-300">
            {height.toFixed(1)} mm
          </div>
        </Html>
      )}
    </group>
  );
}
