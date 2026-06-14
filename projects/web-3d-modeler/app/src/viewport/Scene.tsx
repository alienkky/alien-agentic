/** 씬 구성 — 조명, 그리드, 기준 평면 축, 셰이프들. */
import { Grid } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";
import { CameraRig } from "./CameraRig";
import { ShapeMesh } from "./ShapeMesh";

export function Scene(): JSX.Element {
  const shapes = useAppStore((s) => s.shapes);

  return (
    <>
      <CameraRig />

      {/* 3점 조명 (키/필/림) */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <directionalLight position={[-6, 4, -8]} intensity={0.5} />

      {/* 기준 그리드 (XZ 평면) */}
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellColor="#2a3344"
        sectionSize={5}
        sectionColor="#3a4a63"
        fadeDistance={60}
        infiniteGrid
      />

      {/* 원점 축 */}
      <axesHelper args={[3]} />

      {shapes.map((mesh) => (
        <ShapeMesh key={mesh.shapeId} mesh={mesh} />
      ))}
    </>
  );
}
