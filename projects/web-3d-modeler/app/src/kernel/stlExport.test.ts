import { describe, it, expect } from "vitest";
import { meshesToStl } from "./stlExport";
import { tessellateBox } from "./occt/boxMesh";

describe("STL 내보내기 — 바이너리 직렬화", () => {
  it("헤더 84바이트 + 삼각형당 50바이트, 삼각형 수 일치", () => {
    const box = tessellateBox(2, 2, 2, "box-1");
    const tris = box.indices.length / 3;
    const stl = meshesToStl([box]);
    expect(stl.byteLength).toBe(84 + tris * 50);
    expect(new DataView(stl).getUint32(80, true)).toBe(tris);
  });

  it("여러 바디 + 위치 오프셋 합산", () => {
    const a = tessellateBox(2, 2, 2, "a");
    const b = tessellateBox(2, 2, 2, "b");
    const triA = a.indices.length / 3;
    const triB = b.indices.length / 3;
    const stl = meshesToStl([a, b], { b: [10, 0, 0] });
    expect(new DataView(stl).getUint32(80, true)).toBe(triA + triB);
    // 오프셋이 반영돼 일부 정점 x 가 9(=10-1) 이상이어야 한다.
    const dv = new DataView(stl);
    let sawShifted = false;
    for (let off = 84; off < stl.byteLength; off += 50) {
      if (dv.getFloat32(off + 12, true) >= 9) { sawShifted = true; break; }
    }
    expect(sawShifted).toBe(true);
  });
});
