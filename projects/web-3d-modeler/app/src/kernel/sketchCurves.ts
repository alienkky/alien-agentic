/**
 * 스케치 곡선 — 스플라인(Catmull-Rom)과 3점 호(Arc)를 폴리라인으로 근사한다.
 * 우리 스케치는 폴리라인(점 배열) 모델이라, 곡선도 잘게 쪼갠 점들로 저장한다.
 */
import type { SketchPoint } from "./sketchPlane";

function catmull(p0: SketchPoint, p1: SketchPoint, p2: SketchPoint, p3: SketchPoint, t: number): SketchPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { u: f(p0.u, p1.u, p2.u, p3.u), v: f(p0.v, p1.v, p2.v, p3.v) };
}

/** 제어점들을 지나는 부드러운 곡선(Catmull-Rom) → 폴리라인. */
export function catmullRom(points: SketchPoint[], segPerSpan = 14): SketchPoint[] {
  const n = points.length;
  if (n < 3) return points.slice();
  const pt = (i: number): SketchPoint => points[Math.max(0, Math.min(n - 1, i))]!;
  const out: SketchPoint[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segPerSpan; j++) {
      out.push(catmull(pt(i - 1), pt(i), pt(i + 1), pt(i + 2), j / segPerSpan));
    }
  }
  out.push(points[n - 1]!);
  return out;
}

const TWO_PI = Math.PI * 2;
const normAngle = (x: number): number => {
  let a = x % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
};

/**
 * 세 점을 지나는 원호 — start 에서 end 까지, through 를 거쳐. 폴리라인 반환.
 * 세 점이 거의 일직선이면 [start, through, end] 그대로.
 */
export function arc3(start: SketchPoint, through: SketchPoint, end: SketchPoint, segs = 28): SketchPoint[] {
  const ax = start.u, ay = start.v;
  const bx = through.u, by = through.v;
  const cx = end.u, cy = end.v;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return [start, through, end];
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);

  const a0 = Math.atan2(ay - uy, ax - ux);
  const aT = normAngle(Math.atan2(by - uy, bx - ux) - a0);
  const aE = normAngle(Math.atan2(cy - uy, cx - ux) - a0);
  // through(aT) 가 start→end 사이에 오도록 방향 결정 (CCW 우선, 아니면 CW)
  const ccw = aT <= aE;
  const sweep = ccw ? aE : aE - TWO_PI;

  const out: SketchPoint[] = [];
  for (let i = 0; i <= segs; i++) {
    const ang = a0 + (sweep * i) / segs;
    out.push({ u: ux + r * Math.cos(ang), v: uy + r * Math.sin(ang) });
  }
  return out;
}
