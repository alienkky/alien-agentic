import { describe, it, expect } from "vitest";
import { defaultCamera, orbit, zoom, pan, toCartesian, type CameraState } from "./cameraMath";

describe("cameraMath", () => {
  it("toCartesian: 기본 카메라는 타깃에서 radius 만큼 떨어져 있다", () => {
    const c = defaultCamera();
    const pos = toCartesian(c);
    const dist = Math.hypot(pos[0] - c.target[0], pos[1] - c.target[1], pos[2] - c.target[2]);
    expect(dist).toBeCloseTo(c.radius, 5);
  });

  it("zoom factor>1 이면 가까워진다(radius 감소)", () => {
    const c = defaultCamera();
    expect(zoom(c, 2).radius).toBeLessThan(c.radius);
    expect(zoom(c, 0.5).radius).toBeGreaterThan(c.radius);
  });

  it("zoom 은 최소 radius 아래로 내려가지 않는다", () => {
    const c: CameraState = { ...defaultCamera(), radius: 0.6 };
    expect(zoom(c, 1000).radius).toBeGreaterThanOrEqual(0.5);
  });

  it("orbit 은 polar 를 (0, PI) 안에 클램프한다", () => {
    const c = defaultCamera();
    const up = orbit(c, 0, -100000);
    const down = orbit(c, 0, 100000);
    expect(up.polar).toBeGreaterThan(0);
    expect(up.polar).toBeLessThan(Math.PI);
    expect(down.polar).toBeGreaterThan(0);
    expect(down.polar).toBeLessThan(Math.PI);
  });

  it("pan 은 타깃을 이동시킨다", () => {
    const c = defaultCamera();
    const moved = pan(c, 50, 0);
    const shifted =
      moved.target[0] !== c.target[0] ||
      moved.target[1] !== c.target[1] ||
      moved.target[2] !== c.target[2];
    expect(shifted).toBe(true);
  });
});
