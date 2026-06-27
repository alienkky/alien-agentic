import { describe, it, expect } from "vitest";
import { catmullRom, arc3 } from "./sketchCurves";
import type { SketchPoint } from "./sketchPlane";

describe("스케치 곡선", () => {
  it("catmullRom: 제어점을 지나고 점이 많아짐", () => {
    const ctrl: SketchPoint[] = [{ u: 0, v: 0 }, { u: 2, v: 3 }, { u: 5, v: 0 }, { u: 7, v: 4 }];
    const curve = catmullRom(ctrl);
    expect(curve.length).toBeGreaterThan(ctrl.length * 5);
    expect(curve[0]).toEqual(ctrl[0]); // 시작 제어점 지남
    expect(curve[curve.length - 1]).toEqual(ctrl[3]); // 끝 제어점 지남
  });

  it("arc3: 단위원 위 세 점 → 호의 모든 점이 반지름 1", () => {
    const arc = arc3({ u: 1, v: 0 }, { u: 0, v: 1 }, { u: -1, v: 0 });
    for (const p of arc) {
      expect(Math.hypot(p.u, p.v)).toBeCloseTo(1, 4); // 원점 중심 반지름 1
    }
    // through 점(0,1) 부근을 지나야 한다
    expect(arc.some((p) => Math.hypot(p.u - 0, p.v - 1) < 0.05)).toBe(true);
  });

  it("arc3: 일직선 세 점 → 그대로", () => {
    const arc = arc3({ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 2, v: 0 });
    expect(arc).toHaveLength(3);
  });
});
