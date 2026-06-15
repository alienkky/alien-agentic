/**
 * 데모: 브래킷 — 이 세션에서 만든 도구만으로 처음부터 끝까지.
 *   1) 둥근 박스(모깎기) 베이스
 *   2) 볼트 구멍 2개 (원통 빼기)
 *   3) 가운데 보스 (원통 합치기)
 *   4) 중심 보어 (원통 빼기, 관통)
 * 곡면 공구 솔리드는 매니폴드 THREE 지오메트리. 모두 실제 커널(meshBoolean)로.
 */
import * as THREE from "three";
import type { TessellatedMesh } from "../kernel/types";
import { roundedBox } from "../kernel/roundedBox";
import { meshBoolean } from "../kernel/meshBoolean";
import { geometryToTessellated } from "../kernel/geometryToTessellated";

function cylinder(radius: number, height: number, ty: number, id: string): TessellatedMesh {
  const g = new THREE.CylinderGeometry(radius, radius, height, 40); // Y축
  g.translate(0, ty, 0);
  return geometryToTessellated(g, id);
}
function cylinderAt(radius: number, height: number, x: number, z: number, id: string): TessellatedMesh {
  const g = new THREE.CylinderGeometry(radius, radius, height, 32);
  g.translate(x, 0, z);
  return geometryToTessellated(g, id);
}

export function buildBracket(): { bracket: TessellatedMesh; steps: TessellatedMesh[] } {
  // 1) 둥근 박스 베이스 14 x 2 x 9 (y -1..1, 모서리 둥글게)
  const base = roundedBox(14, 2, 9, 0.7, "bracket-base");

  // 2) 볼트 구멍 2개 (관통)
  const h1 = meshBoolean(base, cylinderAt(1.1, 4, -4.5, 0, "hole-1"), "cut", "br-1");
  const h2 = meshBoolean(h1, cylinderAt(1.1, 4, 4.5, 0, "hole-2"), "cut", "br-2");

  // 3) 가운데 보스 (위로 솟게) 합치기
  const withBoss = meshBoolean(h2, cylinder(2.4, 3.6, 1.6, "boss"), "fuse", "br-3");

  // 4) 중심 보어 (관통)
  const bracket = meshBoolean(withBoss, cylinder(1.1, 9, 0, "bore"), "cut", "bracket");

  return { bracket, steps: [base, h2, withBoss, bracket] };
}
