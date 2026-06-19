import { describe, it, expect } from "vitest";
import { nearestVertex } from "./vertexPick";
import { extractVertices } from "./sketchConstraints";
import type { SketchPoint } from "./sketchPlane";

const sp = (u: number, v: number): SketchPoint => ({ u, v });

describe("nearestVertex", () => {
  it("정점 위에 정확히 찍으면 그 정점 인덱스를 반환한다", () => {
    const strokes: SketchPoint[][] = [[sp(0, 0), sp(10, 0), sp(10, 10)]];
    // pts[1] = {x:10, y:0}
    expect(nearestVertex(strokes, sp(10, 0), 1)).toBe(1);
  });

  it("두 스트로크가 공유하는 코너 근처면 공유 전역 인덱스를 반환한다", () => {
    // 두 스트로크가 (10,10) 코너를 공유 (MERGE_TOL=0.6 이내로 병합)
    const strokes: SketchPoint[][] = [
      [sp(0, 0), sp(10, 10)],
      [sp(10.1, 10.1), sp(20, 0)],
    ];
    const model = extractVertices(strokes);
    // 첫 스트로크의 (10,10) 이 전역 인덱스 1, 둘째 스트로크 첫 점이 거기에 병합됨
    const shared = model.map[0]![1]!;
    expect(model.map[1]![0]!).toBe(shared); // 정말 공유되는지 확인
    // 커서를 공유 코너 근처에 두면 그 공유 인덱스를 픽
    const idx = nearestVertex(strokes, sp(10.05, 10.05), 0.5);
    expect(idx).toBe(shared);
  });

  it("모든 정점에서 tol 보다 멀면 null", () => {
    const strokes: SketchPoint[][] = [[sp(0, 0), sp(10, 0)]];
    expect(nearestVertex(strokes, sp(100, 100), 1)).toBeNull();
  });

  it("가장 가까운 정점을 고르고, 동률이면 낮은 인덱스를 고른다", () => {
    // pts[0]={0,0} pts[1]={10,0} (중간 정점 없음)
    const strokes: SketchPoint[][] = [[sp(0, 0), sp(10, 0)]];
    // 타겟 (8,0): pts[1] 거리 2, pts[0] 거리 8 → 가장 가까운 pts[1]
    expect(nearestVertex(strokes, sp(8, 0), 9)).toBe(1);
    // 동률: 타겟 (5,0) 에서 pts[0] 와 pts[1] 모두 거리 5 → 낮은 인덱스 0
    expect(nearestVertex(strokes, sp(5, 0), 5)).toBe(0);
  });

  it("빈 스트로크는 null", () => {
    expect(nearestVertex([], sp(0, 0), 1)).toBeNull();
    expect(nearestVertex([[]], sp(0, 0), 1)).toBeNull();
  });
});
