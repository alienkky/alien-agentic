/**
 * 2D 스케치 프로파일 → 돌출 솔리드 (THREE.ExtrudeGeometry).
 * 임의 다각형을 지면(XZ 평면) 위에서 +Y 로 돌출한다. OCCT 없이 동작 — 검증 가능.
 */
import * as THREE from "three";
import type { TessellatedMesh } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";

/** 지면(XZ) 위 스케치 점. */
export interface SketchPoint {
  x: number;
  z: number;
}

export function extrudeProfile(points: SketchPoint[], depth: number, shapeId: string): TessellatedMesh {
  const first = points[0];
  if (points.length < 3 || !first) {
    throw new Error("돌출하려면 점이 3개 이상이어야 합니다");
  }

  // 지면 점(x,z) → 2D shape(x, -z). -z 로 두면 +Y 돌출 후 발자국이 원래 XZ 와 일치.
  const shape = new THREE.Shape();
  shape.moveTo(first.x, -first.z);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p) shape.lineTo(p.x, -p.z);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // 돌출축 Z → Y (지면 위로 일어선다)
  geo.computeVertexNormals();

  return geometryToTessellated(geo, shapeId);
}
