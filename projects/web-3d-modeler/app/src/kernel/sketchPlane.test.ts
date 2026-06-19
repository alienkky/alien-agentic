/**
 * 면 위 스케치(슬라이스 5) 평면 변환 단위테스트.
 *  1) planeFromFace — 면 법선/원점/직교 basis 생성 (면 법선 평면)
 *  2) worldToPlane ↔ planeToWorld — (u,v)↔world 좌표 왕복
 */
import { describe, it, expect } from "vitest";
import { planeFromFace, worldToPlane, planeToWorld, SKETCH_PLANES, type SketchPlaneDef } from "./sketchPlane";

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

describe("sketchPlane — 면 법선 평면(planeFromFace)", () => {
  it("기울어진 면의 정점/법선에서 정규직교 평면을 만든다", () => {
    // 법선 (0,1,1) 방향의 정사각형 면 정점 4개 (origin 중심 = (1,1,1))
    const normal: V3 = [0, 1, 1];
    const verts = [
      0, 1, 1,
      2, 1, 1,
      2, 1, 1, // 중복 정점도 centroid 평균에 그대로 반영
      0, 1, 1,
    ];
    const plane = planeFromFace(verts, normal, "face-test");

    // 법선은 정규화됨
    expect(len(plane.normal)).toBeCloseTo(1, 6);
    expect(plane.normal[0]).toBeCloseTo(0, 6);
    expect(plane.normal[1]).toBeCloseTo(1 / Math.SQRT2, 6);
    expect(plane.normal[2]).toBeCloseTo(1 / Math.SQRT2, 6);

    // u, v 단위벡터 + 서로/법선에 직교
    expect(len(plane.u as V3)).toBeCloseTo(1, 6);
    expect(len(plane.v as V3)).toBeCloseTo(1, 6);
    expect(dot(plane.u as V3, plane.v as V3)).toBeCloseTo(0, 6);
    expect(dot(plane.u as V3, plane.normal as V3)).toBeCloseTo(0, 6);
    expect(dot(plane.v as V3, plane.normal as V3)).toBeCloseTo(0, 6);

    // origin = 정점 centroid (1,1,1)
    expect(plane.origin[0]).toBeCloseTo(1, 6);
    expect(plane.origin[1]).toBeCloseTo(1, 6);
    expect(plane.origin[2]).toBeCloseTo(1, 6);
  });

  it("법선이 world Y와 거의 평행하면 특이점 없이 직교 basis 유지", () => {
    const plane = planeFromFace([0, 2, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1], [0, 1, 0], "face-top");
    expect(plane.normal[1]).toBeCloseTo(1, 6);
    // u, v 가 0벡터가 아니고 법선과 직교
    expect(len(plane.u as V3)).toBeCloseTo(1, 6);
    expect(len(plane.v as V3)).toBeCloseTo(1, 6);
    expect(dot(plane.u as V3, plane.normal as V3)).toBeCloseTo(0, 6);
    expect(dot(plane.v as V3, plane.normal as V3)).toBeCloseTo(0, 6);
  });
});

describe("sketchPlane — 좌표 왕복(worldToPlane ↔ planeToWorld)", () => {
  const cases: Array<[string, SketchPlaneDef]> = [
    ["XZ 기준면", SKETCH_PLANES.xz],
    ["XY 기준면", SKETCH_PLANES.xy],
    ["YZ 기준면", SKETCH_PLANES.yz],
    ["기울어진 면 평면", planeFromFace([0, 1, 1, 2, 1, 1, 2, 1, 3, 0, 1, 3], [0, 1, 1], "face-tilt")],
  ];

  for (const [label, plane] of cases) {
    it(`${label}: (u,v) → world → (u,v) 가 보존된다`, () => {
      for (const [u, v] of [[0, 0], [1.5, -2.25], [-3, 4], [10.125, 7.5]] as Array<[number, number]>) {
        const [wx, wy, wz] = planeToWorld(plane, u, v);
        const back = worldToPlane(plane, wx, wy, wz);
        expect(back.u).toBeCloseTo(u, 6);
        expect(back.v).toBeCloseTo(v, 6);
      }
    });

    it(`${label}: 평면 위 world 점 → (u,v) → world 가 보존된다`, () => {
      // 평면 위의 점만 왕복 보존 (법선 성분은 변환에서 소실되므로)
      const onPlane = planeToWorld(plane, 2.5, -1.75);
      const uv = worldToPlane(plane, onPlane[0], onPlane[1], onPlane[2]);
      const round = planeToWorld(plane, uv.u, uv.v);
      expect(round[0]).toBeCloseTo(onPlane[0], 6);
      expect(round[1]).toBeCloseTo(onPlane[1], 6);
      expect(round[2]).toBeCloseTo(onPlane[2], 6);
    });
  }
});
