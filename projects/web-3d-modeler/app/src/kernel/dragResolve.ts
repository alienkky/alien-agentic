/**
 * 드래그 라이브 재풀이 (순수 코어).
 *
 * Shapr3D 식 파라메트릭 스케치에서 한 정점을 끌면, 영구 구속(수평/수직/공유코너 등)이
 * 유지된 채 나머지 정점이 따라 움직여야 한다. 이 모듈은 그 한 프레임의 재풀이를 담당한다:
 * 끌고 있는 전역 정점을 target 위치에 고정(fixed)으로 박고, 이미 고정된 점은 그대로 두고,
 * 나머지 비고정 점은 자유 변수로 둔 채 solveConstraints 로 동시에 만족시킨 뒤 스트로크에 되쓴다.
 */
import { solveConstraints, type Pt, type Constraint } from "./constraintSolver";
import { applyToStrokes, type VertexModel } from "./sketchConstraints";
import type { SketchPoint } from "./sketchPlane";

/**
 * Live re-solve while dragging one vertex. The dragged global vertex is pinned to `target`
 * (treated as fixed at the target position); all other non-fixed vertices are free; the given
 * permanent constraints are satisfied via solveConstraints. Returns new strokes.
 */
export function resolveDrag(
  strokes: SketchPoint[][],
  model: VertexModel,
  constraints: Constraint[],
  draggedVertex: number,
  target: SketchPoint,
): SketchPoint[][] {
  // 입력 불변 — pts 를 복사한다. 이미 fixed 인 점은 그대로 고정 유지.
  const pts: Pt[] = model.pts.map((p, i) =>
    i === draggedVertex
      ? { x: target.u, y: target.v, fixed: true } // 끌고 있는 정점은 target 에 못박는다
      : { ...p },
  );
  const res = solveConstraints(pts, constraints);
  return applyToStrokes(strokes, model, res.points);
}
