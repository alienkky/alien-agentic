/**
 * 그리기-시점 스냅 (순수 함수 — 단위테스트 가능).
 * Shapr3D 식: 그리는 동안 커서를 (1) 기존 획의 끝점/중점, (2) 수평·수직 축(이전 점 기준)에
 * 흡착시킨다. 구속 솔버가 아니라 *기하 흡착*이다 — 같은 입력 → 같은 출력.
 *
 * 우선순위: 끝점/중점 스냅 > 축 스냅 > (호출자가 처리하는) 격자 스냅.
 */
import type { SketchPoint } from "./sketchPlane";

export interface SnapPoint {
  u: number;
  v: number;
  kind: "endpoint" | "midpoint";
}

export type SnapAxis = "horizontal" | "vertical" | null;

export interface SnapResult {
  point: SketchPoint;
  /** 끝점/중점에 붙었으면 그 종류, 아니면 null */
  pointSnap: "endpoint" | "midpoint" | null;
  /** 축에 정렬됐으면 그 축, 아니면 null */
  axis: SnapAxis;
}

/** 원/타원처럼 폴리곤 근사(다점) 획은 스냅 후보에서 제외 — 노이즈 방지. */
const MAX_STROKE_VERTS = 8;

/** 획들에서 스냅 후보(끝점·중점)를 모은다. 다점 곡선(원/타원)은 건너뛴다. */
export function collectSnapPoints(strokes: SketchPoint[][]): SnapPoint[] {
  const out: SnapPoint[] = [];
  for (const stroke of strokes) {
    if (stroke.length > MAX_STROKE_VERTS) continue;
    for (const p of stroke) out.push({ u: p.u, v: p.v, kind: "endpoint" });
    for (let i = 0; i + 1 < stroke.length; i++) {
      const a = stroke[i]!;
      const b = stroke[i + 1]!;
      out.push({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2, kind: "midpoint" });
    }
  }
  return out;
}

/** tol 이내 가장 가까운 스냅 후보. 동률이면 끝점을 중점보다 우선. */
export function nearestSnapPoint(p: SketchPoint, candidates: SnapPoint[], tol: number): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestD = tol;
  for (const c of candidates) {
    const d = Math.hypot(c.u - p.u, c.v - p.v);
    if (d < bestD || (d === bestD && c.kind === "endpoint" && best?.kind === "midpoint")) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/**
 * 이전 점(anchor) 기준 수평/수직 축 흡착. 진행 각이 축에서 axisTolDeg 이내면
 * 작은 성분을 anchor 에 맞춰 정확히 수평/수직으로 만든다.
 */
export function axisSnap(anchor: SketchPoint, p: SketchPoint, axisTolDeg: number): { point: SketchPoint; axis: SnapAxis } {
  const du = p.u - anchor.u;
  const dv = p.v - anchor.v;
  if (du === 0 && dv === 0) return { point: p, axis: null };
  const tol = (axisTolDeg * Math.PI) / 180;
  const ang = Math.atan2(dv, du); // (-PI, PI]
  const nearH = Math.abs(ang) < tol || Math.abs(Math.abs(ang) - Math.PI) < tol;
  const nearV = Math.abs(Math.abs(ang) - Math.PI / 2) < tol;
  // 더 가까운 축을 택한다 (둘 다 안에 들 일은 거의 없지만 안전하게)
  if (nearH && (!nearV || Math.abs(dv) <= Math.abs(du))) return { point: { u: p.u, v: anchor.v }, axis: "horizontal" };
  if (nearV) return { point: { u: anchor.u, v: p.v }, axis: "vertical" };
  return { point: p, axis: null };
}

export interface SnapOptions {
  anchor?: SketchPoint | null;
  candidates: SnapPoint[];
  enablePoint: boolean;
  enableAxis: boolean;
  /** 끝점/중점 흡착 반경 (평면 단위) */
  tol: number;
  /** 축 흡착 각도 허용치 (도) */
  axisTolDeg: number;
}

/** 우선순위에 따라 스냅을 푼다. 어디에도 안 붙으면 원래 점 그대로. */
export function resolveSnap(raw: SketchPoint, opts: SnapOptions): SnapResult {
  if (opts.enablePoint) {
    const hit = nearestSnapPoint(raw, opts.candidates, opts.tol);
    if (hit) return { point: { u: hit.u, v: hit.v }, pointSnap: hit.kind, axis: null };
  }
  if (opts.enableAxis && opts.anchor) {
    const a = axisSnap(opts.anchor, raw, opts.axisTolDeg);
    if (a.axis) return { point: a.point, pointSnap: null, axis: a.axis };
  }
  return { point: raw, pointSnap: null, axis: null };
}
