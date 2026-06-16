/**
 * 스케치 2D 변형 — 평면 (u,v) 위에서 획들을 미러/패턴/오프셋한다.
 * 모두 새 획(들)을 반환하며, 원본은 호출 측에서 유지/교체를 결정한다.
 */
import type { SketchPoint } from "./sketchPlane";

export type UVAxis = "u" | "v";

/** 축(u축=v=0 가로선 / v축=u=0 세로선) 기준 반사 복제. winding 유지를 위해 뒤집는다. */
export function mirrorStrokes(strokes: SketchPoint[][], axis: UVAxis): SketchPoint[][] {
  const ref = (p: SketchPoint): SketchPoint => (axis === "u" ? { u: p.u, v: -p.v } : { u: -p.u, v: p.v });
  return strokes.map((st) => st.map(ref).reverse());
}

/** 선형 패턴: 축 방향으로 spacing 간격, count-1 개 복제. */
export function patternLinearStrokes(strokes: SketchPoint[][], axis: UVAxis, count: number, spacing: number): SketchPoint[][] {
  const out: SketchPoint[][] = [];
  for (let k = 1; k < count; k++) {
    const d = spacing * k;
    out.push(...strokes.map((st) => st.map((p) => (axis === "u" ? { u: p.u + d, v: p.v } : { u: p.u, v: p.v + d }))));
  }
  return out;
}

/** 원형 패턴: 원점 둘레로 count-1 개 복제 (360°면 step=360/n). */
export function patternCircularStrokes(strokes: SketchPoint[][], count: number, angleDeg: number, center: SketchPoint = { u: 0, v: 0 }): SketchPoint[][] {
  const out: SketchPoint[][] = [];
  const step = angleDeg >= 360 ? 360 / count : angleDeg / (count - 1);
  for (let k = 1; k < count; k++) {
    const a = (step * k * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push(
      ...strokes.map((st) =>
        st.map((p) => {
          const du = p.u - center.u;
          const dv = p.v - center.v;
          return { u: center.u + du * c - dv * s, v: center.v + du * s + dv * c };
        }),
      ),
    );
  }
  return out;
}

/** 폴리라인 오프셋 — 각 정점에서 인접 선분 법선 평균 방향으로 dist 이동. */
export function offsetStroke(stroke: SketchPoint[], dist: number): SketchPoint[] {
  const n = stroke.length;
  if (n < 2) return stroke.slice();
  const closed = n >= 3;
  const segNormal = (a: SketchPoint, b: SketchPoint): SketchPoint => {
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len = Math.hypot(dx, dy) || 1;
    return { u: -dy / len, v: dx / len };
  };
  const out: SketchPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = stroke[(i - 1 + n) % n]!;
    const cur = stroke[i]!;
    const next = stroke[(i + 1) % n]!;
    let nx = 0;
    let ny = 0;
    if (closed || i > 0) {
      const nm = segNormal(prev, cur);
      nx += nm.u;
      ny += nm.v;
    }
    if (closed || i < n - 1) {
      const nm = segNormal(cur, next);
      nx += nm.u;
      ny += nm.v;
    }
    const len = Math.hypot(nx, ny) || 1;
    out.push({ u: cur.u + (nx / len) * dist, v: cur.v + (ny / len) * dist });
  }
  return out;
}
