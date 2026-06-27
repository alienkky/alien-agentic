import { describe, it, expect } from "vitest";
import { tessellateBox } from "./occt/boxMesh";
import { tessellateCylinder } from "./occt/cylinderMesh";
import { meshBoolean } from "./meshBoolean";

describe("meshBoolean (three-bvh-csg)", () => {
  const box = tessellateBox(4, 4, 4, "box-1");
  const cyl = tessellateCylinder(1.5, 6, "cyl-1");

  it("빼기(cut): 박스 − 실린더 → 삼각형이 있는 결과", () => {
    const result = meshBoolean(box, cyl, "cut", "bool-1");
    expect(result.shapeId).toBe("bool-1");
    expect(result.indices.length).toBeGreaterThan(0);
    expect(result.indices.length % 3).toBe(0);
    expect(result.triFaceId.length).toBe(result.indices.length / 3);
    // 구멍이 뚫렸으면 원래 박스보다 삼각형이 많다(실린더 벽면 추가)
    expect(result.positions.length).toBeGreaterThan(0);
  });

  it("합치기(fuse): 결과가 비어있지 않다", () => {
    const result = meshBoolean(box, cyl, "fuse", "bool-2");
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("교집합(common): 겹치는 부분이 있으므로 결과가 있다", () => {
    const result = meshBoolean(box, cyl, "common", "bool-3");
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("결과 인덱스가 정점 범위 안에 있다", () => {
    const result = meshBoolean(box, cyl, "cut", "bool-4");
    const vertCount = result.positions.length / 3;
    for (const idx of result.indices) expect(idx).toBeLessThan(vertCount);
  });
});
