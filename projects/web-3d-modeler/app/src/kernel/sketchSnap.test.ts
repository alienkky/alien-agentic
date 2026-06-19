import { describe, it, expect } from "vitest";
import { snapCandidates, pickSnapPoint, snapToleranceWorld, type SnapCandidate } from "./sketchSnap";
import type { SketchPoint } from "./sketchPlane";

describe("snapCandidates", () => {
  it("닫힌 사각형: 정점 4 + 변 중점 4", () => {
    const rect: SketchPoint[] = [
      { u: 0, v: 0 }, { u: 4, v: 0 }, { u: 4, v: 2 }, { u: 0, v: 2 },
    ];
    const cands = snapCandidates([rect], []);
    const ends = cands.filter((c) => c.kind === "endpoint");
    const mids = cands.filter((c) => c.kind === "midpoint");
    expect(ends).toHaveLength(4);
    expect(mids).toHaveLength(4);
    // 닫는 변(마지막→처음)의 중점 포함
    expect(mids).toContainEqual({ u: 0, v: 1, kind: "midpoint" });
  });

  it("열린 폴리라인(점 2): 정점 2 + 변 중점 1", () => {
    const line: SketchPoint[] = [{ u: 0, v: 0 }, { u: 10, v: 0 }];
    const cands = snapCandidates([line], []);
    expect(cands.filter((c) => c.kind === "endpoint")).toHaveLength(2);
    const mids = cands.filter((c) => c.kind === "midpoint");
    expect(mids).toHaveLength(1);
    expect(mids[0]).toEqual({ u: 5, v: 0, kind: "midpoint" });
  });

  it("그리는 중 점들은 열린 폴리라인으로 후보화", () => {
    const cands = snapCandidates([], [{ u: 0, v: 0 }, { u: 2, v: 0 }]);
    expect(cands.filter((c) => c.kind === "endpoint")).toHaveLength(2);
    expect(cands.filter((c) => c.kind === "midpoint")).toEqual([{ u: 1, v: 0, kind: "midpoint" }]);
  });
});

describe("pickSnapPoint", () => {
  const cands: SnapCandidate[] = [
    { u: 0, v: 0, kind: "endpoint" },
    { u: 10, v: 0, kind: "endpoint" },
    { u: 5, v: 0, kind: "midpoint" },
  ];

  it("끝점 우선: 끝점과 중점이 모두 임계 내면 끝점으로 스냅", () => {
    // 커서를 끝점(0,0)에 더 가깝게: 끝점 거리 0.3, 중점 거리 4.7 — 둘 다 임계(5) 내
    const r = pickSnapPoint({ u: 0.3, v: 0 }, cands, 5);
    expect(r).toEqual({ u: 0, v: 0, kind: "endpoint" });
  });

  it("끝점 우선: 중점이 더 가까워도 임계 내 끝점이 있으면 끝점", () => {
    // 중점(5,0) 거리 0.2 < 끝점(10,0) 거리 4.8 이지만 끝점도 임계(5) 내 → 끝점
    const r = pickSnapPoint({ u: 5.2, v: 0 }, cands, 5);
    expect(r?.kind).toBe("endpoint");
    expect(r).toEqual({ u: 10, v: 0, kind: "endpoint" });
  });

  it("끝점이 임계 밖이고 중점만 임계 내면 중점으로 스냅", () => {
    const r = pickSnapPoint({ u: 5, v: 0.1 }, cands, 0.5);
    expect(r).toEqual({ u: 5, v: 0, kind: "midpoint" });
  });

  it("임계 밖 미스냅: 모든 후보가 임계를 넘으면 null", () => {
    const r = pickSnapPoint({ u: 5, v: 3 }, cands, 0.5);
    expect(r).toBeNull();
  });

  it("후보 없으면 null", () => {
    expect(pickSnapPoint({ u: 0, v: 0 }, [], 5)).toBeNull();
  });
});

describe("snapToleranceWorld", () => {
  it("터치가 마우스/펜보다 관대(임계가 큼)", () => {
    const r = 8;
    expect(snapToleranceWorld(r, "touch")).toBeGreaterThan(snapToleranceWorld(r, "mouse"));
    expect(snapToleranceWorld(r, "pen")).toBe(snapToleranceWorld(r, "mouse"));
  });

  it("하한 0.3 — 줌이 아주 가까워도 최소 임계 보장", () => {
    expect(snapToleranceWorld(0, "mouse")).toBe(0.3);
  });
});
