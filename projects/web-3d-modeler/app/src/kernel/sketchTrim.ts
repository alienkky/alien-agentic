/**
 * 스케치 자르기(Trim) — 스케치 평면의 모든 라인을 인식해, 클릭한 구간을
 * 인접 경계까지 잘라낸다 (Shapr3D 식).
 *
 * 경계(boundary)는 두 가지다:
 *  1) 다른 선과의 교차점
 *  2) 클릭한 획 자신의 "날카로운 꼭짓점"(꺾임 > ~20°) — 사각형/다각형 모서리, 열린 획 끝점
 * 부드러운 꼭짓점(원·타원·호의 미세 facet, 스플라인의 완만한 점)은 경계가 아니다.
 *
 * 따라서:
 *  - 원/호를 가로지르는 선으로 자르면 → 두 교차점 사이의 "호 전체"가 잘린다(=Shapr3D).
 *    (예전엔 클릭한 facet 1조각만 잘려서 "안 잘리는 것처럼" 보였다.)
 *  - 사각형 한 변을 클릭하면 → 모서리(꼭짓점) 또는 교차점까지만 잘린다.
 *  - 교차하는 두 직선은 교차점까지 잘린다.
 *
 * 동작 결과:
 *  - 열린 획: 가운데를 자르면 두 획으로 분리
 *  - 닫힌 획(루프): 한 구간을 자르면 하나의 열린 획으로
 */
import type { SketchPoint } from "./sketchPlane";

interface UV { u: number; v: number }
const sub = (a: UV, b: UV): UV => ({ u: a.u - b.u, v: a.v - b.v });
const cross2 = (a: UV, b: UV): number => a.u * b.v - a.v * b.u;
const dot2 = (a: UV, b: UV): number => a.u * b.u + a.v * b.v;
const lerp = (a: UV, b: UV, t: number): SketchPoint => ({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t });

/**
 * 선분 ab 위에서 cd 와 만나는 매개변수 t (0~1), 없으면 null.
 * allowEnds=true 면 끝점 일치(t=0/1)도 인정 — 다른 획과의 교차가 ab 의 꼭짓점에
 * 정확히 떨어지는 경우(예: 원/다각형 꼭짓점을 정확히 지나는 절단선)를 놓치지 않게.
 * 같은 획 내부 자기교차에는 끝점을 빼서(인접 선분 공유 꼭짓점) 거짓 양성을 막는다.
 */
function segIntersectT(a: UV, b: UV, c: UV, d: UV, allowEnds: boolean): number | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const rxs = cross2(r, s);
  if (Math.abs(rxs) < 1e-9) return null;
  const qp = sub(c, a);
  const t = cross2(qp, s) / rxs;
  const u = cross2(qp, r) / rxs;
  const tOk = allowEnds ? t >= -1e-6 && t <= 1 + 1e-6 : t > 1e-6 && t < 1 - 1e-6;
  if (tOk && u >= -1e-6 && u <= 1 + 1e-6) return Math.max(0, Math.min(1, t));
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
/** 획의 선분 개수 (닫힌 획은 wrap 포함 = 점 수, 열린 획은 점 수 - 1). */
const segCount = (stroke: SketchPoint[]): number => (isClosed(stroke) ? stroke.length : stroke.length - 1);

/** 전역 매개변수 g(= 선분index + 0~1) 위치의 점. */
function pointAt(stroke: SketchPoint[], g: number): SketchPoint {
  const n = stroke.length;
  const segc = segCount(stroke);
  let k = Math.floor(g);
  let t = g - k;
  if (isClosed(stroke)) {
    k = ((k % n) + n) % n;
  } else {
    if (k >= segc) { k = segc - 1; t = 1; }
    if (k < 0) { k = 0; t = 0; }
  }
  return lerp(stroke[k]!, stroke[(k + 1) % n]!, t);
}

/** 전역 매개변수 구간 [gStart, gEnd] 의 점들(꼭짓점 포함). 닫힌 획이면 wrap. */
function chainSlice(stroke: SketchPoint[], gStart: number, gEnd: number): SketchPoint[] {
  const n = stroke.length;
  const out: SketchPoint[] = [pointAt(stroke, gStart)];
  for (let m = Math.floor(gStart) + 1; m < gEnd - 1e-9; m++) out.push(stroke[((m % n) + n) % n]!);
  out.push(pointAt(stroke, gEnd));
  return dedupe(out);
}

/** 꼭짓점 k 가 날카로운가(꺾임 > ~20°). 열린 획 끝점은 항상 경계. */
function isSharpVertex(stroke: SketchPoint[], k: number): boolean {
  const n = stroke.length;
  const closed = isClosed(stroke);
  const prev = closed ? stroke[((k - 1) % n + n) % n]! : k - 1 >= 0 ? stroke[k - 1]! : null;
  const next = closed ? stroke[(k + 1) % n]! : k + 1 < n ? stroke[k + 1]! : null;
  if (!prev || !next) return true; // 열린 획의 끝점 = 경계
  const e1 = sub(stroke[k]!, prev);
  const e2 = sub(next, stroke[k]!);
  const l1 = Math.hypot(e1.u, e1.v);
  const l2 = Math.hypot(e2.u, e2.v);
  if (l1 < 1e-9 || l2 < 1e-9) return false;
  const cos = dot2(e1, e2) / (l1 * l2);
  return cos < 0.94; // cos(20°)≈0.94 보다 작으면(더 많이 꺾이면) 날카로운 모서리
}

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

