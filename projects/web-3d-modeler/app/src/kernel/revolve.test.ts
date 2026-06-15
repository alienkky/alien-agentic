import { describe, it, expect } from "vitest";
import { revolveProfile } from "./revolve";
import { SKETCH_PLANES, type SketchPoint } from "./sketchPlane";

function bounds(p: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

// 축(u=0)에서 떨어진 사각형 프로파일 → 세로축 둘레 360° 회전 = 링(튜브)
const ring: SketchPoint[] = [
  { u: 3, v: -1 }, { u: 5, v: -1 }, { u: 5, v: 1 }, { u: 3, v: 1 },
];

describe("회전(Revolve)", () => {
  it("360° 회전 → 솔리드 생성 (삼각형 다수)", () => {
    const mesh = revolveProfile(ring, SKETCH_PLANES.xz, 360, "v", "rev-1");
    expect(mesh.indices.length / 3).toBeGreaterThan(100);
  });

  it("세로축(v) 둘레 회전: 반지름 방향(x·z)이 ±바깥반경까지 펼쳐짐", () => {
    const mesh = revolveProfile(ring, SKETCH_PLANES.xz, 360, "v", "rev-2");
    const b = bounds(mesh.positions);
    // xz 평면, 세로축=z(world). 반지름 5 → x 가 약 ±5
    expect(b.max[0]!).toBeGreaterThan(4.5);
    expect(b.min[0]!).toBeLessThan(-4.5);
    // 높이 v(=z) 는 -1..1
    expect(b.max[2]!).toBeLessThan(5.1);
  });

  it("점 3개 미만이면 던진다", () => {
    expect(() => revolveProfile([{ u: 1, v: 0 }, { u: 2, v: 0 }], SKETCH_PLANES.xz, 360, "v", "x")).toThrow();
  });
});
