import { describe, it, expect } from "vitest";
import { applySolo, applyPair, applyCoincident, CONSTRAINT_SPECS } from "./sketchConstraints";
import type { SketchPoint } from "./sketchPlane";

const seg = (a: SketchPoint, b: SketchPoint): SketchPoint[] => [a, b];
const len = (a: SketchPoint, b: SketchPoint): number => Math.hypot(b.u - a.u, b.v - a.v);

describe("applySolo — 수평/수직", () => {
  it("기운 선분을 수평으로, 길이·첫 끝점 유지", () => {
    const strokes = [seg({ u: 0, v: 0 }, { u: 3, v: 4 })]; // 길이 5
    const out = applySolo(strokes, { s: 0, i: 0 }, "horizontal");
    const a = out[0]![0]!;
    const b = out[0]![1]!;
    expect(a).toEqual({ u: 0, v: 0 }); // 첫 끝점 고정
    expect(b.v).toBeCloseTo(0); // 수평
    expect(len(a, b)).toBeCloseTo(5); // 길이 유지
  });

  it("수직 — du 방향 부호 보존(왼쪽 아래 선분)", () => {
    const strokes = [seg({ u: 2, v: 2 }, { u: -1, v: -2 })]; // 길이 5, dv<0
    const out = applySolo(strokes, { s: 0, i: 0 }, "vertical");
    const b = out[0]![1]!;
    expect(b.u).toBeCloseTo(2); // 수직: u 고정
    expect(b.v).toBeCloseTo(2 - 5); // dv<0 → 아래로
  });

  it("퇴화 선분(길이 0)은 원본 유지", () => {
    const strokes = [seg({ u: 1, v: 1 }, { u: 1, v: 1 })];
    expect(applySolo(strokes, { s: 0, i: 0 }, "horizontal")).toBe(strokes);
  });
});

describe("applyPair — 평행/직교/동일", () => {
  it("평행: 대상 방향을 기준과 정렬, 길이 유지", () => {
    const strokes = [
      seg({ u: 0, v: 0 }, { u: 2, v: 0 }), // 기준: +u
      seg({ u: 0, v: 5 }, { u: 3, v: 3 }), // 대상: 길이 hypot(3,-2)
    ];
    const tlen = len(strokes[1]![0]!, strokes[1]![1]!);
    const out = applyPair(strokes, { s: 0, i: 0 }, { s: 1, i: 0 }, "parallel");
    const a = out[1]![0]!;
    const b = out[1]![1]!;
    expect(b.v).toBeCloseTo(a.v); // 기준이 수평 → 대상도 수평
    expect(len(a, b)).toBeCloseTo(tlen);
  });

  it("직교: 대상이 기준에 수직", () => {
    const strokes = [
      seg({ u: 0, v: 0 }, { u: 4, v: 0 }), // 기준 +u
      seg({ u: 1, v: 1 }, { u: 4, v: 2 }), // 대상
    ];
    const out = applyPair(strokes, { s: 0, i: 0 }, { s: 1, i: 0 }, "perpendicular");
    const a = out[1]![0]!;
    const b = out[1]![1]!;
    expect(b.u).toBeCloseTo(a.u); // 수평에 직교 → 수직
  });

  it("동일: 대상 길이를 기준 길이로, 방향 유지", () => {
    const strokes = [
      seg({ u: 0, v: 0 }, { u: 0, v: 10 }), // 기준 길이 10
      seg({ u: 5, v: 5 }, { u: 8, v: 9 }), // 대상 길이 5
    ];
    const out = applyPair(strokes, { s: 0, i: 0 }, { s: 1, i: 0 }, "equal");
    const a = out[1]![0]!;
    const b = out[1]![1]!;
    expect(len(a, b)).toBeCloseTo(10);
    expect(a).toEqual({ u: 5, v: 5 }); // 첫 끝점 고정
  });

  it("기준 퇴화 선분이면 원본 유지", () => {
    const strokes = [seg({ u: 0, v: 0 }, { u: 0, v: 0 }), seg({ u: 1, v: 1 }, { u: 2, v: 2 })];
    expect(applyPair(strokes, { s: 0, i: 0 }, { s: 1, i: 0 }, "parallel")).toBe(strokes);
  });
});

describe("applyCoincident — 점 일치", () => {
  it("대상점을 기준점 위치로 이동", () => {
    const strokes = [
      [{ u: 0, v: 0 }, { u: 1, v: 1 }],
      [{ u: 5, v: 5 }, { u: 9, v: 2 }],
    ];
    const out = applyCoincident(strokes, { s: 0, i: 1 }, { s: 1, i: 0 });
    expect(out[1]![0]).toEqual({ u: 1, v: 1 });
    expect(out[0]![1]).toEqual({ u: 1, v: 1 }); // 기준점은 그대로
  });

  it("범위 밖이면 원본 유지", () => {
    const strokes = [[{ u: 0, v: 0 }]];
    expect(applyCoincident(strokes, { s: 0, i: 9 }, { s: 0, i: 0 })).toBe(strokes);
  });
});

describe("CONSTRAINT_SPECS — 메타", () => {
  it("선분/점 타깃·개수가 맞다", () => {
    expect(CONSTRAINT_SPECS.horizontal).toMatchObject({ target: "seg", count: 1 });
    expect(CONSTRAINT_SPECS.parallel).toMatchObject({ target: "seg", count: 2 });
    expect(CONSTRAINT_SPECS.coincident).toMatchObject({ target: "point", count: 2 });
  });
});