interface TrimSpan { s: number; lo: number; hi: number }

/** 정렬 + 근접값 합치기. */
function sortedUniq(xs: number[]): number[] {
  xs.sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of xs) if (!out.length || Math.abs(x - out[out.length - 1]!) > 1e-6) out.push(x);
  return out;
}

/** 클릭 근처 획과 제거 구간(전역 매개변수 lo,hi) 을 찾는다 — trimAt/trimPreviewAt 공용. */
function trimSpan(strokes: SketchPoint[][], uv: SketchPoint, threshold: number): TrimSpan | null {
  // 1) 가장 가까운 점 → 클릭한 획 s 와 전역 클릭 매개변수 clickG
  let best: { s: number; g: number; dist: number } | null = null;
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s]!;
    const n = stroke.length;
    if (n < 2) continue;
    const segc = segCount(stroke);
    for (let i = 0; i < segc; i++) {
      const { dist, t } = segDist(stroke[i]!, stroke[(i + 1) % n]!, uv);
      if (best === null || dist < best.dist) best = { s, g: i + t, dist };
    }
  }
  if (best === null || best.dist > threshold) return null;

  const s = best.s;
  const stroke = strokes[s]!;
  const n = stroke.length;
  const segc = segCount(stroke);
  const closed = isClosed(stroke);
  const clickG = best.g;

  // 2) 경계 모으기 = (a) 다른 선과의 교차점 + (b) 날카로운 꼭짓점
  const cuts: number[] = [];
  for (let i = 0; i < segc; i++) {
    const a = stroke[i]!;
    const b = stroke[(i + 1) % n]!;
    strokes.forEach((other, so) => {
      const m = other.length;
      if (m < 2) return;
      const oc = segCount(other);
      for (let j = 0; j < oc; j++) {
        if (so === s && j === i) continue; // 자기 자신 같은 선분 제외
        // 다른 획과의 교차는 끝점 일치도 인정(allowEnds), 같은 획 자기교차는 내부만
        const t = segIntersectT(a, b, other[j]!, other[(j + 1) % m]!, so !== s);
        if (t !== null) cuts.push(i + t);
      }
    });
  }
  // 날카로운 꼭짓점 (param = 정수 꼭짓점 인덱스)
  if (closed) {
    for (let k = 0; k < n; k++) if (isSharpVertex(stroke, k)) cuts.push(k);
  } else {
    cuts.push(0, segc); // 열린 획 양 끝
    for (let k = 1; k < n - 1; k++) if (isSharpVertex(stroke, k)) cuts.push(k);
  }
  const uniq = sortedUniq(cuts);

  if (closed) {
    if (uniq.length === 0) return null; // 교차·모서리 없는 매끈 루프(고립 원) → 자를 경계 없음
    // 원형: clickG 를 첫 경계 기준 한 바퀴 안으로 정규화 후 둘러싼 두 경계 찾기
    const base = uniq[0]!;
    let cg = clickG;
    while (cg < base) cg += segc;
    while (cg >= base + segc) cg -= segc;
    const ext = [...uniq, base + segc];
    let lo = base;
    let hi = base + segc;
    for (let k = 0; k < uniq.length; k++) {
      if (cg >= ext[k]! - 1e-9 && cg <= ext[k + 1]! + 1e-9) { lo = ext[k]!; hi = ext[k + 1]!; break; }
    }
    if (hi - lo < 1e-4) return null;
    return { s, lo, hi };
  }

  // 열린 획: 0·segc 가 항상 경계에 포함됨
  let lo = 0;
  let hi = segc;
  for (let k = 0; k < uniq.length - 1; k++) {
    if (clickG >= uniq[k]! - 1e-9 && clickG <= uniq[k + 1]! + 1e-9) { lo = uniq[k]!; hi = uniq[k + 1]!; break; }
  }
  if (hi - lo < 1e-4) return null;
  return { s, lo, hi };
}

/**
 * 클릭 지점 uv 근처 구간을 인접 경계까지 잘라낸다.
 * 반환: 새 strokes 배열, 자를 게 없으면 null.
 */
export function trimAt(strokes: SketchPoint[][], uv: SketchPoint, threshold = 0.8): SketchPoint[][] | null {
  const span = trimSpan(strokes, uv, threshold);
  if (!span) return null;
  const { s, lo, hi } = span;
  const stroke = strokes[s]!;
  const others = strokes.filter((_, idx) => idx !== s);

  if (isClosed(stroke)) {
    // 루프 → 하나의 열린 획: 제거구간 [lo,hi] 의 바깥(hi 부터 한 바퀴 돌아 lo 까지)
    const open = chainSlice(stroke, hi, lo + segCount(stroke));
    return open.length >= 2 ? [...others, open] : others;
  }
  // 열린 획 → 두 조각 (제거구간 [lo,hi] 양쪽)
  const left = chainSlice(stroke, 0, lo);
  const right = chainSlice(stroke, hi, segCount(stroke));
  const result = [...others];
  if (left.length >= 2) result.push(left);
  if (right.length >= 2) result.push(right);
  return result;
}

/** 자르기 미리보기 — 클릭 시 제거될 구간의 점들(빨강 하이라이트용). 없으면 null. */
export function trimPreviewAt(strokes: SketchPoint[][], uv: SketchPoint, threshold = 0.8): SketchPoint[] | null {
  const span = trimSpan(strokes, uv, threshold);
  if (!span) return null;
  const seg = chainSlice(strokes[span.s]!, span.lo, span.hi);
  return seg.length >= 2 ? seg : null;
}
