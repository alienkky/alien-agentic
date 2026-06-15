/**
 * 저장된 스케치 항목 렌더 (독립). 프로파일 선 + 파란 면, 클릭하면 선택 → 도구→돌출 입력.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useAppStore, type SketchEntity } from "../store/useAppStore";
import { planeToWorld } from "../kernel/sketchPlane";

function SketchItem({ sketch }: { sketch: SketchEntity }): JSX.Element {
  const plane = sketch.plane;
  const selectEntity = useAppStore((s) => s.selectEntity);
  const selected = useAppStore((s) =>
    s.selection.some((it) => it.kind === "sketch" && it.shapeId === sketch.id),
  );

  const items = useMemo(() => {
    return sketch.profiles.map((profile) => {
      const w = profile.map((p) => planeToWorld(plane, p.u, p.v));
      const loop: [number, number, number][] = w.length >= 3 ? [...w, w[0]!] : w;
      let fill: THREE.ShapeGeometry | null = null;
      const first = profile[0];
      if (profile.length >= 3 && first) {
        const shape = new THREE.Shape();
        shape.moveTo(first.u, first.v);
        for (let i = 1; i < profile.length; i++) {
          const p = profile[i];
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
        fill = geo;
      }
      return { loop, fill };
    });
  }, [sketch, plane]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        selectEntity({ kind: "sketch", shapeId: sketch.id, index: -1 });
      }}
    >
      {items.map((it, idx) => (
        <group key={idx}>
          {it.fill && (
            <mesh geometry={it.fill}>
              <meshBasicMaterial color={selected ? "#5b9cff" : "#3a6ea5"} transparent opacity={selected ? 0.4 : 0.18} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
          {it.loop.length >= 2 && <Line points={it.loop} color={selected ? "#5b9cff" : "#4fd1c5"} lineWidth={selected ? 3 : 2} />}
        </group>
      ))}
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
