/**
 * 메시 기반 불리언 (three-bvh-csg) — FAST(결정론) 백엔드의 불리언 경로.
 *
 * OCCT(B-rep) 가 진짜 CAD 불리언이지만, FAST 모드에서도 "구멍 뚫기"가 즉시·확실히
 * 되도록 메시 CSG 로 합/차/교를 처리한다. 메인 스레드에서 CPU(BVH) 로 동작 — WebGL 불필요.
 * 이동 기즈모 오프셋은 brush 의 월드 변환으로 반영한다.
 */
import * as THREE from "three";
import { Evaluator, Brush, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg";
import type { TessellatedMesh, BooleanOp } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";

const OP: Record<BooleanOp, number> = {
  fuse: ADDITION,
  cut: SUBTRACTION,
  common: INTERSECTION,
};

function toGeometry(m: TessellatedMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return geo;
}

export function meshBoolean(
  a: TessellatedMesh,
  b: TessellatedMesh,
  op: BooleanOp,
  resultId: string,
  posA: [number, number, number] = [0, 0, 0],
  posB: [number, number, number] = [0, 0, 0],
): TessellatedMesh {
  const brushA = new Brush(toGeometry(a));
  brushA.position.set(posA[0], posA[1], posA[2]);
  brushA.updateMatrixWorld();
  const brushB = new Brush(toGeometry(b));
  brushB.position.set(posB[0], posB[1], posB[2]);
  brushB.updateMatrixWorld();

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  // 우리 지오메트리에 있는 속성만 처리한다 (기본값엔 uv 가 포함돼 있어 깨진다).
  evaluator.attributes = ["position", "normal"];
  const result = evaluator.evaluate(brushA, brushB, OP[op]);

  return geometryToTessellated(result.geometry, resultId);
}
