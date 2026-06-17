import { describe, it, expect } from "vitest";
import { defaultCamera, viewDirection, spinView, toCartesian } from "./cameraMath";
import { CUBE_FACES, CUBE_CORNERS, cubeTransform, cornerTransform, HALF } from "./navCubeData";

describe("네비큐브 — 면 클릭 → 시점 방향", () => {
  it("FRONT(+Z) → 카메라가 +Z 에서 정면을 본다", () => {
    const c = viewDirection(defaultCamera(), [0, 0, 1]);
    expect(c.azimuth).toBeCloseTo(0, 9);
    expect(c.polar).toBeCloseTo(Math.PI / 2, 9);
    const p = toCartesian(c);
    expect(p[2]).toBeGreaterThan(2); // +Z
    expect(Math.abs(p[1])).toBeLessThan(1e-6); // 수평
  });

  it("RIGHT(+X) → 카메라가 +X 쪽", () => {
    const c = viewDirection(defaultCamera(), [1, 0, 0]);
    expect(c.azimuth).toBeCloseTo(Math.PI / 2, 9);
    const p = toCartesian(c);
    expect(p[0]).toBeGreaterThan(2);
  });

  it("TOP(+Y) → 카메라가 위에서 내려다봄 (극각 클램프, azimuth 유지)", () => {
    const base = defaultCamera();
    const c = viewDirection(base, [0, 1, 0]);
    expect(c.polar).toBeGreaterThan(0); // 극에 닿지 않게 클램프
    expect(c.polar).toBeLessThan(0.1);
    expect(c.azimuth).toBe(base.azimuth); // 짐벌락 회피 — 방위 유지
    expect(toCartesian(c)[1]).toBeGreaterThan(2);
  });
});

describe("네비큐브 — 꼭짓점 클릭 → 아이소 시점", () => {
  it("(+,+,+) 꼭짓점 → polar≈54.7°, azimuth=45°", () => {
    const c = viewDirection(defaultCamera(), [1, 1, 1]);
    expect(c.azimuth).toBeCloseTo(Math.PI / 4, 6);
    expect(c.polar).toBeCloseTo(Math.acos(1 / Math.sqrt(3)), 6);
  });

  it("8 꼭짓점 모두 고유 방향 + 길이 정규화 무관", () => {
    expect(CUBE_CORNERS).toHaveLength(8);
    const ids = new Set(CUBE_CORNERS.map((k) => k.id));
    expect(ids.size).toBe(8);
  });
});

describe("네비큐브 — 화살표 90° 스핀", () => {
  it("left/right 는 방위각을 ∓90°, up/down 은 극각을 ∓90°", () => {
    const base = defaultCamera();
    expect(spinView(base, "left").azimuth).toBeCloseTo(base.azimuth - Math.PI / 2, 9);
    expect(spinView(base, "right").azimuth).toBeCloseTo(base.azimuth + Math.PI / 2, 9);
    expect(spinView(base, "up").polar).toBeLessThan(base.polar);
    expect(spinView(base, "down").polar).toBeGreaterThan(base.polar);
  });

  it("up 을 극까지 반복해도 클램프되어 뒤집히지 않는다", () => {
    let c = defaultCamera();
    for (let i = 0; i < 5; i++) c = spinView(c, "up");
    expect(c.polar).toBeGreaterThan(0);
    expect(c.polar).toBeLessThan(Math.PI);
  });
});

describe("네비큐브 — CSS 변환", () => {
  it("정면(A=0,P=90°)은 회전 0 → FRONT 면이 정면", () => {
    expect(cubeTransform(0, Math.PI / 2)).toBe("rotateX(0.000deg) rotateY(0.000deg)");
  });

  it("결정론적 — 같은 입력 같은 출력", () => {
    expect(cubeTransform(0.3, 1.1)).toBe(cubeTransform(0.3, 1.1));
  });

  it("6 면 데이터 무결 + 꼭짓점 변환은 ±HALF 격자", () => {
    expect(CUBE_FACES).toHaveLength(6);
    expect(cornerTransform([1, -1, 1])).toBe(`translate3d(${HALF}px, ${HALF}px, ${HALF}px)`);
  });
});
