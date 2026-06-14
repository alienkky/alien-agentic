/**
 * 스케치 기준면 — 3개 표준 평면(XY/YZ/XZ)과 world↔plane 2D 좌표 변환.
 * Shapr3D 처럼 면을 고르면 그 평면의 로컬 (u,v) 좌표로 스케치한다.
 */
export type PlaneId = "xy" | "yz" | "xz";

export interface SketchPlaneDef {
  id: PlaneId;
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
