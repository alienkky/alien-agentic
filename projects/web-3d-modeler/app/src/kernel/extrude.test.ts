import { describe, it, expect } from "vitest";
import { extrudeProfile } from "./extrude";

describe("extrudeProfile", () => {
  const square = [
    { x: -2, z: -2 },
    { x: 2, z: -2 },
    { x: 2, z: 2 },
    { x: -2, z: 2 },
  ];

  it("사각형 프로파일 → 솔리드(삼각형 있음)", () => {
    const m = extrudeProfile(square, 3, "ext-1");
    expect(m.shapeId).toBe("ext-1");
    expect(m.indices.length).toBeGreaterThan(0);
    expect(m.indices.length % 3).toBe(0);
    expect(m.triFaceId.length).toBe(m.indices.length / 3);
  });

  it("돌출 높이만큼 Y 범위가 생긴다", () => {
    const m = extrudeProfile(square, 5, "ext-2");
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < m.positions.length; i += 3) {
      minY = Math.min(minY, m.positions[i]!);
      maxY = Math.max(maxY, m.positions[i]!);
    }
    expect(maxY - minY).toBeCloseTo(5, 3);
  });

  it("점이 3개 미만이면 거부", () => {
    expect(() => extrudeProfile([{ x: 0, z: 0 }, { x: 1, z: 0 }], 2, "x")).toThrow();
  });
});
