import { describe, it, expect } from "vitest";
import { mirrorStrokes, patternLinearStrokes, patternCircularStrokes, offsetStroke } from "./sketchTransform2d";
import type { SketchPoint } from "./sketchPlane";

const tri: SketchPoint[][] = [[{ u: 1, v: 1 }, { u: 3, v: 1 }, { u: 2, v: 3 }]];

describe("스케치 2D 변형", () => {
  it("미러(v축): u 부호 반전", () => {
    const m = mirrorStrokes(tri, "v");
    expect(m).toHaveLength(1);
    // 원본 u={1,3,2} → 반사 u={-1,-3,-2}
    expect(m[0]!.map((p) => p.u).sort((a, b) => a - b)).toEqual([-3, -2, -1]);
    expect(m[0]!.every((p) => p.v >= 0)).toBe(true); // v 보존(원본 v 모두 양수)
  });

  it("선형 패턴: count-1 개 복제, 간격 적용", () => {
    const out = patternLinearStrokes(tri, "u", 3, 5);
    expect(out).toHaveLength(2); // k=1,2
    expect(out[0]![0]!.u).toBeCloseTo(6, 6); // 1+5
    expect(out[1]![0]!.u).toBeCloseTo(11, 6); // 1+10
  });

  it("원형 패턴: 원점 둘레 복제, 거리 보존", () => {
    const sq: SketchPoint[][] = [[{ u: 4, v: 0 }, { u: 5, v: 0 }, { u: 5, v: 1 }]];
    const out = patternCircularStrokes(sq, 4, 360);
    expect(out).toHaveLength(3);
    // 90° 회전: (4,0) → (0,4)
    expect(out[0]![0]!.u).toBeCloseTo(0, 5);
    expect(out[0]![0]!.v).toBeCloseTo(4, 5);
  });

  it("오프셋: 모든 정점이 ~거리만큼 평행 이동(부호=방향)", () => {
    const off = offsetStroke(tri[0]!, 0.5);
    expect(off).toHaveLength(3);
    off.forEach((p, i) => {
      const o = tri[0]![i]!;
      expect(Math.hypot(p.u - o.u, p.v - o.v)).toBeGreaterThan(0.1);
    });
    // 부호 반대면 반대편으로
    const neg = offsetStroke(tri[0]!, -0.5);
    expect(neg[0]!.u).not.toBeCloseTo(off[0]!.u, 2);
  });
});
