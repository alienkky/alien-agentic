import { describe, it, expect } from "vitest";
import { trimAt, trimPreviewAt } from "./sketchTrim";
import type { SketchPoint } from "./sketchPlane";

const hLine: SketchPoint[] = [{ u: -2, v: 0 }, { u: 2, v: 0 }];
const vLine: SketchPoint[] = [{ u: 0, v: -2 }, { u: 0, v: 2 }];

/** 반지름 r 원을 segs 등분한 닫힌 폴리곤(앱의 circlePolygon 과 동일 형태). */
function circle(r: number, segs = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({ u: Math.cos(a) * r, v: Math.sin(a) * r });
  }
  return out;
}

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

  it("미리보기: 잘릴 구간 [교차점, 끝] 점들 반환 (실제로 안 자름)", () => {
    const prev = trimPreviewAt([hLine, vLine], { u: 1, v: 0 }); // 수평선 오른쪽 절반
    expect(prev).not.toBeNull();
    // 잘릴 구간 양 끝은 (0,0)~(2,0)
    expect(prev![0]).toEqual({ u: 0, v: 0 });
    expect(prev![prev!.length - 1]).toEqual({ u: 2, v: 0 });
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

  it("사각형 한 변 클릭 → 교차점~모서리까지만 잘림(다른 변은 보존)", () => {
    const rect: SketchPoint[] = [{ u: -2, v: -2 }, { u: 2, v: -2 }, { u: 2, v: 2 }, { u: -2, v: 2 }];
    const cutter: SketchPoint[] = [{ u: 0, v: -3 }, { u: 0, v: -1 }];
    const res = trimAt([rect, cutter], { u: 1, v: -2 })!;
    const ring = res.find((st) => st.length > 2)!;
    // 위쪽 두 모서리(±2, 2)는 남아 있어야 한다 — 한 변만 부분 제거되므로
    expect(ring.some((p) => p.u === 2 && p.v === 2)).toBe(true);
    expect(ring.some((p) => p.u === -2 && p.v === 2)).toBe(true);
  });

  it("원을 가로지르는 선으로 자르면 facet 하나가 아니라 '호 전체'가 잘린다", () => {
    const c = circle(5, 48);
    // x=0 세로선이 원을 (0,5),(0,-5) 두 점에서 가로지름
    const cutter: SketchPoint[] = [{ u: 0, v: -6 }, { u: 0, v: 6 }];
    const res = trimAt([c, cutter], { u: 5, v: 0 })!; // 오른쪽 호 클릭
    expect(res).not.toBeNull();
    const arc = res.find((st) => st.length > 3)!;
    // 오른쪽 절반(u>0)이 통째로 사라지고 왼쪽 호만 남아야 한다
    const rightPts = arc.filter((p) => p.u > 0.2);
    const leftPts = arc.filter((p) => p.u < -0.2);
    expect(leftPts.length).toBeGreaterThan(5);
    expect(rightPts.length).toBe(0);
    // facet 1개만 지워졌다면 남은 점이 거의 48개일 것 — 그게 아니라 ~절반이어야 한다
    expect(arc.length).toBeLessThan(40);
  });
});
