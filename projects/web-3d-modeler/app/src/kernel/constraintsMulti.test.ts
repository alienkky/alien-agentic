import { describe, it, expect } from "vitest";
import { segVerts, buildParallel, buildPerpendicular, buildCoincidentStarts } from "./constraintsMulti";
import { extractVertices } from "./sketchConstraints";
import { solveConstraints, type Pt } from "./constraintSolver";
import type { SketchPoint } from "./sketchPlane";

const L = (...pts: [number, number][]): SketchPoint[] => pts.map(([u, v]) => ({ u, v }));

/** segA(스트로크0)의 두 정점을 고정한 점 배열을 만든다. */
function fixSeg(pts: Pt[], a: number, b: number): Pt[] {
  return pts.map((p, i) => (i === a || i === b ? { ...p, fixed: true } : { ...p }));
}

describe("constraintsMulti — segVerts", () => {
  it("세그먼트 참조를 올바른 전역 정점 인덱스로 변환", () => {
    // 두 스트로크가 멀리 떨어져 병합 없음 → 4 정점
    const strokes = [L([0, 0], [10, 1]), L([0, 5], [10, 3])];
    const m = extractVertices(strokes);
    expect(segVerts(m, { s: 0, i: 0 })).toEqual([m.map[0]![0], m.map[0]![1]]);
    expect(segVerts(m, { s: 1, i: 0 })).toEqual([m.map[1]![0], m.map[1]![1]]);
  });

  it("범위를 벗어난 참조 → null", () => {
    const m = extractVertices([L([0, 0], [10, 0])]);
    expect(segVerts(m, { s: 0, i: 5 })).toBeNull(); // 점 인덱스 초과
    expect(segVerts(m, { s: 9, i: 0 })).toBeNull(); // 스트로크 인덱스 초과
  });
});

describe("constraintsMulti — buildParallel", () => {
  it("기운 두 변에 평행 구속 + 풀이 → 외적 ≈ 0 (평행)", () => {
    // segA: (0,0)-(10,2) 고정. segB: (0,5)-(8,5) 자유 → segA 와 평행해져야.
    const strokes = [L([0, 0], [10, 2]), L([0, 5], [8, 5])];
    const m = extractVertices(strokes);
    const cons = buildParallel(m, { s: 0, i: 0 }, { s: 1, i: 0 })!;
    expect(cons).not.toBeNull();
    const [a0, a1] = segVerts(m, { s: 0, i: 0 })!;
    const pts = fixSeg(m.pts, a0, a1);
    const res = solveConstraints(pts, cons);
    const [b0, b1] = segVerts(m, { s: 1, i: 0 })!;
    const ux = res.points[a1]!.x - res.points[a0]!.x;
    const uy = res.points[a1]!.y - res.points[a0]!.y;
    const vx = res.points[b1]!.x - res.points[b0]!.x;
    const vy = res.points[b1]!.y - res.points[b0]!.y;
    expect(ux * vy - uy * vx).toBeCloseTo(0, 5); // 외적 0 = 평행
    // 고정한 segA 는 그대로
    expect(res.points[a0]!).toMatchObject({ x: 0, y: 0 });
    expect(res.points[a1]!).toMatchObject({ x: 10, y: 2 });
  });

  it("퇴화 세그먼트(같은 정점) / 잘못된 참조 → null", () => {
    // 두 점이 tol 안에 겹쳐 한 정점으로 병합 → 세그먼트가 퇴화
    const m = extractVertices([L([0, 0], [0.1, 0.1]), L([0, 5], [8, 5])]);
    expect(buildParallel(m, { s: 0, i: 0 }, { s: 1, i: 0 })).toBeNull();
    const m2 = extractVertices([L([0, 0], [10, 2]), L([0, 5], [8, 5])]);
    expect(buildParallel(m2, { s: 0, i: 9 }, { s: 1, i: 0 })).toBeNull();
  });
});

describe("constraintsMulti — buildPerpendicular", () => {
  it("두 변에 직각 구속 + 풀이 → 내적 ≈ 0 (직각)", () => {
    // segA: (0,0)-(10,2) 고정. segB: (0,5)-(8,5) 자유 → segA 에 수직.
    const strokes = [L([0, 0], [10, 2]), L([0, 5], [8, 5])];
    const m = extractVertices(strokes);
    const cons = buildPerpendicular(m, { s: 0, i: 0 }, { s: 1, i: 0 })!;
    expect(cons).not.toBeNull();
    const [a0, a1] = segVerts(m, { s: 0, i: 0 })!;
    const pts = fixSeg(m.pts, a0, a1);
    const res = solveConstraints(pts, cons);
    const [b0, b1] = segVerts(m, { s: 1, i: 0 })!;
    const ux = res.points[a1]!.x - res.points[a0]!.x;
    const uy = res.points[a1]!.y - res.points[a0]!.y;
    const vx = res.points[b1]!.x - res.points[b0]!.x;
    const vy = res.points[b1]!.y - res.points[b0]!.y;
    expect(ux * vx + uy * vy).toBeCloseTo(0, 5); // 내적 0 = 직각
  });

  it("퇴화 세그먼트 → null", () => {
    const m = extractVertices([L([0, 0], [0.1, 0.1]), L([0, 5], [8, 5])]);
    expect(buildPerpendicular(m, { s: 0, i: 0 }, { s: 1, i: 0 })).toBeNull();
  });
});

describe("constraintsMulti — buildCoincidentStarts", () => {
  it("두 변의 시작점 일치 구속 + 풀이 → 시작 정점이 한 점으로", () => {
    // 멀리 떨어진 두 변. segB 시작점이 자유라 segA 시작점으로 끌려와야.
    const strokes = [L([0, 0], [10, 0]), L([5, 9], [12, 9])];
    const m = extractVertices(strokes);
    const cons = buildCoincidentStarts(m, { s: 0, i: 0 }, { s: 1, i: 0 })!;
    expect(cons).not.toBeNull();
    const [a0, a1] = segVerts(m, { s: 0, i: 0 })!;
    const pts = fixSeg(m.pts, a0, a1); // segA 고정 → segB 시작점이 따라옴
    const res = solveConstraints(pts, cons);
    const [b0] = segVerts(m, { s: 1, i: 0 })!;
    expect(res.points[b0]!.x).toBeCloseTo(res.points[a0]!.x, 5);
    expect(res.points[b0]!.y).toBeCloseTo(res.points[a0]!.y, 5);
  });

  it("잘못된 참조 → null", () => {
    const m = extractVertices([L([0, 0], [10, 0]), L([5, 9], [12, 9])]);
    expect(buildCoincidentStarts(m, { s: 0, i: 0 }, { s: 7, i: 0 })).toBeNull();
    expect(buildCoincidentStarts(m, { s: 0, i: 4 }, { s: 1, i: 0 })).toBeNull();
  });
});
