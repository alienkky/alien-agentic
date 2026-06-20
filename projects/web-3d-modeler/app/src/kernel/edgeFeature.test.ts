import { describe, it, expect } from "vitest";
import { validateEdgeFeature, resolveEdgeIds, faceCount } from "./edgeFeature";
import { tessellateBox } from "./occt/boxMesh";
import type { TessellatedMesh, FaceRange } from "./types";

describe("모서리 피처 — FAST(메시) 거부", () => {
  it("FAST 백엔드에서 필렛은 OCCT 안내와 함께 거부된다", () => {
    expect(() => validateEdgeFeature("deterministic", "fillet", [0, 1], 0.5)).toThrow(/OCCT/);
  });

  it("FAST 백엔드에서 모따기도 거부된다", () => {
    expect(() => validateEdgeFeature("deterministic", "chamfer", [0], 0.5)).toThrow(/OCCT/);
  });

  it("OCCT 백엔드 + 유효 입력은 통과한다 (throw 없음)", () => {
    expect(() => validateEdgeFeature("occt", "fillet", [0], 0.5)).not.toThrow();
  });

  it("모서리 0개 / 값 ≤ 0 은 OCCT 라도 거부된다", () => {
    expect(() => validateEdgeFeature("occt", "fillet", [], 0.5)).toThrow(/모서리/);
    expect(() => validateEdgeFeature("occt", "fillet", [0], 0)).toThrow(/0보다/);
    expect(() => validateEdgeFeature("occt", "chamfer", [0], -1)).toThrow(/0보다/);
  });
});

describe("모서리 피처 — 반지름 적용 면수 증가 불변식", () => {
  // 실제 BRepFilletAPI 기하는 OCCT(WASM) 전용이라 헤드리스에서 못 돈다(디바이스 게이트).
  // 여기서는 우리 책임인 결정론 로직만 검증한다:
  //  (1) 박스의 면/모서리 토대(필렛이 깎아 들어갈 대상)
  //  (2) 선택 edgeId → 실제 모서리 해석
  //  (3) 필렛으로 둥근 면이 추가되면 faceCount 가 증가한다는 불변식
  const box = tessellateBox(4, 4, 4, "box-1");

  it("박스는 6면 12모서리 — 필렛 대상 토대", () => {
    expect(faceCount(box)).toBe(6);
    expect(box.edges.length).toBe(12);
  });

  it("선택 edgeId 가 모서리 개수 범위로 정규화된다 (중복·범위밖 제거)", () => {
    expect(resolveEdgeIds(box.edges.length, [11, 0, 0, 3])).toEqual([0, 3, 11]);
    // 범위 밖(99)·음수는 버려진다
    expect(resolveEdgeIds(box.edges.length, [99, -1, 5])).toEqual([5]);
  });

  it("유효 모서리가 하나도 없으면 거부", () => {
    expect(() => resolveEdgeIds(box.edges.length, [99, 100])).toThrow(/유효한 모서리/);
  });

  it("모서리 1개 필렛 → 둥근 면 1개 추가 시 면수가 증가한다", () => {
    // 필렛이 모서리 하나를 둥글린 결과(둥근 면 +1)를 모사한 재테셀레이션 산출물.
    const rounded = box.faceRanges[0]!;
    const newFace: FaceRange = { faceId: 6, start: box.indices.length, count: rounded.count };
    const filleted: TessellatedMesh = { ...box, faceRanges: [...box.faceRanges, newFace] };
    expect(faceCount(filleted)).toBeGreaterThan(faceCount(box));
    expect(faceCount(filleted)).toBe(7);
  });
});
