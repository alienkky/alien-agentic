/**
 * 결정론적 실린더 테셀레이터.
 * Y축 정렬, 원점 중심. 면 3개: 옆면(faceId 0)·윗뚜껑(1)·아랫뚜껑(2).
 * 박스와 동일한 TessellatedMesh 포맷(triFaceId/faceRanges/edges).
 */
import type { TessellatedMesh, FaceRange, EdgePolyline } from "../types";

const SEGMENTS = 48;

export function tessellateCylinder(radius: number, height: number, shapeId: string): TessellatedMesh {
  const hy = height / 2;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const triFaceId: number[] = [];
  const faceRanges: FaceRange[] = [];

  const pushVertex = (px: number, py: number, pz: number, nx: number, ny: number, nz: number): number => {
    positions.push(px, py, pz);
    normals.push(nx, ny, nz);
    return positions.length / 3 - 1;
  };

  // ── 옆면 (faceId 0) — 라디얼 노멀 ──
  let start = indices.length;
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = pushVertex(radius * c0, -hy, radius * s0, c0, 0, s0);
    const t0 = pushVertex(radius * c0, hy, radius * s0, c0, 0, s0);
    const b1 = pushVertex(radius * c1, -hy, radius * s1, c1, 0, s1);
    const t1 = pushVertex(radius * c1, hy, radius * s1, c1, 0, s1);
    indices.push(b0, b1, t1, b0, t1, t0);
    triFaceId.push(0, 0);
  }
  faceRanges.push({ faceId: 0, start, count: indices.length - start });

  // ── 윗뚜껑 (faceId 1) — +Y 팬 ──
  start = indices.length;
  const topCenter = pushVertex(0, hy, 0, 0, 1, 0);
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const r0 = pushVertex(radius * Math.cos(a0), hy, radius * Math.sin(a0), 0, 1, 0);
    const r1 = pushVertex(radius * Math.cos(a1), hy, radius * Math.sin(a1), 0, 1, 0);
    indices.push(topCenter, r0, r1);
    triFaceId.push(1);
  }
  faceRanges.push({ faceId: 1, start, count: indices.length - start });

  // ── 아랫뚜껑 (faceId 2) — -Y 팬 ──
  start = indices.length;
  const botCenter = pushVertex(0, -hy, 0, 0, -1, 0);
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const r0 = pushVertex(radius * Math.cos(a0), -hy, radius * Math.sin(a0), 0, -1, 0);
    const r1 = pushVertex(radius * Math.cos(a1), -hy, radius * Math.sin(a1), 0, -1, 0);
    indices.push(botCenter, r1, r0);
    triFaceId.push(2);
  }
  faceRanges.push({ faceId: 2, start, count: indices.length - start });

  // ── 모서리: 위/아래 원 ──
  const edges: EdgePolyline[] = [circleEdge(0, radius, hy), circleEdge(1, radius, -hy)];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    triFaceId: new Uint32Array(triFaceId),
    faceRanges,
    edges,
    shapeId,
  };
}

function circleEdge(edgeId: number, radius: number, y: number): EdgePolyline {
  const pts: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    pts.push(radius * Math.cos(a), y, radius * Math.sin(a));
  }
  return { edgeId, positions: new Float32Array(pts) };
}
