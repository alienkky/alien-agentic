import { describe, it, expect } from "vitest";
import type { Constraint } from "../kernel/constraintSolver";
import type { VertexModel } from "../kernel/sketchConstraints";
import { computeGlyphs } from "./constraintGlyphs";

/** 테스트용 모델 헬퍼 — (x,y) 쌍 목록을 VertexModel 로. */
function modelOf(coords: [number, number][]): VertexModel {
  return { pts: coords.map(([x, y]) => ({ x, y })), map: [] };
}

describe("구속 글리프 배치", () => {
  it("horizontal: (0,0)→(10,0) 중점 (5,0), kind/label 매핑", () => {
    const model = modelOf([
      [0, 0],
      [10, 0],
    ]);
    const cons: Constraint[] = [{ kind: "horizontal", a: 0, b: 1 }];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0]!.at.u).toBeCloseTo(5, 9);
    expect(glyphs[0]!.at.v).toBeCloseTo(0, 9);
    expect(glyphs[0]!.kind).toBe("horizontal");
    expect(glyphs[0]!.label).toBe("—");
  });

  it("parallel: 두 세그먼트 중점의 중점 (5,2), label ∥", () => {
    const model = modelOf([
      [0, 0],
      [10, 0],
      [0, 4],
      [10, 4],
    ]);
    const cons: Constraint[] = [{ kind: "parallel", a: 0, b: 1, c: 2, d: 3 }];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0]!.at.u).toBeCloseTo(5, 9);
    expect(glyphs[0]!.at.v).toBeCloseTo(2, 9);
    expect(glyphs[0]!.kind).toBe("parallel");
    expect(glyphs[0]!.label).toBe("∥");
  });

  it("coincident: 정점 a 위치, label •", () => {
    const model = modelOf([
      [3, 7],
      [3, 7],
    ]);
    const cons: Constraint[] = [{ kind: "coincident", a: 0, b: 1 }];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0]!.at.u).toBeCloseTo(3, 9);
    expect(glyphs[0]!.at.v).toBeCloseTo(7, 9);
    expect(glyphs[0]!.kind).toBe("coincident");
    expect(glyphs[0]!.label).toBe("•");
  });

  it("범위 밖 인덱스: 글리프 없음", () => {
    const model = modelOf([[0, 0]]); // 정점 1개뿐 (유효 인덱스 0)
    const cons: Constraint[] = [
      { kind: "horizontal", a: 0, b: 5 }, // b 범위 밖
      { kind: "parallel", a: 0, b: 0, c: 0, d: 9 }, // d 범위 밖
    ];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(0);
  });

  it("fixX / fixY: 글리프 없음 (의도적 스킵)", () => {
    const model = modelOf([
      [1, 2],
      [3, 4],
    ]);
    const cons: Constraint[] = [
      { kind: "fixX", a: 0, x: 1 },
      { kind: "fixY", a: 1, y: 4 },
    ];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(0);
  });

  it("perpendicular/vertical/distance 도 매핑 (보강)", () => {
    const model = modelOf([
      [0, 0],
      [0, 10],
      [2, 0],
      [2, 10],
    ]);
    const cons: Constraint[] = [
      { kind: "vertical", a: 0, b: 1 }, // 중점 (0,5)
      { kind: "distance", a: 0, b: 1, d: 10 }, // 중점 (0,5)
      { kind: "perpendicular", a: 0, b: 1, c: 2, d: 3 }, // 중점의중점 (1,5)
    ];
    const glyphs = computeGlyphs(model, cons);
    expect(glyphs).toHaveLength(3);
    expect(glyphs[0]!.label).toBe("|");
    expect(glyphs[1]!.label).toBe("↔");
    expect(glyphs[2]!.kind).toBe("perpendicular");
    expect(glyphs[2]!.label).toBe("⊥");
    expect(glyphs[2]!.at.u).toBeCloseTo(1, 9);
    expect(glyphs[2]!.at.v).toBeCloseTo(5, 9);
  });
});
