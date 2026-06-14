/**
 * 결정론적 박스 테셀레이터.
 *
 * Phase 0 의 '살아있는' 기본 커널 — OCCT WASM 없이도 전체 파이프라인
 * (워커 → 브릿지 → 테셀레이션 메타데이터 → 뷰포트 → 픽킹 준비)을 끝까지 증명한다.
 * 면(faceId 0~5)·모서리(edgeId 0~11) ID 를 표준 포맷(TessellatedMesh)에 정확히 싣는다.
 *
 * OCCT 백엔드(occtModule.ts)가 device 검증을 통과하면, worker 의 backend 스위치만
 * 바꿔 이 모듈을 대체한다. 인터페이스는 동일하므로 그 위 레이어는 손대지 않는다.
 */
import type { TessellatedMesh, FaceRange, EdgePolyline } from "../types";

interface FaceDef {
  faceId: number;
  normal: [number, number, number];
  /** 바깥에서 봤을 때 CCW 인 4모서리(반시계) */
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
}

export function tessellateBox(width: number, height: number, depth: number, shapeId: string): TessellatedMesh {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;

  // 8 꼭짓점
  const v = {
    nnn: [-x, -y, -z] as [number, number, number],
    pnn: [x, -y, -z] as [number, number, number],
    ppn: [x, y, -z] as [number, number, number],
    npn: [-x, y, -z] as [number, number, number],
    nnp: [-x, -y, z] as [number, number, number],
    pnp: [x, -y, z] as [number, number, number],
    ppp: [x, y, z] as [number, number, number],
    npp: [-x, y, z] as [number, number, number],
  };

  const faces: FaceDef[] = [
    { faceId: 0, normal: [1, 0, 0], corners: [v.pnn, v.ppn, v.ppp, v.pnp] }, // +X
    { faceId: 1, normal: [-1, 0, 0], corners: [v.nnp, v.npp, v.npn, v.nnn] }, // -X
    { faceId: 2, normal: [0, 1, 0], corners: [v.npn, v.npp, v.ppp, v.ppn] }, // +Y
    { faceId: 3, normal: [0, -1, 0], corners: [v.nnn, v.pnn, v.pnp, v.nnp] }, // -Y
    { faceId: 4, normal: [0, 0, 1], corners: [v.nnp, v.pnp, v.ppp, v.npp] }, // +Z
    { faceId: 5, normal: [0, 0, -1], corners: [v.nnn, v.npn, v.ppn, v.pnn] }, // -Z
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const triFaceId: number[] = [];
  const faceRanges: FaceRange[] = [];

  for (const face of faces) {
    const baseVertex = positions.length / 3;
    const indexStart = indices.length;

    for (const c of face.corners) {
      positions.push(c[0], c[1], c[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
    }
    // 사각형 → 삼각형 2개 (CCW): (0,1,2) (0,2,3)
    indices.push(baseVertex, baseVertex + 1, baseVertex + 2);
    indices.push(baseVertex, baseVertex + 2, baseVertex + 3);
    triFaceId.push(face.faceId, face.faceId);

    faceRanges.push({ faceId: face.faceId, start: indexStart, count: 6 });
  }

  // 12 모서리
  const e = (a: [number, number, number], b: [number, number, number]) =>
    new Float32Array([a[0], a[1], a[2], b[0], b[1], b[2]]);
  const edges: EdgePolyline[] = [
    { edgeId: 0, positions: e(v.nnn, v.pnn) },
    { edgeId: 1, positions: e(v.pnn, v.ppn) },
    { edgeId: 2, positions: e(v.ppn, v.npn) },
    { edgeId: 3, positions: e(v.npn, v.nnn) },
    { edgeId: 4, positions: e(v.nnp, v.pnp) },
    { edgeId: 5, positions: e(v.pnp, v.ppp) },
    { edgeId: 6, positions: e(v.ppp, v.npp) },
    { edgeId: 7, positions: e(v.npp, v.nnp) },
    { edgeId: 8, positions: e(v.nnn, v.nnp) },
    { edgeId: 9, positions: e(v.pnn, v.pnp) },
    { edgeId: 10, positions: e(v.ppn, v.ppp) },
    { edgeId: 11, positions: e(v.npn, v.npp) },
  ];

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
