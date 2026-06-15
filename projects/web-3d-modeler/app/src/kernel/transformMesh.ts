/**
 * 메시 강체 변환 — 패턴(복제) 등에서 정점·법선·모서리를 옮긴다.
 * 위상(triFaceId/faceRanges)은 보존하고 좌표만 바꾼다 (지오메트리 왕복 없이).
 */
import type { TessellatedMesh, EdgePolyline } from "./types";

type V3 = [number, number, number];

export function translateMesh(m: TessellatedMesh, dx: number, dy: number, dz: number, shapeId: string): TessellatedMesh {
  const positions = new Float32Array(m.positions);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = positions[i]! + dx;
    positions[i + 1] = positions[i + 1]! + dy;
    positions[i + 2] = positions[i + 2]! + dz;
  }
  const edges: EdgePolyline[] = m.edges.map((e) => {
    const p = new Float32Array(e.positions);
    for (let i = 0; i < p.length; i += 3) {
      p[i] = p[i]! + dx;
      p[i + 1] = p[i + 1]! + dy;
      p[i + 2] = p[i + 2]! + dz;
    }
    return { edgeId: e.edgeId, positions: p };
  });
  return { ...m, positions, normals: new Float32Array(m.normals), edges, shapeId };
}

function normalize(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Rodrigues 회전: 단위축 k 둘레로 각 angle 회전한 벡터. */
function rotateVec(v: V3, k: V3, c: number, s: number): V3 {
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const crx = k[1] * v[2] - k[2] * v[1];
  const cry = k[2] * v[0] - k[0] * v[2];
  const crz = k[0] * v[1] - k[1] * v[0];
  return [
    v[0] * c + crx * s + k[0] * dot * (1 - c),
    v[1] * c + cry * s + k[1] * dot * (1 - c),
    v[2] * c + crz * s + k[2] * dot * (1 - c),
  ];
}

/** 원점을 지나는 axis 둘레로 angle(rad) 회전. 법선도 함께 회전. */
export function rotateMeshAxis(m: TessellatedMesh, axis: V3, angle: number, shapeId: string): TessellatedMesh {
  const k = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const positions = new Float32Array(m.positions.length);
  const normals = new Float32Array(m.normals.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    const p = rotateVec([m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!], k, c, s);
    positions[i] = p[0]; positions[i + 1] = p[1]; positions[i + 2] = p[2];
    const n = rotateVec([m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!], k, c, s);
    normals[i] = n[0]; normals[i + 1] = n[1]; normals[i + 2] = n[2];
  }
  const edges: EdgePolyline[] = m.edges.map((e) => {
    const p = new Float32Array(e.positions.length);
    for (let i = 0; i < e.positions.length; i += 3) {
      const r = rotateVec([e.positions[i]!, e.positions[i + 1]!, e.positions[i + 2]!], k, c, s);
      p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2];
    }
    return { edgeId: e.edgeId, positions: p };
  });
  return { ...m, positions, normals, edges, shapeId };
}
