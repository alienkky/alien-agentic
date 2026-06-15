/** 씬 구성 — 조명, 그리드, 기준 축, 셰이프들(+ 1개 선택 시 이동 기즈모). */
import { useState } from "react";
import * as THREE from "three";
import { Grid, TransformControls } from "@react-three/drei";
import { useAppStore, selectionBodyIds, type Vec3 } from "../store/useAppStore";
import type { TessellatedMesh } from "../kernel/types";
import { CameraRig } from "./CameraRig";
import { ShapeMesh } from "./ShapeMesh";
import { SketchLayer } from "./SketchLayer";
import { SavedSketches } from "./SavedSketches";

const ORIGIN: Vec3 = [0, 0, 0];

function MovableShape({ mesh, gizmo }: { mesh: TessellatedMesh; gizmo: boolean }): JSX.Element {
  // 감싸는 방식 대신 우리 그룹을 object 로 직접 제어한다.
  // (감싸면 drei 가 내부 래퍼를 움직여 실제 위치가 저장되지 않고 deselect 시 원위치로 튕긴다.)
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const pos = useAppStore((s) => s.transforms[mesh.shapeId] ?? ORIGIN);
  const setTransform = useAppStore((s) => s.setTransform);
  const setGizmoDragging = useAppStore((s) => s.setGizmoDragging);

  return (
    <>
      <group ref={setObj} position={pos}>
        <ShapeMesh mesh={mesh} />
      </group>
      {gizmo && obj && (
        <TransformControls
          object={obj}
          mode="translate"
          onMouseDown={() => setGizmoDragging(true)}
          onMouseUp={() => setGizmoDragging(false)}
          onObjectChange={() =>
            setTransform(mesh.shapeId, [obj.position.x, obj.position.y, obj.position.z])
          }
        />
      )}
    </>
  );
}

export function Scene(): JSX.Element {
  const shapes = useAppStore((s) => s.shapes);
  const selection = useAppStore((s) => s.selection);
  const sketchActive = useAppStore((s) => s.sketchActive);
  const showGrid = useAppStore((s) => s.showGrid);
  const showAxes = useAppStore((s) => s.showAxes);
  const hidden = useAppStore((s) => s.hidden);

  // 선택이 정확히 한 바디에 속할 때만 이동 기즈모를 보인다.
  const bodyIds = selectionBodyIds(selection);
  const gizmoId = !sketchActive && bodyIds.length === 1 ? bodyIds[0] : null;

  return (
    <>
      <CameraRig />

      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <directionalLight position={[-6, 4, -8]} intensity={0.5} />

      {showGrid && (
        <Grid args={[40, 40]} cellSize={1} cellColor="#2a3344" sectionSize={5} sectionColor="#3a4a63" fadeDistance={60} infiniteGrid />
      )}
      {showAxes && <axesHelper args={[3]} />}

      {shapes
        .filter((mesh) => !hidden.includes(mesh.shapeId))
        .map((mesh) => (
          <MovableShape key={mesh.shapeId} mesh={mesh} gizmo={mesh.shapeId === gizmoId} />
        ))}

      <SavedSketches />
      <SketchLayer />
    </>
  );
}
