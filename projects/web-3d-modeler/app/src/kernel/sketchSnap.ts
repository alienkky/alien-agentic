/**
 * 끝점/중점 스냅 (Shapr3D 식) — 커서가 기존 정점(끝점)이나 변 중점에 근접하면
 * 그 점으로 스냅한다. 우선순위: 끝점 > 중점 > (호출부에서) 안내선/격자.
 *
 * 화면거리 임계는 입력 종류별 허용오차(`pickTolerance`)를 평면(world) 좌표로 환산해 쓴다.
 * 커서↔후보가 임계 밖이면 스냅하지 않는다(null 반환).
 */
import type { SketchPoint } from "./sketchPlane";
import { pickTolerancePx, type InputKind } from "../input/pickTolerance";

export type SnapKind = "endpoint" | "midpoint";

export interface SnapCandidate {
  u: number;
  v: number;
  kind: SnapKind;
}

const mid = (a: SketchPoint, b: SketchPoint): SketchPoint => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });

/**
 * 현재 스케치의 스냅 후보 — 모든 정점(끝점) + 각 변 중점.
 * 변 구성은 렌더와 동일: 점 ≥3 이면 닫힌 루프, 아니면 열린 폴리라인.
 * 그리는 중인 점들(points)은 항상 열린 폴리라인으로 본다.
 */
export function snapCandidates(strokes: SketchPoint[][], points: SketchPoint[]): SnapCandidate[] {
  const out: SnapCandidate[] = [];
  const add = (p: SketchPoint, kind: SnapKind): void => { out.push({ u: p.u, v: p.v, kind }); };

  for (const stroke of strokes) {
    const n = stroke.length;
    if (n === 0) continue;
    for (const p of stroke) add(p, "endpoint");
    const closed = n >= 3;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = stroke[i]!;
      const b = stroke[(i + 1) % n]!;
      add(mid(a, b), "midpoint");
    }
  }

  for (const p of points) add(p, "endpoint");
  for (let i = 0; i < points.length - 1; i++) add(mid(points[i]!, points[i + 1]!), "midpoint");

  return out;
}

/**
 * 후보 중 임계 내 가장 가까운 점으로 스냅. 끝점이 중점보다 우선:
 * 임계 내 끝점이 하나라도 있으면 그중 최근접 끝점, 없으면 최근접 중점.
 * 임계 밖이면 null.
 */
export function pickSnapPoint(raw: SketchPoint, candidates: SnapCandidate[], tol: number): SnapCandidate | null {
  let bestEnd: SnapCandidate | null = null;
  let bestEndD = Infinity;
  let bestMid: SnapCandidate | null = null;
  let bestMidD = Infinity;

  for (const c of candidates) {
    const d = Math.hypot(raw.u - c.u, raw.v - c.v);
    if (d > tol) continue;
    if (c.kind === "endpoint") {
      if (d < bestEndD) { bestEndD = d; bestEnd = c; }
    } else if (d < bestMidD) { bestMidD = d; bestMid = c; }
  }

  return bestEnd ?? bestMid;
}

/** px당 평면(world) 환산 계수 — 화면거리 임계를 줌(radius)에 비례한 world 거리로. */
const PX_TO_WORLD = 0.01;

/** 입력 종류별 화면거리 허용오차를 현재 줌의 world 거리로 환산. 마우스는 기존 감도(≈radius·0.04) 유지. */
export function snapToleranceWorld(radius: number, kind: InputKind): number {
  return Math.max(0.3, radius * PX_TO_WORLD * pickTolerancePx(kind));
}
