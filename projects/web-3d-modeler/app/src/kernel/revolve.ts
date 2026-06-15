/**
 * 회전체(Revolve) — 2D 스케치 프로파일을 평면 내 축 둘레로 회전시켜 솔리드 생성.
 * 돌출(extrude)의 형제. 축대칭 부품(컵·병·핀·링·풀리)을 만든다.
 *
 * 축은 스케치 평면 안의 한 직선:
 *  - axis "v": v축(u=0 직선) 둘레 회전 → 반지름 = |u|, 높이 = v
 *  - axis "u": u축(v=0 직선) 둘레 회전 → 반지름 = |v|, 높이 = u
 * 프로파일은 축 한쪽(예: u>0)에 있어야 깔끔하다(축을 가로지르면 접힌다).
 */
import * as THREE from "three";
import type { TessellatedMesh } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";
import type { SketchPlaneDef, SketchPoint } from "./sketchPlane";

export type RevolveAxis = "u" | "v";

export function revolveProfile(
  points: SketchPoint[],
  plane: SketchPlaneDef,
  angleDeg: number,
  axis: RevolveAxis,
  shapeId: string,
): TessellatedMesh {
  if (points.length < 3) {
    throw new Error("회전하려면 점이 3개 이상이어야 합니다");
  }
  const angle = THREE.MathUtils.degToRad(Math.min(360, Math.max(1, angleDeg)));

  // LatheGeometry: Vector2(x=반지름, y=높이) 를 로컬 Y축 둘레로 회전.
  const lathePts = points.map((p) => {
    const radius = axis === "v" ? Math.abs(p.u) : Math.abs(p.v);
    const height = axis === "v" ? p.v : p.u;
    return new THREE.Vector2(radius, height);
  });
  // 닫힌 프로파일이 되도록 첫 점을 끝에 더한다(폴리라인 닫기).
  const first = lathePts[0]!;
  const last = lathePts[lathePts.length - 1]!;
  if (first.distanceTo(last) > 1e-6) lathePts.push(first.clone());

  const geo = new THREE.LatheGeometry(lathePts, 96, 0, angle);

  // 로컬(x=sin·r, y=height, z=cos·r) → 월드 평면 basis 정렬.
  //  phi=0 에서 반지름이 그린 위치(U 또는 V)와 일치하도록 z→(그 축), x→법선.
  const U = new THREE.Vector3(...plane.u);
  const V = new THREE.Vector3(...plane.v);
  const N = new THREE.Vector3(...plane.normal);
  const m = new THREE.Matrix4();
  if (axis === "v") m.makeBasis(N, V, U); // 높이=V, 반지름 시작=U
  else m.makeBasis(N, U, V); // 높이=U, 반지름 시작=V
  m.setPosition(new THREE.Vector3(...plane.origin));
  geo.applyMatrix4(m);
  geo.computeVertexNormals();

  return geometryToTessellated(geo, shapeId);
}
