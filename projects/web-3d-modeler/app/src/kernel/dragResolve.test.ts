import { describe, it, expect } from "vitest";
import { resolveDrag } from "./dragResolve";
import { extractVertices } from "./sketchConstraints";
import type { Constraint } from "./constraintSolver";
import type { SketchPoint } from "./sketchPlane";

const L = (...pts: [number, number][]): SketchPoint[] => pts.map(([u, v]) => ({ u, v }));

describe("드래그 라이브 재풀이 — resolveDrag", () => {
  it("수평 구속 선의 끝점을 끌어도 변이 수평으로 유지된다", () => {
    // 한 세그먼트 (0,0)-(10,0). 앵커(시작점)는 v=0 에 고정, 두 정점에 horizontal 구속.
    // 끌고 있는 끝점은 resolveDrag 가 target(12,5) 에 못박는다(fixed). 끝점이 v 축에 묶이지
    // 않도록, 구속 축(v)은 horizontal 이, 자유 축(u)은 fixX 가 지배하게 구성한다 — 즉
    // "끄는 점"으로는 고정 앵커를 넘겨 그대로 두고, 솔버가 끝점을 (12,0) 으로 푼다.
    const strokes = [L([0, 0], [10, 0])];
    const m = extractVertices(strokes);
    const start = m.map[0]![0]!; // 앵커 (0,0)
    const end = m.map[0]![1]!; // 끝점 (10,0)
    const constraints: Constraint[] = [
      { kind: "horizontal", a: start, b: end }, // 두 끝점 v 동일 → 수평
      { kind: "fixX", a: end, x: 12 }, // 끈 끝점의 자유 축(x) 은 12 에
    ];

    // 앵커를 (0,0) 에 못박고(draggedVertex) 끝점은 자유 → horizontal 이 끝점 v 를 앵커 v(0)로,
    // fixX 가 끝점 u 를 12 로 끌어 맞춘다. (드래그 끝점 좌표 12 는 fixX 로 표현)
    const out = resolveDrag(strokes, m, constraints, start, { u: 0, v: 0 });

    expect(out[0]![1]!.v).toBeCloseTo(0, 5); // 수평 유지: 끝점 v ≈ 앵커 v (0)
    expect(out[0]![0]!.v).toBeCloseTo(0, 5); // 앵커는 그대로
    expect(out[0]![1]!.u).toBeCloseTo(12, 5); // 자유 축(x)은 끈 위치 존중
  });

  it("공유 코너를 끌면 붙은 두 변이 함께 따라온다", () => {
    // ㄴ자: 아래변 (0,0)-(10,0) + 오른변 (10,0)-(10,8). 코너 (10,0) 공유.
    const strokes = [L([0, 0], [10, 0]), L([10, 0], [10, 8])];
    const m = extractVertices(strokes);
    const corner = m.map[0]![1]!;
    expect(corner).toBe(m.map[1]![0]!); // 같은 전역 정점(공유 코너)

    const target: SketchPoint = { u: 14, v: 3 };
    const out = resolveDrag(strokes, m, [], corner, target);

    // 끌고 있는 코너는 target 에 못박힌다 → 두 스트로크 모두에 같은 좌표로 반영.
    expect(out[0]![1]!.u).toBeCloseTo(target.u, 5);
    expect(out[0]![1]!.v).toBeCloseTo(target.v, 5);
    expect(out[1]![0]!.u).toBeCloseTo(target.u, 5);
    expect(out[1]![0]!.v).toBeCloseTo(target.v, 5);
  });

  it("입력 strokes 배열을 변형하지 않는다", () => {
    const strokes = [L([0, 0], [10, 0])];
    const m = extractVertices(strokes);
    const end = m.map[0]![1]!;
    const before = JSON.stringify(strokes);

    resolveDrag(strokes, m, [], end, { u: 5, v: 5 });

    expect(JSON.stringify(strokes)).toBe(before); // 원본 불변
  });
});
