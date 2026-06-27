/**
 * 스케치 안내선/스냅 (Shapr3D 식) — 그리는 중 커서를 기존 점에 정렬해 스냅하고,
 * 수평·수직 정렬이면 보라색 안내선 정보를 돌려준다.
 *  우선순위: 끝/중간점 스냅 > 수직/수평 정렬 > 격자 스냅.
 */
import type { SketchPoint } from "./sketchPlane";

export type GuideKind = "v" | "h";
export interface Guide {
  /** 정렬 기준이 된 앵커 점 */
  anchor: SketchPoint;
  /** 스냅된 커서 점 */
  to: SketchPoint;
  kind: GuideKind;
}

export interface SnapResult {
  snapped: SketchPoint;
  guides: Guide[];
}

export function snapToGuides(raw: SketchPoint, anchors: SketchPoint[], tol: number, gridStep: number): SnapResult {
  // 1) 끝/중간점 스냅 — 가장 우선
  let bestPt: SketchPoint | null = null;
  let bestD = tol;
  for (const a of anchors) {
    const d = Math.hypot(raw.u - a.u, raw.v - a.v);
    if (d < bestD) {
      bestD = d;
      bestPt = a;
    }
  }
  if (bestPt) return { snapped: { u: bestPt.u, v: bestPt.v }, guides: [] };

  // 2) 수직(u 정렬) / 수평(v 정렬)
  let u = raw.u;
  let v = raw.v;
  const va = anchors.find((a) => Math.abs(a.u - raw.u) < tol);
  const ha = anchors.find((a) => Math.abs(a.v - raw.v) < tol);
  if (va) u = va.u;
  if (ha) v = ha.v;

  // 3) 정렬 안 된 축은 격자 스냅
  if (!va && gridStep > 0) u = Math.round(u / gridStep) * gridStep;
  if (!ha && gridStep > 0) v = Math.round(v / gridStep) * gridStep;

  const snapped: SketchPoint = { u, v };
  const guides: Guide[] = [];
  if (va) guides.push({ anchor: { u: va.u, v: va.v }, to: snapped, kind: "v" });
  if (ha) guides.push({ anchor: { u: ha.u, v: ha.v }, to: snapped, kind: "h" });
  return { snapped, guides };
}
