import { describe, it, expect } from "vitest";
import type { TessellatedMesh } from "../types";
import { tessellateCylinder } from "./cylinderMesh";
import { tessellateSphere } from "./sphereMesh";

function assertMeshInvariants(mesh: TessellatedMesh): void {
  // 삼각형 수 == triFaceId 수
  expect(mesh.indices.length % 3).toBe(0);
  expect(mesh.triFaceId.length).toBe(mesh.indices.length / 3);

  // 인덱스가 정점 범위 안
  const vertCount = mesh.positions.length / 3;
  for (const idx of mesh.indices) expect(idx).toBeLessThan(vertCount);

  // faceRanges 가 indices 전체를 덮고, 각 삼각형 faceId 일치
  let covered = 0;
  for (const r of mesh.faceRanges) {
    covered += r.count;
    for (let i = r.start; i < r.start + r.count; i += 3) {
      expect(mesh.triFaceId[i / 3]).toBe(r.faceId);
    }
  }
  expect(covered).toBe(mesh.indices.length);

  // normals 길이 == positions 길이
  expect(mesh.normals.length).toBe(mesh.positions.length);
}

describe("tessellateCylinder", () => {
  const mesh = tessellateCylinder(2, 5, "cyl-1");
  it("메타데이터 불변식", () => assertMeshInvariants(mesh));
  it("면 3개(옆·위·아래)", () => {
    expect(mesh.faceRanges.map((r) => r.faceId).sort()).toEqual([0, 1, 2]);
  });
  it("모서리 2개(위·아래 원)", () => {
    expect(mesh.edges.length).toBe(2);
  });
});

describe("tessellateSphere", () => {
  const mesh = tessellateSphere(3, "sph-1");
  it("메타데이터 불변식", () => assertMeshInvariants(mesh));
  it("단일 면", () => {
    expect(mesh.faceRanges).toHaveLength(1);
    expect(mesh.faceRanges[0]?.faceId).toBe(0);
  });
  it("정점이 반지름 구면 위에 있다", () => {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i]!, y = mesh.positions[i + 1]!, z = mesh.positions[i + 2]!;
      expect(Math.hypot(x, y, z)).toBeCloseTo(3, 4);
    }
  });
});
