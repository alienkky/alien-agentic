/**
 * 면 Push/Pull 공통 — 백엔드 무관 순수 로직 (Phase 3 슬라이스 2).
 *
 * 평면(planar) 면을 그 법선 방향으로 밀고(−)/당겨(+) 형상을 변형한다.
 *  - FAST(메시) 경로: 면이 놓인 평면 위의 모든 정점을 법선 방향으로 평행이동한다.
 *    각형(prism) 바디의 평면 면에 대해 결과 부피 변화가 정확하다 → 이 파일이 단위테스트 대상.
 *  - OCCT 경로: 진짜 B-rep 프리즘 + 불리언(occtModule). 비평면(곡면) 면은 양쪽 모두 거부.
 *
 * 불변식(WORKFLOW §4): faceId/edgeId 토폴로지 ID 는 변형 후에도 보존된다 — 우리는 같은
 * faceRanges/triFaceId/edgeId 구조를 그대로 들고 좌표만 옮긴다(재발급 일관성).
 */
import type { TessellatedMesh, FaceRange, EdgePolyline } from "./types";

export type Vec3 = [number, number, number];

/** 면이 평면인지 판정하는 허용오차 (면 반지름에 비례 적용). */
const PLANAR_TOL = 1e-4;

/** 면 범위(indices 구간)가 가리키는 서로 다른 정점 인덱스들. */
function faceVertexIndices(mesh: TessellatedMesh, range: FaceRange): number[] {
  const set = new Set<number>();
  for (let k = 0; k < range.count; k++) {
    set.add(mesh.indices[range.start + k]!);
  }
  return [...set];
}

/**
 * 면의 대표 평면 — 원점은 면 정점 중심, 법선은 저장된 정점 노멀(정규화).
 * 평면 면이면 모든 정점이 이 평면 위에 놓인다. 면이 없으면 null.
 */
export function facePlane(mesh: TessellatedMesh, faceId: number): { origin: Vec3; normal: Vec3 } | null {
  const range = mesh.faceRanges.find((r) => r.faceId === faceId);
  if (!range || range.count === 0) return null;
  const verts = faceVertexIndices(mesh, range);
  let cx = 0, cy = 0, cz = 0;
  for (const vi of verts) {
    cx += mesh.positions[vi * 3]!;
    cy += mesh.positions[vi * 3 + 1]!;
    cz += mesh.positions[vi * 3 + 2]!;
  }
  const n = verts.length;
  const origin: Vec3 = [cx / n, cy / n, cz / n];
  const fi = mesh.indices[range.start]! * 3;
  const nx = mesh.normals[fi]!, ny = mesh.normals[fi + 1]!, nz = mesh.normals[fi + 2]!;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { origin, normal: [nx / len, ny / len, nz / len] };
}

/** 면의 정점 중 평면에서 가장 먼 편차와 면 반지름을 함께 구한다. */
function planarDeviation(mesh: TessellatedMesh, faceId: number): { maxOff: number; maxRad: number } | null {
  const plane = facePlane(mesh, faceId);
  if (!plane) return null;
  const range = mesh.faceRanges.find((r) => r.faceId === faceId)!;
  const { origin, normal } = plane;
  let maxOff = 0, maxRad = 0;
  for (const vi of faceVertexIndices(mesh, range)) {
    const dx = mesh.positions[vi * 3]! - origin[0];
    const dy = mesh.positions[vi * 3 + 1]! - origin[1];
    const dz = mesh.positions[vi * 3 + 2]! - origin[2];
    maxRad = Math.max(maxRad, Math.hypot(dx, dy, dz));
    maxOff = Math.max(maxOff, Math.abs(dx * normal[0] + dy * normal[1] + dz * normal[2]));
  }
  return { maxOff, maxRad };
}

/** 면이 평면인가 — 모든 정점이 대표 평면 위(허용오차 내)에 있으면 true. */
export function isFacePlanar(mesh: TessellatedMesh, faceId: number, tol = PLANAR_TOL): boolean {
  const dev = planarDeviation(mesh, faceId);
  if (!dev) return false;
  return dev.maxOff <= tol * Math.max(1, dev.maxRad);
}

/**
 * 입력 검증 — 면이 존재하고, 거리가 0이 아니며, 평면이어야 한다.
 * 비평면 면은 명확히 거부한다(곡면은 단일 법선 평행이동으로 밀고/당길 수 없음).
 */
