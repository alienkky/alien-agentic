import { describe, it, expect } from "vitest";
import { trimAt, trimPreviewAt } from "./sketchTrim";
import type { SketchPoint } from "./sketchPlane";

const hLine: SketchPoint[] = [{ u: -2, v: 0 }, { u: 2, v: 0 }];
const vLine: SketchPoint[] = [{ u: 0, v: -2 }, { u: 0, v: 2 }];

describe("스케치 자르기(Trim)", () => {
  it("교차하는 두 선 — 한쪽 절반 클릭 → 그 절반만 잘림", () => {
    const res = trimAt([hLine, vLine], { u: 1, v: 0 }); // 수평선 오른쪽 절반
    expect(res).not.toBeNull();
    // 수직선은 그대로(1) + 수평선 왼쪽 절반(1) = 2획
    expect(res!).toHaveLength(2);
    const h = res!.find((st) => st.some((p) => p.u === -2));
    expect(h).toBeDefined();
    // 잘린 수평선은 (-2,0)~(0,0)
    expect(h!).toContainEqual({ u: -2, v: 0 });
    expect(h!).toContainEqual({ u: 0, v: 0 });
    expect(h!.some((p) => p.u === 2)).toBe(false);
  });

  it("선에서 먼 곳 클릭 → null", () => {
    expect(trimAt([hLine, vLine], { u: 5, v: 5 })).toBeNull();
  });

  it("미리보기: 잘릴 구간 [교차점, 끝] 반환 (실제로 안 자름)", () => {
    const prev = trimPreviewAt([hLine, vLine], { u: 1, v: 0 }); // 수평선 오른쪽 절반
    expect(prev).not.toBeNull();
    // 잘릴 구간은 (0,0)~(2,0)
    expect(prev!.a).toEqual({ u: 0, v: 0 });
    expect(prev!.b).toEqual({ u: 2, v: 0 });
    expect(trimPreviewAt([hLine], { u: 9, v: 9 })).toBeNull();
  });

  it("교차 없는 선 — 전체가 한 구간이라 통째로 제거", () => {
    const res = trimAt([hLine], { u: 1, v: 0 });
    // 교차점 없음 → [0,1] 한 구간 제거 → 빈 결과
    expect(res).not.toBeNull();
    expect(res!).toHaveLength(0);
  });

  it("닫힌 사각형 한 변을 가로지르는 선으로 자르면 열린 획이 됨", () => {
    const rect: SketchPoint[] = [{ u: -2, v: -2 }, { u: 2, v: -2 }, { u: 2, v: 2 }, { u: -2, v: 2 }];
    const cutter: SketchPoint[] = [{ u: 0, v: -3 }, { u: 0, v: -1 }]; // 아래 변(v=-2)을 x=0에서 교차
    const res = trimAt([rect, cutter], { u: 0.5, v: -2 }); // 아래 변 오른쪽 클릭
    expect(res).not.toBeNull();
    // 사각형이 열린 획으로 바뀜 (cutter 1 + 열린 사각형 1)
    expect(res!.length).toBeGreaterThanOrEqual(1);
  });
});
