import { describe, it, expect } from "vitest";
import { collectSnapPoints, nearestSnapPoint, axisSnap, resolveSnap } from "./sketchSnap";
import type { SketchPoint } from "./sketchPlane";

const sq: SketchPoint[] = [
  { u: 0, v: 0 },
  { u: 4, v: 0 },
  { u: 4, v: 4 },
  { u: 0, v: 4 },
];

describe("sketchSnap — 끝점/중점/축 스냅 (순수)", () => {
  it("collectSnapPoints: 끝점 4 + 중점 3 (연속 선분)", () => {
    const pts = collectSnapPoints([sq]);
    const ends = pts.filter((p) => p.kind === "endpoint");
    const mids = pts.filter((p) => p.kind === "midpoint");
    expect(ends).toHaveLength(4);
    expect(mids).toHaveLength(3);
    expect(mids).toContainEqual({ u: 2, v: 0, kind: "midpoint" });
  });

  it("collectSnapPoints: 다점 곡선(원 근사)은 제외", () => {
    const circle: SketchPoint[] = Array.from({ length: 48 }, (_, i) => ({ u: Math.cos(i), v: Math.sin(i) }));
    expect(collectSnapPoints([circle])).toHaveLength(0);
  });

  it("nearestSnapPoint: tol 이내 가장 가까운 후보, 밖이면 null", () => {
    const cands = collectSnapPoints([sq]);
    expect(nearestSnapPoint({ u: 0.2, v: 0.1 }, cands, 0.5)).toMatchObject({ u: 0, v: 0, kind: "endpoint" });
    expect(nearestSnapPoint({ u: 2.1, v: 0.05 }, cands, 0.5)).toMatchObject({ u: 2, v: 0, kind: "midpoint" });
    expect(nearestSnapPoint({ u: 10, v: 10 }, cands, 0.5)).toBeNull();
  });

  it("axisSnap: 수평/수직 흡착, 벗어나면 그대로", () => {
    const anchor = { u: 0, v: 0 };
    // 거의 수평 (작은 v) → v 를 anchor 에 맞춤
    expect(axisSnap(anchor, { u: 5, v: 0.1 }, 6)).toEqual({ point: { u: 5, v: 0 }, axis: "horizontal" });
    // 거의 수직 (작은 u) → u 를 anchor 에 맞춤
    expect(axisSnap(anchor, { u: 0.1, v: 5 }, 6)).toEqual({ point: { u: 0, v: 5 }, axis: "vertical" });
    // 대각선 → 스냅 없음
    expect(axisSnap(anchor, { u: 5, v: 5 }, 6)).toEqual({ point: { u: 5, v: 5 }, axis: null });
  });

  it("resolveSnap: 점 스냅 > 축 스냅 우선순위", () => {
    const cands = collectSnapPoints([sq]);
    // 끝점 근처 + 거의 수평 → 점 스냅이 이김
    const r1 = resolveSnap({ u: 4.1, v: 0.05 }, { anchor: { u: 0, v: 0 }, candidates: cands, enablePoint: true, enableAxis: true, tol: 0.5, axisTolDeg: 6 });
    expect(r1).toEqual({ point: { u: 4, v: 0 }, pointSnap: "endpoint", axis: null });
    // 점에서 멀고 거의 수평 → 축 스냅
    const r2 = resolveSnap({ u: 20, v: 0.1 }, { anchor: { u: 0, v: 0 }, candidates: cands, enablePoint: true, enableAxis: true, tol: 0.5, axisTolDeg: 6 });
    expect(r2.axis).toBe("horizontal");
    expect(r2.point).toEqual({ u: 20, v: 0 });
  });

  it("resolveSnap: 둘 다 비활성이면 원점 그대로", () => {
    const cands = collectSnapPoints([sq]);
    const r = resolveSnap({ u: 0.1, v: 0.1 }, { anchor: { u: 0, v: 0 }, candidates: cands, enablePoint: false, enableAxis: false, tol: 0.5, axisTolDeg: 6 });
    expect(r).toEqual({ point: { u: 0.1, v: 0.1 }, pointSnap: null, axis: null });
  });
});
