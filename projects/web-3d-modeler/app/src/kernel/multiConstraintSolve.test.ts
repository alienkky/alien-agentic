import { describe, it, expect } from "vitest";
import { solveMultiConstraint } from "./multiConstraintSolve";
import type { SketchPoint } from "./sketchPlane";
import type { SegRef } from "./constraintsMulti";

const seg = (s: number, i: number): SegRef => ({ s, i });

function dir(stroke: SketchPoint[], i: number): [number, number] {
  const a = stroke[i]!;
  const b = stroke[i + 1]!;
  return [b.u - a.u, b.v - a.v];
}

function cross(u: [number, number], v: [number, number]): number {
  return u[0] * v[1] - u[1] * v[0];
}

function dot(u: [number, number], v: [number, number]): number {
  return u[0] * v[0] + u[1] * v[1];
}

describe("solveMultiConstraint", () => {
  it("parallel: 두 번째 세그먼트가 앵커와 평행해진다 (cross ≈ 0), 앵커는 불변", () => {
    const strokes: SketchPoint[][] = [
      [{ u: 0, v: 0 }, { u: 10, v: 0 }],
      [{ u: 0, v: 5 }, { u: 8, v: 9 }],
    ];
    const out = solveMultiConstraint(strokes, seg(0, 0), seg(1, 0), "parallel");
    expect(out).not.toBeNull();
    const res = out!;

    // 앵커 세그먼트 좌표는 고정되어 그대로다.
    expect(res[0]![0]!.u).toBeCloseTo(0, 6);
    expect(res[0]![0]!.v).toBeCloseTo(0, 6);
    expect(res[0]![1]!.u).toBeCloseTo(10, 6);
    expect(res[0]![1]!.v).toBeCloseTo(0, 6);

    // 두 방향 벡터의 외적 ≈ 0 → 평행.
    expect(cross(dir(res[0]!, 0), dir(res[1]!, 0))).toBeCloseTo(0, 5);
  });

  it("perpendicular: 두 번째 세그먼트가 앵커와 직각이 된다 (dot ≈ 0)", () => {
    const strokes: SketchPoint[][] = [
      [{ u: 0, v: 0 }, { u: 10, v: 0 }],
      [{ u: 2, v: 5 }, { u: 8, v: 9 }],
    ];
    const out = solveMultiConstraint(strokes, seg(0, 0), seg(1, 0), "perpendicular");
    expect(out).not.toBeNull();
    const res = out!;

    expect(dot(dir(res[0]!, 0), dir(res[1]!, 0))).toBeCloseTo(0, 5);
  });

  it("coincident: 두 번째 세그먼트의 시작점이 앵커 시작점으로 이동한다", () => {
    const strokes: SketchPoint[][] = [
      [{ u: 0, v: 0 }, { u: 10, v: 0 }],
      [{ u: 4, v: 5 }, { u: 8, v: 9 }],
    ];
    const out = solveMultiConstraint(strokes, seg(0, 0), seg(1, 0), "coincident");
    expect(out).not.toBeNull();
    const res = out!;

    // 앵커 시작점은 고정(0,0), 두 번째 세그먼트 시작점이 그 위로 온다.
    expect(res[1]![0]!.u).toBeCloseTo(res[0]![0]!.u, 5);
    expect(res[1]![0]!.v).toBeCloseTo(res[0]![0]!.v, 5);
    expect(res[1]![0]!.u).toBeCloseTo(0, 5);
    expect(res[1]![0]!.v).toBeCloseTo(0, 5);
  });

  it("invalid seg ref → null", () => {
    const strokes: SketchPoint[][] = [
      [{ u: 0, v: 0 }, { u: 10, v: 0 }],
      [{ u: 0, v: 5 }, { u: 8, v: 9 }],
    ];
    const out = solveMultiConstraint(strokes, seg(0, 0), seg(9, 0), "parallel");
    expect(out).toBeNull();
  });
});
