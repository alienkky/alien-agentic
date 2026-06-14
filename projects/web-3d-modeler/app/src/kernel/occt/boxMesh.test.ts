import { describe, it, expect } from "vitest";
import { tessellateBox } from "./boxMesh";

describe("tessellateBox — 메타데이터 포맷 불변식", () => {
  const mesh = tessellateBox(2, 2, 2, "box-1");

  it("6면 × 4정점 = 24정점, 6면 × 2삼각형 = 12삼각형", () => {
    expect(mesh.positions.length).toBe(24 * 3);
    expect(mesh.normals.length).toBe(24 * 3);
    expect(mesh.indices.length).toBe(12 * 3);
    expect(mesh.triFaceId.length).toBe(12);
  });

  it("모든 삼각형이 어떤 face 에 매핑된다 (faceId 0~5)", () => {
    for (const id of mesh.triFaceId) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(5);
    }
    const uniqueFaces = new Set(mesh.triFaceId);
    expect(uniqueFaces.size).toBe(6);
  });

  it("faceRanges 가 indices 전체를 빠짐없이 덮는다", () => {
    let covered = 0;
    for (const r of mesh.faceRanges) {
      covered += r.count;
    }
    expect(covered).toBe(mesh.indices.length);
  });

  it("faceRanges 의 삼각형이 triFaceId 와 일치한다", () => {
    for (const r of mesh.faceRanges) {
      for (let i = r.start; i < r.start + r.count; i += 3) {
        const tri = i / 3;
        expect(mesh.triFaceId[tri]).toBe(r.faceId);
      }
    }
  });

  it("12 모서리, 각 2점", () => {
    expect(mesh.edges.length).toBe(12);
    for (const e of mesh.edges) {
      expect(e.positions.length).toBe(6);
    }
  });

  it("인덱스가 정점 범위를 벗어나지 않는다", () => {
    const vertCount = mesh.positions.length / 3;
    for (const idx of mesh.indices) {
      expect(idx).toBeLessThan(vertCount);
    }
  });

  it("shapeId 가 보존된다", () => {
    expect(mesh.shapeId).toBe("box-1");
  });
});
