/**
 * 결정론적 구 테셀레이터 (UV 스피어).
 * 원점 중심. 단일 면(faceId 0), 노멀 = 위치 정규화. 모서리: 적도 원(edgeId 0).
 */
import type { TessellatedMesh, EdgePolyline } from "../types";

const STACKS = 24; // 위도
const SLICES = 48; // 경도

export function tessellateSphere(radius: number, shapeId: string): TessellatedMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const triFaceId: number[] = [];

  for (let i = 0; i <= STACKS; i++) {
    const phi = (i / STACKS) * Math.PI; // 0..PI (북극→남극)
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let j = 0; j <= SLICES; j++) {
      const theta = (j / SLICES) * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta);
      const ny = cosPhi;
      const nz = sinPhi * Math.sin(theta);
      positions.push(radius * nx, radius * ny, radius * nz);
      normals.push(nx, ny, nz);
    }
  }

  const cols = SLICES + 1;
  for (let i = 0; i < STACKS; i++) {
    for (let j = 0; j < SLICES; j++) {
      const a = i * cols + j;
      const b = a + cols;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
      triFaceId.push(0, 0);
    }
  }

  const edges: EdgePolyline[] = [equatorEdge(radius)];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    triFaceId: new Uint32Array(triFaceId),
    faceRanges: [{ faceId: 0, start: 0, count: indices.length }],
    edges,
    shapeId,
  };
}

function equatorEdge(radius: number): EdgePolyline {
  const pts: number[] = [];
  for (let i = 0; i <= SLICES; i++) {
    const a = (i / SLICES) * Math.PI * 2;
    pts.push(radius * Math.cos(a), 0, radius * Math.sin(a));
  }
  return { edgeId: 0, positions: new Float32Array(pts) };
}
