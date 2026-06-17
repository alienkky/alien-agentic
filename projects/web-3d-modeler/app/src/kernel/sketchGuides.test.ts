import { describe, it, expect } from "vitest";
import { snapToGuides } from "./sketchGuides";
import type { SketchPoint } from "./sketchPlane";

const anchors: SketchPoint[] = [{ u: 0, v: 0 }, { u: 5, v: 2 }];

describe("스케치 안내선 스냅", () => {
  it("앵커 근처 → 끝점 스냅 (안내선 없음)", () => {
    const r = snapToGuides({ u: 5.1, v: 1.95 }, anchors, 0.4, 0.5);
    expect(r.snapped).toEqual({ u: 5, v: 2 });
    expect(r.guides).toHaveLength(0);
  });

  it("수직 정렬: u 가 앵커와 같아지고 v 안내선", () => {
    const r = snapToGuides({ u: 5.05, v: 8 }, anchors, 0.4, 0.5);
    expect(r.snapped.u).toBe(5); // 앵커(5,2) 의 u 로 정렬
    expect(r.guides.some((g) => g.kind === "v")).toBe(true);
  });

  it("수평 정렬: v 가 앵커와 같아지고 h 안내선", () => {
    const r = snapToGuides({ u: 9, v: 0.05 }, anchors, 0.4, 0.5);
    expect(r.snapped.v).toBe(0); // 앵커(0,0) 의 v
    expect(r.guides.some((g) => g.kind === "h")).toBe(true);
  });

  it("정렬 없으면 격자 스냅", () => {
    const r = snapToGuides({ u: 3.3, v: 7.1 }, anchors, 0.4, 0.5);
    expect(r.snapped).toEqual({ u: 3.5, v: 7 });
    expect(r.guides).toHaveLength(0);
  });
});
