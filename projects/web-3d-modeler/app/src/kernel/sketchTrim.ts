/**
 * 스케치 자르기(Trim) — 스케치 평면의 모든 라인을 인식해, 클릭한 선분 구간을
 * 인접 교차점까지 잘라낸다 (Shapr3D 식).
 *
 * 동작: 클릭 지점에서 가장 가까운 선분을 찾고, 그 선분이 다른 선분들과 만나는
 * 교차점들로 나눈 뒤, 클릭이 속한 한 조각만 제거한다.
 *  - 열린 획: 가운데를 자르면 두 획으로 분리
 *  - 닫힌 획(루프): 한 조각을 자르면 하나의 열린 획으로
 */
import type { SketchPoint } from "./sketchPlane";

interface UV { u: number; v: number }
const sub = (a: UV, b: UV): UV => ({ u: a.u - b.u, v: a.v - b.v });
const cross2 = (a: UV, b: UV): number => a.u * b.v - a.v * b.u;
const dot2 = (a: UV, b: UV): number => a.u * b.u + a.v * b.v;
const lerp = (a: UV, b: UV, t: number): SketchPoint => ({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t });

/** 선분 ab 위에서 cd 와 만나는 매개변수 t (0~1), 없으면 null. */
function segIntersectT(a: UV, b: UV, c: UV, d: UV): number | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const rxs = cross2(r, s);
  if (Math.abs(rxs) < 1e-9) return null;
  const qp = sub(c, a);
  const t = cross2(qp, s) / rxs;
  const u = cross2(qp, r) / rxs;
  if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) return t;
  return null;
}

/** 점 p 에서 선분 ab 까지 거리와 투영 매개변수 t(0~1). */
function segDist(a: UV, b: UV, p: UV): { dist: number; t: number } {
  const ab = sub(b, a);
  const len2 = dot2(ab, ab) || 1e-9;
  let t = dot2(sub(p, a), ab) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { u: a.u + ab.u * t, v: a.v + ab.v * t };
  return { dist: Math.hypot(p.u - proj.u, p.v - proj.v), t };
}

/** 연속 중복 점 제거. */
function dedupe(pts: SketchPoint[]): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.u - last.u, p.v - last.v) > 1e-6) out.push(p);
  }
  return out;
}

const isClosed = (stroke: SketchPoint[]): boolean => stroke.length >= 3;

/** 클릭 지점에 가장 가까운 획의 인덱스 (삭제용). 임계 밖이면 null. */
export function nearestStrokeIndex(strokes: SketchPoint[][], uv: SketchPoint, threshold = 0.8): number | null {
  let bestS = -1;
  let bestDist = Infinity;
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s]!;
    const n = stroke.length;
    if (n < 2) continue;
    const lim = isClosed(stroke) ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      const { dist } = segDist(stroke[i]!, stroke[(i + 1) % n]!, uv);
      if (dist < bestDist) {
        bestDist = dist;
        bestS = s;
      }
    }
  }
  return bestS >= 0 && bestDist <= threshold ? bestS : null;
}

/**
 * 클릭 지점 uv 근처 선분을 교차점 기준으로 자른다.
 * 반환: 새 strokes 배열, 자를 게 없으면 null.
 */
export function trimAt(strokes: SketchPoint[][], uv: SketchPoint, threshold = 0.8): SketchPoint[][] | null {
  // 1) 가장 가까운 선분 찾기
  interface Best { s: number; i: number; t: number; dist: number; a: SketchPoint; b: SketchPoint }
  let best: Best | null = null;
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s]!;
    const n = stroke.length;
    if (n < 2) continue;
    const lim = isClosed(stroke) ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      const a = stroke[i]!;
      const b = stroke[(i + 1) % n]!;
      const { dist, t } = segDist(a, b, uv);
      if (best === null || dist < best.dist) best = { s, i, t, dist, a, b };
    }
  }
  if (best === null || best.dist > threshold) return null;
  const { s, i, t: clickT, a, b } = best;

  // 2) 이 선분과 다른 모든 선분의 교차점 t 수집
  const ts = [0, 1];
  strokes.forEach((stroke, s2) => {
    const n = stroke.length;
    if (n < 2) return;
    const lim = isClosed(stroke) ? n : n - 1;
    for (let j = 0; j < lim; j++) {
      if (s2 === s && j === i) continue;
      const c = stroke[j]!;
      const d = stroke[(j + 1) % n]!;
      const t = segIntersectT(a, b, c, d);
      if (t !== null) ts.push(t);
    }
  });
  ts.sort((x, y) => x - y);

  // 3) 클릭이 속한 [lo, hi] 구간
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < ts.length - 1; k++) {
    if (clickT >= ts[k]! - 1e-9 && clickT <= ts[k + 1]! + 1e-9) {
      lo = ts[k]!;
      hi = ts[k + 1]!;
      break;
    }
  }
  if (hi - lo < 1e-4) return null;
  const xlo = lerp(a, b, lo);
  const xhi = lerp(a, b, hi);

  // 4) 획 재구성
  const stroke = strokes[s]!;
  const n = stroke.length;
  const others = strokes.filter((_, idx) => idx !== s);

  if (isClosed(stroke)) {
    // 루프 → 하나의 열린 획: xhi 부터 한 바퀴 돌아 a 까지, 그 뒤 xlo
    const pts: SketchPoint[] = [xhi];
    for (let k = 1; k <= n; k++) pts.push(stroke[(i + k) % n]!);
    pts.push(xlo);
    const open = dedupe(pts);
    return open.length >= 2 ? [...others, open] : others;
  }
  // 열린 획 → 두 조각
  const left = dedupe([...stroke.slice(0, i + 1), xlo]);
  const right = dedupe([xhi, ...stroke.slice(i + 1)]);
  const result = [...others];
  if (left.length >= 2) result.push(left);
  if (right.length >= 2) result.push(right);
  return result;
}
