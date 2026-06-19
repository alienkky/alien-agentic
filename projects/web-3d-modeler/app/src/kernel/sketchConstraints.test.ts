import { describe, it, expect } from "vitest";
import { extractVertices, applyToStrokes, buildSegmentSolve, autoSegKind, nearAxisKind, buildAutoConstraints } from "./sketchConstraints";
import { solveConstraints } from "./constraintSolver";
import type { SketchPoint } from "./sketchPlane";

const L = (...pts: [number, number][]): SketchPoint[] => pts.map(([u, v]) => ({ u, v }));

describe("스케치 구속 브릿지 — 정점 병합", () => {
  it("가까운 코너를 한 공유 정점으로 합친다", () => {
    // 두 선이 (10,0) 근처에서 만난다 (0.3 차이 < tol 0.6)
    const strokes = [L([0, 0], [10, 0]), L([10.3, 0.1], [10, 8])];
    const m = extractVertices(strokes);
    expect(m.map[0]![1]).toBe(m.map[1]![0]); // 공유 정점 = 같은 전역 인덱스
    expect(m.pts.length).toBe(3); // 4 정점 → 3 (하나 병합)
  });

  it("멀리 떨어진 정점은 합치지 않는다", () => {
    const strokes = [L([0, 0], [10, 0]), L([20, 0], [20, 8])];
    const m = extractVertices(strokes);
    expect(m.pts.length).toBe(4);
  });

  it("applyToStrokes 는 솔버 해를 모든 스트로크에 되쓴다 (공유 정점 동기화)", () => {
    const strokes = [L([0, 0], [10, 0]), L([10, 0], [10, 8])];
    const m = extractVertices(strokes);
    const moved = m.pts.map((p, i) => (i === m.map[0]![1]! ? { x: 10, y: 2 } : p));
    const out = applyToStrokes(strokes, m, moved);
    // 공유 코너가 두 스트로크 모두에서 (10,2) 로 갱신
    expect(out[0]![1]).toEqual({ u: 10, v: 2 });
    expect(out[1]![0]).toEqual({ u: 10, v: 2 });
  });
});

describe("스케치 구속 브릿지 — 세그먼트 H/V 적용", () => {
  it("기운 아래변에 수평 적용 → 두 끝점 y 동일, 앵커 고정", () => {
    const strokes = [L([0, 0], [10, 1])]; // 살짝 기운 선
    const m = extractVertices(strokes);
    const built = buildSegmentSolve(m, 0, 0, "horizontal")!;
    expect(built).not.toBeNull();
    const pts = m.pts.map((p, i) => (i === built.anchor ? { ...p, fixed: true } : p));
    const res = solveConstraints(pts, built.constraints);
    const out = applyToStrokes(strokes, m, res.points);
    expect(out[0]![0]).toEqual({ u: 0, v: 0 }); // 앵커 그대로
    expect(out[0]![1]!.v).toBeCloseTo(0, 5); // 수평
    expect(out[0]![1]!.u).toBeCloseTo(10, 5); // x 유지
  });

  it("공유 코너를 가진 변에 수평 적용 → 붙은 변도 코너 따라옴", () => {
    // ㄴ자: 아래변 (0,0)-(10,1) + 오른변 (10,1)-(10,9). 코너 공유.
    const strokes = [L([0, 0], [10, 1]), L([10, 1], [10, 9])];
    const m = extractVertices(strokes);
    const built = buildSegmentSolve(m, 0, 0, "horizontal")!;
    const pts = m.pts.map((p, i) => (i === built.anchor ? { ...p, fixed: true } : p));
    const res = solveConstraints(pts, built.constraints);
    const out = applyToStrokes(strokes, m, res.points);
    // 아래변 수평 → 코너 y=0. 오른변 시작점도 같은 코너라 y=0 으로 따라옴.
    expect(out[0]![1]!.v).toBeCloseTo(0, 5);
    expect(out[1]![0]!.v).toBeCloseTo(0, 5);
    expect(out[1]![0]).toEqual(out[0]![1]); // 코너 동기화 유지
  });

  it("autoSegKind: 수평에 가까우면 horizontal, 수직에 가까우면 vertical", () => {
    expect(autoSegKind({ u: 0, v: 0 }, { u: 10, v: 1 })).toBe("horizontal");
    expect(autoSegKind({ u: 0, v: 0 }, { u: 1, v: 10 })).toBe("vertical");
  });

  it("잘못된 세그먼트 인덱스 → null", () => {
    const m = extractVertices([L([0, 0], [10, 0])]);
    expect(buildSegmentSolve(m, 0, 5, "horizontal")).toBeNull();
    expect(buildSegmentSolve(m, 9, 0, "horizontal")).toBeNull();
  });
});

describe("스케치 구속 브릿지 — 자동 구속 (그릴 때)", () => {
  it("nearAxisKind: 축 8° 이내만 H/V, 대각은 null", () => {
    expect(nearAxisKind({ u: 0, v: 0 }, { u: 10, v: 0.5 })).toBe("horizontal"); // ~2.9°
    expect(nearAxisKind({ u: 0, v: 0 }, { u: 0.5, v: 10 })).toBe("vertical");
    expect(nearAxisKind({ u: 0, v: 0 }, { u: 10, v: 10 })).toBeNull(); // 45° 대각 유지
  });

  it("buildAutoConstraints: 거의 수평/수직 변에만 구속, 대각변 제외", () => {
    // 3점 폴리라인: 거의 수평 → 대각 → 거의 수직
    const strokes = [L([0, 0], [10, 0.4], [10.3, 8], [5, 5])];
    const m = extractVertices(strokes);
    const cons = buildAutoConstraints(strokes, m, 0);
    // 세그0(수평) + 세그1(수직) 잡히고, 세그2(대각)는 제외 → 2개
    expect(cons.length).toBe(2);
    expect(cons[0]!.kind).toBe("horizontal");
    expect(cons[1]!.kind).toBe("vertical");
  });

  it("자동 구속 풀이 → 거의 수평인 변이 정확히 수평으로", () => {
    const strokes = [L([0, 0], [10, 0.4])];
    const m = extractVertices(strokes);
    const cons = buildAutoConstraints(strokes, m, 0);
    const anchor = m.map[0]![0]!;
    const pts = m.pts.map((p, i) => (i === anchor ? { ...p, fixed: true } : p));
    const res = solveConstraints(pts, cons);
    const out = applyToStrokes(strokes, m, res.points);
    expect(out[0]![1]!.v).toBeCloseTo(0, 4);
  });
});
