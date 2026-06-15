import { describe, it, expect } from "vitest";
import { translateMesh, rotateMeshAxis } from "./transformMesh";
import { tessellateBox } from "./occt/boxMesh";

function centroid(p: Float32Array): [number, number, number] {
  let x = 0, y = 0, z = 0;
  const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { x += p[i]!; y += p[i + 1]!; z += p[i + 2]!; }
  return [x / n, y / n, z / n];
}

describe("메시 변환", () => {
  it("translateMesh: 중심이 이동, 위상(인덱스) 보존", () => {
    const box = tessellateBox(2, 2, 2, "b");
    const moved = translateMesh(box, 5, 0, 0, "b2");
    expect(moved.indices).toEqual(box.indices);
    const c = centroid(moved.positions);
    expect(c[0]).toBeCloseTo(5, 5);
    expect(moved.shapeId).toBe("b2");
  });

  it("rotateMeshAxis: Y축 90° → 점 (2,0,0)이 (0,0,-2)로", () => {
    const box = tessellateBox(2, 2, 2, "b");
    const moved = translateMesh(box, 2, 0, 0, "b2"); // 중심 x=2
    const rot = rotateMeshAxis(moved, [0, 1, 0], Math.PI / 2, "b3");
    const c = centroid(rot.positions);
    expect(c[0]).toBeCloseTo(0, 4);
    expect(c[2]).toBeCloseTo(-2, 4);
  });
});
