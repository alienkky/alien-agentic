/**
 * 스케치 ↔ 구속 솔버 브릿지 (순수).
 *
 * 스케치는 독립 폴리라인(SketchPoint[][]) 으로 저장된다 — 공유 정점 개념이 없다.
 * Shapr3D 식 파라메트릭 구속의 핵심은 **공유 코너**다: 가까운 정점들을 한 점으로 합쳐
 * 솔버에 넘기면, 한 변을 수평으로 펴도 그 코너에 붙은 다른 변이 함께 따라온다.
 *
 * 이 모듈이 하는 일:
 *  1. extractVertices — 모든 스트로크 정점을 tol 이내로 병합해 공유 정점 그래프 생성
 *  2. buildSegmentSolve — 선택 세그먼트에 수평/수직 구속 + 앵커 구성
 *  3. applyToStrokes — 솔버 해를 스트로크 좌표로 되쓰기
 */
import { type Pt, type Constraint } from "./constraintSolver";
import type { SketchPoint } from "./sketchPlane";

/** 이 거리 이내 정점은 같은 공유 정점으로 본다 (그리기 스냅 tol 과 결을 맞춤). */
export const MERGE_TOL = 0.6;

export interface VertexModel {
  /** 병합된 공유 정점들 (솔버 입력). */
  pts: Pt[];
  /** map[strokeIdx][ptIdx] = pts 안의 전역 정점 인덱스. */
  map: number[][];
}

/** 모든 스트로크 정점을 모아 tol 이내면 한 점으로 합친다 (공유 코너 그래프). */
export function extractVertices(strokes: SketchPoint[][], tol = MERGE_TOL): VertexModel {
  const pts: Pt[] = [];
  const map: number[][] = [];
  for (const stroke of strokes) {
    const row: number[] = [];
    for (const p of stroke) {
      let gi = pts.findIndex((q) => Math.hypot(q.x - p.u, q.y - p.v) <= tol);
      if (gi < 0) {
        gi = pts.length;
        pts.push({ x: p.u, y: p.v });
      }
      row.push(gi);
    }
    map.push(row);
  }
  return { pts, map };
}

/** 솔버 해(전역 정점 좌표)를 스트로크 좌표로 되쓴다. 공유 정점은 모든 스트로크에 반영. */
export function applyToStrokes(
  strokes: SketchPoint[][],
  model: VertexModel,
  solved: Pt[],
): SketchPoint[][] {
  return strokes.map((stroke, s) =>
    stroke.map((_, k) => {
      const gi = model.map[s]![k]!;
      const sp = solved[gi]!;
      return { u: sp.x, v: sp.y };
    }),
  );
}

export type SegConstraintKind = "horizontal" | "vertical";

/** 세그먼트 방향으로 수평/수직 자동 판정 (|dy| < |dx| → 수평). */
export function autoSegKind(a: SketchPoint, b: SketchPoint): SegConstraintKind {
  return Math.abs(b.v - a.v) <= Math.abs(b.u - a.u) ? "horizontal" : "vertical";
}

/**
 * 선택 세그먼트(스트로크 strokeIdx 의 점 segIdx → segIdx+1)에 H/V 구속을 건다.
 * 첫 점을 앵커로 고정해 선이 그 점 기준으로 펴지도록(예측 가능). null = 잘못된 선택.
 */
export function buildSegmentSolve(
  model: VertexModel,
  strokeIdx: number,
  segIdx: number,
  kind: SegConstraintKind,
): { constraints: Constraint[]; anchor: number } | null {
  const row = model.map[strokeIdx];
  if (!row) return null;
  const a = row[segIdx];
  const b = row[segIdx + 1];
  if (a === undefined || b === undefined || a === b) return null;
  const c: Constraint =
    kind === "horizontal" ? { kind: "horizontal", a, b } : { kind: "vertical", a, b };
  return { constraints: [c], anchor: a };
}
