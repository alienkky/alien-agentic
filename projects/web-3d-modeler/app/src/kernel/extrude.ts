/**
 * 2D 스케치 프로파일 → 돌출 솔리드 (THREE.ExtrudeGeometry).
 * 선택된 기준면의 (u,v) 프로파일을 평면 법선 방향으로 돌출한다.
 */
import * as THREE from "three";
import type { TessellatedMesh } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";
import type { SketchPlaneDef, SketchPoint } from "./sketchPlane";

export type { SketchPoint } from "./sketchPlane";

export function extrudeProfile(
  points: SketchPoint[],
  plane: SketchPlaneDef,
  depth: number,
  shapeId: string,
): TessellatedMesh {
  const first = points[0];
  if (points.length < 3 || !first) {
    throw new Error("돌출하려면 점이 3개 이상이어야 합니다");
  }

  const shape = new THREE.Shape();
  shape.moveTo(first.u, first.v);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p) shape.lineTo(p.u, p.v);
  }
  shape.closePath();

  // (u,v) 평면에서 +Z(법선)로 돌출 → 평면 basis 로 world 정렬.
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(plane.u[0], plane.u[1], plane.u[2]),
    new THREE.Vector3(plane.v[0], plane.v[1], plane.v[2]),
    new THREE.Vector3(plane.normal[0], plane.normal[1], plane.normal[2]),
  );
  m.setPosition(new THREE.Vector3(plane.origin[0], plane.origin[1], plane.origin[2]));
  geo.applyMatrix4(m);
  geo.computeVertexNormals();

  return geometryToTessellated(geo, shapeId);
}
