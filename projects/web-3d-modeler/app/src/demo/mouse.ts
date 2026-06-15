/**
 * 데모: 컴퓨터 마우스 — 우리가 만든 스케치→돌출→불리언 파이프라인만으로 모델링.
 *
 * 파이프라인 증명용. 사람이 GUI 에서 하는 것과 동일한 순서를 코드로 재현한다:
 *   1) 타원 스케치(평면 xz, 위에서 본 마우스 윤곽) → 돌출 → 기둥 몸체
 *   2) 큰 구와 교집합(common) → 윗면을 부드럽게 돔(dome)형으로 깎음
 *   3) 얇은 박스 빼기(cut) → 앞쪽 스크롤 휠 슬롯
 *   4) 얇고 긴 박스 빼기(cut) → 좌/우 버튼 분리 홈
 *
 * 곡면 공구 솔리드(구·실린더)는 매니폴드한 THREE 지오메트리로 만든다 — 손수 짠
 * UV 구는 극점 부채꼴·이음새 때문에 CSG(three-bvh-csg)가 처리하지 못한다. (교훈)
 */
import * as THREE from "three";
import type { TessellatedMesh } from "../kernel/types";
import { extrudeProfile } from "../kernel/extrude";
import { meshBoolean } from "../kernel/meshBoolean";
import { geometryToTessellated } from "../kernel/geometryToTessellated";
import { SKETCH_PLANES, type SketchPoint } from "../kernel/sketchPlane";
import { ellipsePolygon } from "../store/useAppStore";

/** 위치를 미리 옮긴 THREE 지오메트리 → 테셀레이션 공구 솔리드. */
function tool(geo: THREE.BufferGeometry, dx: number, dy: number, dz: number, id: string): TessellatedMesh {
  geo.translate(dx, dy, dz);
  return geometryToTessellated(geo, id);
}

/** 마우스 한 대를 만든다. 단계별 중간 산출물도 함께 돌려준다(검증·시각화용). */
export function buildMouse(): { mouse: TessellatedMesh; steps: TessellatedMesh[] } {
  // 1) 타원 윤곽 (xz 평면, u=x=길이방향, v=z=폭방향). 중심 원점.
  const outline: SketchPoint[] = ellipsePolygon({ u: 0, v: 0 }, 6.3, 4, 64);
  const body = extrudeProfile(outline, SKETCH_PLANES.xz, 4, "mouse-body"); // y: 0..4

  // 2) 구와 교집합 → 윗면 도밍. 구는 바닥을 완전히 품도록 충분히 크고 살짝 아래.
  //    (바닥 전체가 구 안 → 평평한 바닥 유지, 윗면 가장자리만 둥글게)
  const dome = tool(new THREE.SphereGeometry(9, 56, 40), 0, -3, 0, "mouse-dome");
  const domed = meshBoolean(body, dome, "common", "mouse-domed");

  // 3) 앞쪽 스크롤 휠 슬롯 (얇은 박스 빼기). 앞 = +x.
  const wheelSlot = tool(new THREE.BoxGeometry(0.9, 2, 1.0), 3.5, 3.5, 0, "mouse-wheel-slot");
  const slotted = meshBoolean(domed, wheelSlot, "cut", "mouse-slotted");

  // 4) 좌/우 버튼 분리 홈 (앞쪽 중앙선을 따라 얕게 빼기).
  const buttonGroove = tool(new THREE.BoxGeometry(4.5, 1.5, 0.22), 2.75, 3.6, 0, "mouse-button-groove");
  const mouse = meshBoolean(slotted, buttonGroove, "cut", "mouse");

  return { mouse, steps: [body, domed, slotted, mouse] };
}
