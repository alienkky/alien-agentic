/**
 * 메시 기반 불리언 (three-bvh-csg) — FAST(결정론) 백엔드의 불리언 경로.
 *
 * OCCT(B-rep) 가 진짜 CAD 불리언이지만, FAST 모드에서도 "구멍 뚫기"가 즉시·확실히
 * 되도록 메시 CSG 로 합/차/교를 처리한다. 메인 스레드에서 CPU(BVH) 로 동작 — WebGL 불필요.
 *
 * 결과는 메시 수준이라 면 ID 를 보존하지 못한다 → 단일 면(faceId 0)으로 둔다.
 * 외곽선은 EdgesGeometry 로 재생성한다.
 */
import * as THREE from "three";
import { Evaluator, Brush, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg";
import type { TessellatedMesh, EdgePolyline, BooleanOp } from "./types";

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

function toTessellated(geo: THREE.BufferGeometry, shapeId: string): TessellatedMesh {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const posAttr = nonIndexed.getAttribute("position");
  const positions = new Float32Array(posAttr.array);

  if (!nonIndexed.getAttribute("normal")) {
    nonIndexed.computeVertexNormals();
  }
  const normals = new Float32Array(nonIndexed.getAttribute("normal").array);

  const vertCount = positions.length / 3;
  const indices = new Uint32Array(vertCount);
  for (let i = 0; i < vertCount; i++) indices[i] = i;
  const triFaceId = new Uint32Array(vertCount / 3); // 전부 0

  const edges: EdgePolyline[] = [];
  const edgesGeo = new THREE.EdgesGeometry(nonIndexed, 20);
  const ep = edgesGeo.getAttribute("position");
  for (let i = 0; i < ep.count; i += 2) {
    edges.push({
      edgeId: i / 2,
      positions: new Float32Array([
        ep.getX(i), ep.getY(i), ep.getZ(i),
        ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1),
      ]),
    });
  }

  return {
    positions,
    normals,
    indices,
    triFaceId,
    faceRanges: [{ faceId: 0, start: 0, count: indices.length }],
    edges,
    shapeId,
  };
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

  return toTessellated(result.geometry, resultId);
}
