import type { Pt } from "./constraintSolver";
import { solveConstraints } from "./constraintSolver";
import { extractVertices, applyToStrokes } from "./sketchConstraints";
import {
  type SegRef,
  segVerts,
  buildParallel,
  buildPerpendicular,
  buildCoincidentStarts,
} from "./constraintsMulti";
import type { SketchPoint } from "./sketchPlane";

export type MultiConstraintKind = "parallel" | "perpendicular" | "coincident";

/**
 * Build the constraint between segA (anchor) and segB, fix BOTH of segA's vertices,
 * solve, and return new strokes. Returns null if the segment refs are invalid or the
 * builder returns null. Does not mutate inputs.
 */
export function solveMultiConstraint(
  strokes: SketchPoint[][],
  segA: SegRef,
  segB: SegRef,
  kind: MultiConstraintKind,
): SketchPoint[][] | null {
  const model = extractVertices(strokes);

  const builder =
    kind === "parallel"
      ? buildParallel
      : kind === "perpendicular"
        ? buildPerpendicular
        : buildCoincidentStarts;

  const constraints = builder(model, segA, segB);
  if (!constraints) return null;

  const anchor = segVerts(model, segA);
  if (!anchor) return null;

  const pts: Pt[] = model.pts.map((p, i) => ({
    ...p,
    fixed: i === anchor[0] || i === anchor[1] ? true : p.fixed,
  }));

  const solved = solveConstraints(pts, constraints);
  return applyToStrokes(strokes, model, solved.points);
}
