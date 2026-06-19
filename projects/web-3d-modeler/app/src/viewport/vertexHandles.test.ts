import { describe, it, expect } from "vitest";
import type { SketchPoint } from "../kernel/sketchPlane";
import { computeVertexHandles } from "./vertexHandles";

const sp = (u: number, v: number): SketchPoint => ({ u, v });

const lShape: SketchPoint[][] = [
  [sp(0, 0), sp(10, 0)],
  [sp(10, 0), sp(10, 10)],
];

describe("computeVertexHandles", () => {
  it("병합된 고유 정점 수만큼 핸들을 만든다 (코너 공유 L자 → 4 아닌 3)", () => {
    const handles = computeVertexHandles(lShape, null, null);
    expect(handles).toHaveLength(3);
  });

  it("핸들 위치가 정점 uv 좌표와 일치한다", () => {
    const handles = computeVertexHandles(lShape, null, null);
    expect(handles[0]!.at).toEqual({ u: 0, v: 0 });
    expect(handles[1]!.at).toEqual({ u: 10, v: 0 });
    expect(handles[2]!.at).toEqual({ u: 10, v: 10 });
    expect(handles.map((h) => h.index)).toEqual([0, 1, 2]);
  });

  it("hovered 플래그가 해당 인덱스에만 켜지고 null 이면 아무도 안 켜진다", () => {
    const hovered = computeVertexHandles(lShape, 1, null);
    expect(hovered.map((h) => h.hovered)).toEqual([false, true, false]);

    const none = computeVertexHandles(lShape, null, null);
    expect(none.every((h) => !h.hovered)).toBe(true);
  });

  it("dragging 플래그가 해당 인덱스에만 켜진다", () => {
    const dragging = computeVertexHandles(lShape, null, 2);
    expect(dragging.map((h) => h.dragging)).toEqual([false, false, true]);
    expect(dragging.every((h) => !h.hovered)).toBe(true);
  });
});
