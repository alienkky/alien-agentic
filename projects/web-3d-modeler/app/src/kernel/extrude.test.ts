import { describe, it, expect } from "vitest";
import { extrudeProfile } from "./extrude";
import { SKETCH_PLANES, type SketchPoint } from "./sketchPlane";

describe("extrudeProfile", () => {
  const square: SketchPoint[] = [
    { u: -2, v: -2 },
    { u: 2, v: -2 },
    { u: 2, v: 2 },
    { u: -2, v: 2 },
  ];

  it("XZ 평면 사각형 → 솔리드(삼각형 있음)", () => {
    const m = extrudeProfile(square, SKETCH_PLANES.xz, 3, "ext-1");
    expect(m.shapeId).toBe("ext-1");
    expect(m.indices.length).toBeGreaterThan(0);
    expect(m.indices.length % 3).toBe(0);
    expect(m.triFaceId.length).toBe(m.indices.length / 3);
  });

  it("XZ 돌출은 Y(법선)로 높이가 생긴다", () => {
    const m = extrudeProfile(square, SKETCH_PLANES.xz, 5, "ext-2");
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < m.positions.length; i += 3) {
      minY = Math.min(minY, m.positions[i]!);
      maxY = Math.max(maxY, m.positions[i]!);
    }
    expect(maxY - minY).toBeCloseTo(5, 3);
  });

  it("XY 평면 돌출은 Z(법선)로 높이가 생긴다", () => {
    const m = extrudeProfile(square, SKETCH_PLANES.xy, 5, "ext-3");
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 2; i < m.positions.length; i += 3) {
      minZ = Math.min(minZ, m.positions[i]!);
      maxZ = Math.max(maxZ, m.positions[i]!);
    }
    expect(maxZ - minZ).toBeCloseTo(5, 3);
  });

  it("점이 3개 미만이면 거부", () => {
    expect(() => extrudeProfile([{ u: 0, v: 0 }, { u: 1, v: 0 }], SKETCH_PLANES.xz, 2, "x")).toThrow();
  });
});
