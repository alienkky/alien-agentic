/**
 * 스케치 기준면 — 3개 표준 평면(XY/YZ/XZ)과 world↔plane 2D 좌표 변환.
 * Shapr3D 처럼 면을 고르면 그 평면의 로컬 (u,v) 좌표로 스케치한다.
 */
export type PlaneId = "xy" | "yz" | "xz";

export interface SketchPlaneDef {
  /** 표준평면이면 PlaneId, 면 위 스케치면 "face-..." 등 임의 식별자 */
  id: string;
  label: string;
  origin: [number, number, number];
  /** 평면 로컬 X축 (world) */
  u: [number, number, number];
  /** 평면 로컬 Y축 (world) */
  v: [number, number, number];
  /** 평면 법선 (world) — 돌출 방향 */
  normal: [number, number, number];
}

/** 2D 평면 좌표 (u,v). */
export interface SketchPoint {
  u: number;
  v: number;
}

export const SKETCH_PLANES: Record<PlaneId, SketchPlaneDef> = {
  xz: { id: "xz", label: "평면도(XZ)", origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] },
  xy: { id: "xy", label: "정면(XY)", origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] },
  yz: { id: "yz", label: "우측(YZ)", origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], normal: [1, 0, 0] },
};

export function worldToPlane(plane: SketchPlaneDef, wx: number, wy: number, wz: number): SketchPoint {
  const dx = wx - plane.origin[0];
  const dy = wy - plane.origin[1];
  const dz = wz - plane.origin[2];
  return {
    u: dx * plane.u[0] + dy * plane.u[1] + dz * plane.u[2],
    v: dx * plane.v[0] + dy * plane.v[1] + dz * plane.v[2],
  };
}

export function planeToWorld(plane: SketchPlaneDef, u: number, v: number): [number, number, number] {
  return [
    plane.origin[0] + u * plane.u[0] + v * plane.v[0],
    plane.origin[1] + u * plane.u[1] + v * plane.v[1],
    plane.origin[2] + u * plane.u[2] + v * plane.v[2],
  ];
}

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * 면(평평한 face)의 정점들과 법선에서 스케치 평면을 만든다 — "면 위에 스케치".
 * origin = 정점 중심, normal = 면 법선, u/v = 법선에 수직인 직교 basis.
 */
export function planeFromFace(verts: ArrayLike<number>, normal: V3, id = "face"): SketchPlaneDef {
  let cx = 0, cy = 0, cz = 0;
  const n = verts.length / 3;
  for (let i = 0; i < verts.length; i += 3) {
    cx += verts[i]!;
    cy += verts[i + 1]!;
    cz += verts[i + 2]!;
  }
  const N = normalize(normal);
  // 법선이 world Y 와 거의 평행하면 ref 를 X 로 바꿔 특이점 회피
  const ref: V3 = Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const U = normalize(cross(ref, N));
  const V = normalize(cross(N, U));
  return { id, label: "면 위", origin: [cx / n, cy / n, cz / n], u: U, v: V, normal: N };
}
