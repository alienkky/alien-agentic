/** 씬 구성 — 조명, 그리드, 기준 축, 셰이프들(+ 1개 선택 시 이동 기즈모). */
import { useRef } from "react";
import * as THREE from "three";
import { Grid, TransformControls } from "@react-three/drei";
import { useAppStore, type Vec3 } from "../store/useAppStore";
import type { TessellatedMesh } from "../kernel/types";

const ORIGIN: Vec3 = [0, 0, 0];
import { CameraRig } from "./CameraRig";
import { ShapeMesh } from "./ShapeMesh";
import { SketchLayer } from "./SketchLayer";

function MovableShape({ mesh, gizmo }: { mesh: TessellatedMesh; gizmo: boolean }): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useAppStore((s) => s.transforms[mesh.shapeId] ?? ORIGIN);
  const setTransform = useAppStore((s) => s.setTransform);
  const setGizmoDragging = useAppStore((s) => s.setGizmoDragging);

  const content = (
    <group ref={groupRef} position={pos}>
      <ShapeMesh mesh={mesh} />
    </group>
  );

  if (!gizmo) return content;

  return (
    <TransformControls
      mode="translate"
      onMouseDown={() => setGizmoDragging(true)}
      onMouseUp={() => setGizmoDragging(false)}
      onObjectChange={() => {
        const g = groupRef.current;
        if (g) setTransform(mesh.shapeId, [g.position.x, g.position.y, g.position.z]);
      }}
    >
      {content}
    </TransformControls>
  );
}

export function Scene(): JSX.Element {
  const shapes = useAppStore((s) => s.shapes);
  const selected = useAppStore((s) => s.selectedShapeIds);
  const sketchActive = useAppStore((s) => s.sketchActive);

  // 정확히 1개 선택이고 스케치 중이 아닐 때만 이동 기즈모를 보인다.
  const gizmoId = !sketchActive && selected.length === 1 ? selected[0] : null;

  return (
    <>
      <CameraRig />

      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <directionalLight position={[-6, 4, -8]} intensity={0.5} />

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellColor="#2a3344"
        sectionSize={5}
        sectionColor="#3a4a63"
        fadeDistance={60}
        infiniteGrid
      />
      <axesHelper args={[3]} />

      {shapes.map((mesh) => (
        <MovableShape key={mesh.shapeId} mesh={mesh} gizmo={mesh.shapeId === gizmoId} />
      ))}

      <SketchLayer />
    </>
  );
}
