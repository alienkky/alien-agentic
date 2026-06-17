import { describe, it, expect } from "vitest";
import { convertLength, toMm, formatLength, unitSuffix } from "./units";

describe("units — 길이 변환·표기", () => {
  it("convertLength: mm 기준 단위 변환", () => {
    expect(convertLength(10, "mm")).toBeCloseTo(10, 6);
    expect(convertLength(10, "cm")).toBeCloseTo(1, 6);
    expect(convertLength(1000, "m")).toBeCloseTo(1, 6);
    expect(convertLength(25.4, "in")).toBeCloseTo(1, 6);
    expect(convertLength(304.8, "ft")).toBeCloseTo(1, 6);
  });

  it("toMm: 사용자 단위 → mm 라운드트립", () => {
    for (const u of ["mm", "cm", "m", "in", "ft"] as const) {
      expect(toMm(convertLength(123.456, u), u)).toBeCloseTo(123.456, 4);
    }
  });

  it("formatLength: 단위별 소수 자릿수 + 접미", () => {
    expect(formatLength(10, "mm")).toBe("10.00 mm");
    expect(formatLength(25.4, "in")).toBe("1.000 in");
    expect(formatLength(10, "mm", { prefix: "⌀ " })).toBe("⌀ 10.00 mm");
    expect(formatLength(10, "mm", { suffix: false })).toBe("10.00");
  });

  it("unitSuffix", () => {
    expect(unitSuffix("in")).toBe("in");
    expect(unitSuffix("mm")).toBe("mm");
  });
});
