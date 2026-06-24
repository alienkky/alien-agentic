import { describe, it, expect } from "vitest";
import {
  facePlane,
  isFacePlanar,
  validateFacePushPull,
  meshFacePushPull,
  meshVolume,
} from "./facePushPull";
import { tessellateBox } from "./occt/boxMesh";
import { tessellateSphere } from "./occt/sphereMesh";

describe("면 Push/Pull — 평면 판정", () => {
  const box = tessellateBox(4, 4, 4, "box-1");
  const sphere = tessellateSphere(2.5, "sphere-1");

  it("박스의 모든 면은 평면이다", () => {
    for (const r of box.faceRanges) {
      expect(isFacePlanar(box, r.faceId)).toBe(true);
    }
  });

  it("구의 면은 비평면(곡면)이다", () => {
    expect(isFacePlanar(sphere, 0)).toBe(false);
  });

  it("면 평면 — 원점·법선이 나온다 (+Z 면 = faceId 4)", () => {
    const plane = facePlane(box, 4);
    expect(plane).not.toBeNull();
    expect(plane!.normal[2]).toBeCloseTo(1, 6);
    expect(plane!.origin[2]).toBeCloseTo(2, 6); // 박스 절반 깊이
  });
});

describe("면 Push/Pull — 입력 검증", () => {
  const box = tessellateBox(4, 4, 4, "box-1");
  const sphere = tessellateSphere(2.5, "sphere-1");

  it("비평면(곡면) 면은 거부된다", () => {
    expect(() => validateFacePushPull(sphere, 0, 1)).toThrow(/비평면/);
  });

  it("거리 0 은 거부된다", () => {
    expect(() => validateFacePushPull(box, 4, 0)).toThrow(/0이 아니어야/);
  });

  it("존재하지 않는 면은 거부된다", () => {
    expect(() => validateFacePushPull(box, 99, 1)).toThrow(/찾을 수 없/);
  });

  it("평면 면 + 유효 거리는 통과한다", () => {
    expect(() => validateFacePushPull(box, 4, 2)).not.toThrow();
    expect(() => validateFacePushPull(box, 4, -1)).not.toThrow();
  });
});

describe("면 Push/Pull — 오프셋 부피 불변식", () => {
  const box = tessellateBox(4, 4, 4, "box-1"); // 부피 64

  it("+Z 면을 당기면(+) 부피가 증가한다", () => {
    const before = meshVolume(box);
    expect(before).toBeCloseTo(64, 4);
    const pulled = meshFacePushPull(box, 4, 2, "box-2"); // 4×4×6 = 96
    const after = meshVolume(pulled);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeCloseTo(96, 3);
  });

  it("+Z 면을 밀면(−) 부피가 감소한다", () => {
    const pushed = meshFacePushPull(box, 4, -1, "box-3"); // 4×4×3 = 48
    expect(meshVolume(pushed)).toBeCloseTo(48, 3);
  });

  it("변형 후 faceId/edgeId 토폴로지가 보존된다 (재발급 일관성)", () => {
    const out = meshFacePushPull(box, 4, 2, "box-4");
    expect(out.faceRanges.map((r) => r.faceId)).toEqual(box.faceRanges.map((r) => r.faceId));
    expect(out.edges.map((e) => e.edgeId)).toEqual(box.edges.map((e) => e.edgeId));
    expect(out.indices).toEqual(box.indices); // 위상 동일, 좌표만 변함
    expect(out.shapeId).toBe("box-4");
  });

  it("원본 메시는 변형되지 않는다 (불변)", () => {
    const snapshot = Float32Array.from(box.positions);
    meshFacePushPull(box, 4, 2, "box-5");
    expect(box.positions).toEqual(snapshot);
  });
});
