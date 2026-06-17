import { describe, it, expect } from "vitest";
import { solveConstraints, type Pt, type Constraint } from "./constraintSolver";

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

describe("구속 솔버 — 단일 구속", () => {
  it("distance: 자유점이 고정점에서 정확히 d 만큼 떨어진다", () => {
    const pts: Pt[] = [{ x: 10, y: 0 }, { x: 0, y: 0, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "distance", a: 0, b: 1, d: 5 }]);
    expect(res.converged).toBe(true);
    expect(dist(res.points[0]!, res.points[1]!)).toBeCloseTo(5, 5);
  });

  it("horizontal: 자유점의 y 가 고정점 y 에 맞춰지고 x 는 유지", () => {
    const pts: Pt[] = [{ x: 2, y: 3 }, { x: 5, y: 0, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "horizontal", a: 0, b: 1 }]);
    expect(res.points[0]!.y).toBeCloseTo(0, 5);
    expect(res.points[0]!.x).toBeCloseTo(2, 5);
  });

  it("vertical: 자유점의 x 가 고정점 x 에 맞춰진다", () => {
    const pts: Pt[] = [{ x: 2, y: 3 }, { x: 5, y: 9, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "vertical", a: 0, b: 1 }]);
    expect(res.points[0]!.x).toBeCloseTo(5, 5);
  });

  it("coincident: 자유점이 고정점 위로 합쳐진다", () => {
    const pts: Pt[] = [{ x: 1, y: 1 }, { x: 4, y: 5, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "coincident", a: 0, b: 1 }]);
    expect(res.points[0]!.x).toBeCloseTo(4, 5);
    expect(res.points[0]!.y).toBeCloseTo(5, 5);
  });

  it("fixX / fixY: 좌표를 절대값에 고정", () => {
    const pts: Pt[] = [{ x: 3, y: 3 }];
    const rx = solveConstraints(pts, [{ kind: "fixX", a: 0, x: 7 }]);
    expect(rx.points[0]!.x).toBeCloseTo(7, 5);
    expect(rx.points[0]!.y).toBeCloseTo(3, 5);
  });
});

describe("구속 솔버 — 선 관계", () => {
  it("parallel: 수평선에 평행 → 두 번째 선도 수평", () => {
    const pts: Pt[] = [
      { x: 0, y: 0, fixed: true }, { x: 1, y: 0, fixed: true }, // 선1 (수평)
      { x: 0, y: 5, fixed: true }, { x: 3, y: 9 }, // 선2, d 자유
    ];
    const cons: Constraint[] = [{ kind: "parallel", a: 0, b: 1, c: 2, d: 3 }];
    const res = solveConstraints(pts, cons);
    expect(res.points[3]!.y).toBeCloseTo(5, 4); // 선2 수평 → c 와 같은 y
  });

  it("perpendicular: 수평선에 수직 → 두 번째 선 수직", () => {
    const pts: Pt[] = [
      { x: 0, y: 0, fixed: true }, { x: 1, y: 0, fixed: true },
      { x: 0, y: 0, fixed: true }, { x: 3, y: 3 },
    ];
    const cons: Constraint[] = [{ kind: "perpendicular", a: 0, b: 1, c: 2, d: 3 }];
    const res = solveConstraints(pts, cons);
    expect(res.points[3]!.x).toBeCloseTo(0, 4); // 수직 → x=0
  });
});

describe("구속 솔버 — 불변식", () => {
  it("고정점은 절대 움직이지 않는다", () => {
    const pts: Pt[] = [{ x: 9, y: 9 }, { x: 0, y: 0, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "coincident", a: 0, b: 1 }]);
    expect(res.points[1]!.x).toBe(0);
    expect(res.points[1]!.y).toBe(0);
  });

  it("입력 배열을 변형하지 않는다 (순수)", () => {
    const pts: Pt[] = [{ x: 10, y: 0 }, { x: 0, y: 0, fixed: true }];
    solveConstraints(pts, [{ kind: "distance", a: 0, b: 1, d: 5 }]);
    expect(pts[0]!.x).toBe(10); // 원본 보존
  });

  it("이미 만족된 계는 0 회 반복으로 수렴", () => {
    const pts: Pt[] = [{ x: 3, y: 4 }, { x: 0, y: 0, fixed: true }];
    const res = solveConstraints(pts, [{ kind: "distance", a: 0, b: 1, d: 5 }]);
    expect(res.iterations).toBe(0);
    expect(res.converged).toBe(true);
  });
});

describe("구속 솔버 — 사각형 (복합)", () => {
  it("거친 사각형 → 10×5 직사각형으로 수렴", () => {
    const pts: Pt[] = [
      { x: 0, y: 0, fixed: true }, // p0 원점
      { x: 8, y: 1 }, // p1
      { x: 9, y: 6 }, // p2
      { x: 1, y: 4 }, // p3
    ];
    const cons: Constraint[] = [
      { kind: "horizontal", a: 0, b: 1 }, // 아래변 수평
      { kind: "horizontal", a: 3, b: 2 }, // 윗변 수평
      { kind: "vertical", a: 0, b: 3 }, // 왼변 수직
      { kind: "vertical", a: 1, b: 2 }, // 오른변 수직
      { kind: "distance", a: 0, b: 1, d: 10 }, // 폭 10
      { kind: "distance", a: 0, b: 3, d: 5 }, // 높이 5
    ];
    const res = solveConstraints(pts, cons);
    expect(res.converged).toBe(true);
    expect(res.residual).toBeLessThan(1e-6);
    expect(dist(res.points[0]!, res.points[1]!)).toBeCloseTo(10, 4);
    expect(dist(res.points[0]!, res.points[3]!)).toBeCloseTo(5, 4);
    expect(res.points[1]!.y).toBeCloseTo(0, 4); // 아래변 수평
    expect(res.points[3]!.x).toBeCloseTo(0, 4); // 왼변 수직
  });
});
