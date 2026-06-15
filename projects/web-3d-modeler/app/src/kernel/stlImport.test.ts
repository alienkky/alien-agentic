import { describe, it, expect } from "vitest";
import { meshesToStl } from "./stlExport";
import { parseStl } from "./stlImport";
import { tessellateBox } from "./occt/boxMesh";

function bounds(m: { positions: Float32Array }): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = m.positions[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

describe("STL 왕복 — 내보내기 → 불러오기", () => {
  it("바이너리 STL 라운드트립: 삼각형 수·경계 보존", () => {
    const box = tessellateBox(4, 6, 8, "box-1");
    const stl = meshesToStl([box]);
    const imported = parseStl(stl, "import-1");

    expect(imported.indices.length).toBe(box.indices.length);
    const b0 = bounds(box);
    const b1 = bounds(imported);
    for (let k = 0; k < 3; k++) {
      expect(b1.min[k]!).toBeCloseTo(b0.min[k]!, 3);
      expect(b1.max[k]!).toBeCloseTo(b0.max[k]!, 3);
    }
  });

  it("ASCII STL 도 파싱", () => {
    const ascii = [
      "solid t",
      "facet normal 0 0 1",
      "  outer loop",
      "    vertex 0 0 0",
      "    vertex 1 0 0",
      "    vertex 0 1 0",
      "  endloop",
      "endfacet",
      "endsolid t",
    ].join("\n");
    const buf = new TextEncoder().encode(ascii).buffer;
    const m = parseStl(buf as ArrayBuffer, "ascii-1");
    expect(m.indices.length).toBe(3);
  });
});