export function validateFacePushPull(mesh: TessellatedMesh, faceId: number, distance: number): void {
  const range = mesh.faceRanges.find((r) => r.faceId === faceId);
  if (!range) {
    throw new Error("면 Push/Pull: 선택한 면을 찾을 수 없습니다");
  }
  if (!(Math.abs(distance) > 0)) {
    throw new Error("면 Push/Pull: 거리는 0이 아니어야 합니다 (+당기기 / −밀기)");
  }
  if (!isFacePlanar(mesh, faceId)) {
    throw new Error("면 Push/Pull: 비평면(곡면) 면은 지원하지 않습니다 — 평면 면만 밀고/당길 수 있습니다");
  }
}

/** 삼각형별 면 법선을 정점에 채운다 (평면 면 기준 충분). */
function computeFlatNormals(positions: Float32Array, indices: Uint32Array, normals: Float32Array): void {
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3;
    const ib = indices[i + 1]! * 3;
    const ic = indices[i + 2]! * 3;
    const ax = positions[ia]!, ay = positions[ia + 1]!, az = positions[ia + 2]!;
    const bx = positions[ib]!, by = positions[ib + 1]!, bz = positions[ib + 2]!;
    const cx = positions[ic]!, cy = positions[ic + 1]!, cz = positions[ic + 2]!;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const base of [ia, ib, ic]) {
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i]!, ny = normals[i + 1]!, nz = normals[i + 2]!;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / len;
    normals[i + 1] = ny / len;
    normals[i + 2] = nz / len;
  }
}

/**
 * FAST(메시) 면 Push/Pull — 선택 면이 놓인 평면 위의 *모든* 정점·모서리 점을
 * 법선 방향으로 distance 만큼 평행이동한다. 면을 공유하는 측벽의 위 모서리도 함께 따라가
 * 솔리드가 닫힌 채로 자란다/줄어든다.
 *
 * 토폴로지 ID 보존: indices·triFaceId·faceRanges·edgeId 는 그대로, 좌표만 바뀐다.
 */
export function meshFacePushPull(
  mesh: TessellatedMesh,
  faceId: number,
  distance: number,
  newShapeId: string,
): TessellatedMesh {
  validateFacePushPull(mesh, faceId, distance);
  const plane = facePlane(mesh, faceId)!;
  const { origin, normal } = plane;

  // "평면 위" 판정 허용오차 — 면 반지름에 비례. 평행한 반대편 면(간격이 더 큼)은 건드리지 않는다.
  const dev = planarDeviation(mesh, faceId)!;
  const onPlaneTol = Math.max(PLANAR_TOL, PLANAR_TOL * dev.maxRad);
  const move: Vec3 = [normal[0] * distance, normal[1] * distance, normal[2] * distance];

  const offsetOnPlane = (arr: Float32Array): void => {
    for (let i = 0; i < arr.length; i += 3) {
      const px = arr[i]!, py = arr[i + 1]!, pz = arr[i + 2]!;
      const off =
        (px - origin[0]) * normal[0] + (py - origin[1]) * normal[1] + (pz - origin[2]) * normal[2];
      if (Math.abs(off) <= onPlaneTol) {
        arr[i] = px + move[0];
        arr[i + 1] = py + move[1];
        arr[i + 2] = pz + move[2];
      }
    }
  };

  const positions = new Float32Array(mesh.positions);
  offsetOnPlane(positions);

  const indices = new Uint32Array(mesh.indices);
  const normals = new Float32Array(mesh.normals.length);
  computeFlatNormals(positions, indices, normals);

  const edges: EdgePolyline[] = mesh.edges.map((e) => {
    const p = new Float32Array(e.positions);
    offsetOnPlane(p);
    return { edgeId: e.edgeId, positions: p };
  });

  return {
    positions,
    normals,
    indices,
    triFaceId: new Uint32Array(mesh.triFaceId),
    faceRanges: mesh.faceRanges.map((r) => ({ ...r })),
    edges,
    shapeId: newShapeId,
  };
}

/** 닫힌 삼각망의 부피 (발산정리, 절댓값). 부피 증가 불변식 검증용. */
export function meshVolume(mesh: TessellatedMesh): number {
  const p = mesh.positions;
  const idx = mesh.indices;
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]! * 3, b = idx[i + 1]! * 3, c = idx[i + 2]! * 3;
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const bx = p[b]!, by = p[b + 1]!, bz = p[b + 2]!;
    const cx = p[c]!, cy = p[c + 1]!, cz = p[c + 2]!;
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(vol) / 6;
}
