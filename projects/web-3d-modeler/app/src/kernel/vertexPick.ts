/**
 * 정점 픽킹 (순수) — 커서에 가장 가까운 기존 스케치 정점을 찾는다 (hover/grab 용).
 *
 * 스케치는 독립 폴리라인(SketchPoint[][])으로 저장되지만, 공유 코너는 한 점으로
 * 병합되어야 한다 (sketchConstraints.extractVertices 참조). 그래서 여기서도
 * extractVertices 를 내부에 써서 반환 인덱스가 공유 정점 모델과 일치하도록 한다.
 */
import { extractVertices } from "./sketchConstraints";
import type { SketchPoint } from "./sketchPlane";

/** Global vertex index (into extractVertices(strokes).pts) nearest to `target` within `tol`, else null.
 *  Ties → lowest index. Uses extractVertices internally so the returned index matches the shared-vertex model. */
export function nearestVertex(
  strokes: SketchPoint[][],
  target: SketchPoint,
  tol: number,
): number | null {
  const model = extractVertices(strokes);
  let best: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < model.pts.length; i++) {
    const p = model.pts[i]!;
    const d = Math.hypot(p.x - target.u, p.y - target.v);
    // tol 이내 + 더 가까울 때만 갱신 → 동률이면 먼저 만난 낮은 인덱스 유지
    if (d <= tol && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
