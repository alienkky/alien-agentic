/**
 * 둥근 박스 — 모서리가 둥근 박스 솔리드 (모깎기된 박스).
 *
 * 정직한 범위: 임의 바디의 *임의 모서리* 모깎기/모따기는 진짜 B-rep(OCCT)이 필요하다
 * (메시에서 일반 fillet 은 위상 재구성이라 깨지기 쉽다). 여기서는 가장 흔하고 견고한
 * 케이스 — "둥근 모서리 박스"를 매니폴드 지오메트리로 정확히 만든다.
 */
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { TessellatedMesh } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";

export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  shapeId: string,
  segments = 4,
): TessellatedMesh {
  // radius 는 최소 변의 절반 미만이어야 깨지지 않는다
  const maxR = Math.min(width, height, depth) / 2 - 1e-3;
  const r = Math.max(0.01, Math.min(radius, maxR));
  const geo = new RoundedBoxGeometry(width, height, depth, segments, r);
  geo.computeVertexNormals();
  return geometryToTessellated(geo, shapeId);
}
