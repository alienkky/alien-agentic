/**
 * 저장된 스케치 항목 렌더 (독립). 프로파일 선 + 파란 면, 클릭하면 선택 → 도구→돌출 입력.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useAppStore, type SketchEntity } from "../store/useAppStore";
import { SKETCH_PLANES, planeToWorld } from "../kernel/sketchPlane";

function SketchItem({ sketch }: { sketch: SketchEntity }): JSX.Element {
  const plane = SKETCH_PLANES[sketch.plane];
  const selectEntity = useAppStore((s) => s.selectEntity);
  const selected = useAppStore((s) =>
    s.selection.some((it) => it.kind === "sketch" && it.shapeId === sketch.id),
  );

  const loop = useMemo<[number, number, number][]>(() => {
    const w = sketch.profile.map((p) => planeToWorld(plane, p.u, p.v));
    return w.length >= 2 ? [...w, w[0]!] : w;
  }, [sketch, plane]);

  const fill = useMemo(() => {
    const first = sketch.profile[0];
    if (sketch.profile.length < 3 || !first) return null;
    const shape = new THREE.Shape();
    shape.moveTo(first.u, first.v);
    for (let i = 1; i < sketch.profile.length; i++) {
      const p = sketch.profile[i];
      if (p) shape.lineTo(p.u, p.v);
    }
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...plane.u),
      new THREE.Vector3(...plane.v),
      new THREE.Vector3(...plane.normal),
    );
    m.setPosition(new THREE.Vector3(...plane.origin));
    geo.applyMatrix4(m);
    return geo;
  }, [sketch, plane]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        selectEntity({ kind: "sketch", shapeId: sketch.id, index: -1 });
      }}
    >
      {fill && (
        <mesh geometry={fill}>
          <meshBasicMaterial
            color={selected ? "#5b9cff" : "#3a6ea5"}
            transparent
            opacity={selected ? 0.4 : 0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {loop.length >= 2 && <Line points={loop} color={selected ? "#5b9cff" : "#4fd1c5"} lineWidth={selected ? 3 : 2} />}
    </group>
  );
}

export function SavedSketches(): JSX.Element {
  const sketches = useAppStore((s) => s.sketches);
  return (
    <>
      {sketches.map((s) => (
        <SketchItem key={s.id} sketch={s} />
      ))}
    </>
  );
}
