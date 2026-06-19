import type { SketchPoint } from "../kernel/sketchPlane";
import { extractVertices } from "../kernel/sketchConstraints";

export interface VertexHandle {
  index: number;
  at: SketchPoint;
  hovered: boolean;
  dragging: boolean;
}

/** 스케치의 고유 정점마다 핸들 하나. hovered/dragging 은 매칭되는 전역 인덱스에만 켜진다 (-1/null = 없음). */
export function computeVertexHandles(
  strokes: SketchPoint[][],
  hoveredVertex: number | null,
  draggingVertex: number | null,
): VertexHandle[] {
  const model = extractVertices(strokes);
  return model.pts.map((p, i) => ({
    index: i,
    at: { u: p.x, v: p.y },
    hovered: i === hoveredVertex,
    dragging: i === draggingVertex,
  }));
}
