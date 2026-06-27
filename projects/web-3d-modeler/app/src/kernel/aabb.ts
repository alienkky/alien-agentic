/**
 * AABB(축 정렬 경계상자) 유틸 — 돌출 cut/fuse 의 "겹치는 바디" 판정에 쓴다.
 */
import type { TessellatedMesh } from "./types";
import type { Vec3 } from "../store/useAppStore";

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

export function meshAabb(m: TessellatedMesh, off: Vec3 = [0, 0, 0]): Aabb {
  const p = m.positions;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k]! + off[k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

/** 두 AABB 가 겹치는가 (경계 접촉은 eps 여유). */
export function aabbOverlap(a: Aabb, b: Aabb, eps = 1e-4): boolean {
  for (let k = 0; k < 3; k++) {
    if (a.max[k]! < b.min[k]! - eps || b.max[k]! < a.min[k]! - eps) return false;
  }
  return true;
}
