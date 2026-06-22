/**
 * 스케치 구속조건 — 평면 (u,v) 위 획(stroke)의 선분/점에 기하 구속을 직접 적용한다.
 * 본격 GCS(PlaneGCS) 솔버가 아니라 *직접 보정* 방식 — 결정론적이고, 선택 순서로 기준을 정한다.
 *
 * 선분 (SegRef): 획 s 의 점 i → 점 i+1. (wrap 선분은 제외 — 치수 라벨과 동일 규약)
 * 점   (PtRef):  획 s 의 점 i.
 *
 * 모든 함수는 새 strokes 를 반환(불변). 적용 불가(퇴화·범위초과)면 원본을 그대로 돌려준다.
 */
import type { SketchPoint } from "./sketchPlane";

export interface SegRef {
  s: number;
  i: number;
}
export interface PtRef {
  s: number;
  i: number;
}

/** 1개 선분 구속 (수평/수직). */
export type SegSoloConstraint = "horizontal" | "vertical";
/** 2개 선분 구속 (첫=기준 고정, 둘째=보정). */
export type SegPairConstraint = "parallel" | "perpendicular" | "equal";
/** 2개 점 구속 (첫=기준 고정, 둘째=이동). */
export type PtPairConstraint = "coincident";
export type ConstraintKind = SegSoloConstraint | SegPairConstraint | PtPairConstraint;

/** 구속별 필요한 선택 종류·개수. */
export interface ConstraintSpec {
  kind: ConstraintKind;
  /** 'seg' = 선분 N개, 'point' = 점 N개 */
  target: "seg" | "point";
  count: number;
}
export const CONSTRAINT_SPECS: Record<ConstraintKind, ConstraintSpec> = {
  horizontal: { kind: "horizontal", target: "seg", count: 1 },
  vertical: { kind: "vertical", target: "seg", count: 1 },
  parallel: { kind: "parallel", target: "seg", count: 2 },
  perpendicular: { kind: "perpendicular", target: "seg", count: 2 },
  equal: { kind: "equal", target: "seg", count: 2 },
  coincident: { kind: "coincident", target: "point", count: 2 },
};

const EPS = 1e-9;
const len2 = (du: number, dv: number): number => Math.hypot(du, dv);

/** 선분 양 끝점을 꺼낸다. 범위를 벗어나면 null. */
function segPoints(strokes: SketchPoint[][], ref: SegRef): { a: SketchPoint; b: SketchPoint } | null {
  const stroke = strokes[ref.s];
  if (!stroke) return null;
  const a = stroke[ref.i];
  const b = stroke[ref.i + 1];
  if (!a || !b) return null;
  return { a, b };
}

/** 점을 꺼낸다. */
function ptOf(strokes: SketchPoint[][], ref: PtRef): SketchPoint | null {
  return strokes[ref.s]?.[ref.i] ?? null;
}

/** 획 s 의 점 i 를 p 로 바꾼 새 strokes (불변). */
function withPoint(strokes: SketchPoint[][], s: number, i: number, p: SketchPoint): SketchPoint[][] {
  return strokes.map((stroke, si) => (si === s ? stroke.map((pt, pi) => (pi === i ? p : pt)) : stroke));
}

/** 선분을 수평/수직으로 — 첫 끝점(a) 고정, 길이 유지, 둘째 끝점(b)만 이동. */
export function applySolo(strokes: SketchPoint[][], ref: SegRef, kind: SegSoloConstraint): SketchPoint[][] {
  const seg = segPoints(strokes, ref);
  if (!seg) return strokes;
  const { a, b } = seg;
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len = len2(du, dv);
  if (len < EPS) return strokes;
  let nb: SketchPoint;
  if (kind === "horizontal") {
    const sign = du < 0 ? -1 : 1; // du=0(수직선)이면 +방향
    nb = { u: a.u + sign * len, v: a.v };
  } else {
    const sign = dv < 0 ? -1 : 1;
    nb = { u: a.u, v: a.v + sign * len };
  }
  return withPoint(strokes, ref.s, ref.i + 1, nb);
}

/** 두 선분 — 기준(fixed) 방향에 맞춰 대상(target)을 평행/직교/동일길이로 보정. */
export function applyPair(strokes: SketchPoint[][], fixed: SegRef, target: SegRef, kind: SegPairConstraint): SketchPoint[][] {
  const f = segPoints(strokes, fixed);
  const t = segPoints(strokes, target);
  if (!f || !t) return strokes;
  const fdu = f.b.u - f.a.u;
  const fdv = f.b.v - f.a.v;
  const flen = len2(fdu, fdv);
  const tdu = t.b.u - t.a.u;
  const tdv = t.b.v - t.a.v;
  const tlen = len2(tdu, tdv);
  if (flen < EPS || tlen < EPS) return strokes;

  if (kind === "equal") {
    // 대상 방향 유지, 길이만 기준 길이로. 첫 끝점 고정.
    const k = flen / tlen;
    const nb: SketchPoint = { u: t.a.u + tdu * k, v: t.a.v + tdv * k };
    return withPoint(strokes, target.s, target.i + 1, nb);
  }

  // 평행/직교: 기준 단위벡터(또는 그 직교)에 대상 길이를 실어 둘째 끝점 재배치.
  const ux = fdu / flen;
  const uy = fdv / flen;
  // 직교면 기준벡터를 90° 회전.
  const dirX = kind === "perpendicular" ? -uy : ux;
  const dirY = kind === "perpendicular" ? ux : uy;
  // 현재 대상 방향과 내적 부호로 뒤집힘 방지 (가까운 쪽 선택).
  const dot = (tdu * dirX + tdv * dirY) / tlen;
  const sign = dot < 0 ? -1 : 1;
  const nb: SketchPoint = { u: t.a.u + sign * dirX * tlen, v: t.a.v + sign * dirY * tlen };
  return withPoint(strokes, target.s, target.i + 1, nb);
}

/** 두 점 일치 — 기준점(fixed) 위치로 대상점(move)을 옮긴다. */
export function applyCoincident(strokes: SketchPoint[][], fixed: PtRef, move: PtRef): SketchPoint[][] {
  const pf = ptOf(strokes, fixed);
  if (!pf) return strokes;
  if (!ptOf(strokes, move)) return strokes;
  return withPoint(strokes, move.s, move.i, { u: pf.u, v: pf.v });
}
