/**
 * THREE.BufferGeometry → TessellatedMesh 변환 (메시 불리언·돌출 공용).
 * 결과는 메시 수준이라 면 ID 를 보존하지 못한다 → 단일 면(faceId 0). 외곽선은 EdgesGeometry.
 */
import * as THREE from "three";
import type { TessellatedMesh, EdgePolyline } from "./types";

export function geometryToTessellated(geo: THREE.BufferGeometry, shapeId: string): TessellatedMesh {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  if (!nonIndexed.getAttribute("normal")) {
    nonIndexed.computeVertexNormals();
  }

  const positions = new Float32Array(nonIndexed.getAttribute("position").array);
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
