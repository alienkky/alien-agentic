import { describe, it, expect } from "vitest";
import { alignToNormal, toCartesian, defaultCamera } from "./cameraMath";

describe("카메라 면 법선 정렬", () => {
  it("+Y 법선 → 카메라가 위에서 내려다봄 (target=면 중심)", () => {
    const c = alignToNormal(defaultCamera(), [0, 1, 0], [1, 2, 3]);
    expect(c.target).toEqual([1, 2, 3]);
    const pos = toCartesian(c);
    // 카메라는 면 위쪽(+Y)에 위치
    expect(pos[1]).toBeGreaterThan(c.target[1]);
  });

  it("+X 법선 → 카메라가 +X 쪽에 위치", () => {
    const c = alignToNormal(defaultCamera(), [1, 0, 0], [0, 0, 0]);
    const pos = toCartesian(c);
    expect(pos[0]).toBeGreaterThan(2); // +X 방향
    expect(Math.abs(pos[1])).toBeLessThan(1); // 수평
  });
});
