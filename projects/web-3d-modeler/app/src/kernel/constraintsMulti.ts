/**
 * 다중 세그먼트 구속 빌더 (순수).
 *
 * 사용자가 두 변(세그먼트)을 고른 뒤 "평행 / 직각 / 시작점 일치" 같은 관계를 걸 때,
 * 그 선택을 공유 정점 모델(VertexModel) 위의 솔버 Constraint 로 번역한다.
 *
 * 세그먼트 참조(SegRef)는 {s, i} — 스트로크 s 의 점 i 에서 i+1 로 가는 변을 가리킨다.
 * 모든 빌더는 length 1 Constraint[] 또는 (입력이 잘못/퇴화하면) null 을 돌려준다.
 * 새 구속 종류는 만들지 않고 기존 kind(parallel/perpendicular/coincident)만 쓴다.
 */
import { type Constraint } from "./constraintSolver";
import type { VertexModel } from "./sketchConstraints";

export interface SegRef {
  s: number;
  i: number;
}

/** 세그먼트 참조를 전역 정점 인덱스 두 개로 변환. 잘못된 참조면 null. */
export function segVerts(model: VertexModel, seg: SegRef): [number, number] | null {
  const row = model.map[seg.s];
  if (!row) return null;
  const a = row[seg.i];
  const b = row[seg.i + 1];
  if (a === undefined || b === undefined) return null;
  return [a, b];
}

/** 두 세그먼트에 "평행" 구속. 한쪽이라도 잘못되거나 퇴화(a===b)면 null. */
export function buildParallel(model: VertexModel, segA: SegRef, segB: SegRef): Constraint[] | null {
  const va = segVerts(model, segA);
  const vb = segVerts(model, segB);
  if (!va || !vb) return null;
  if (va[0] === va[1] || vb[0] === vb[1]) return null;
  return [{ kind: "parallel", a: va[0], b: va[1], c: vb[0], d: vb[1] }];
}

/** 두 세그먼트에 "직각" 구속. 한쪽이라도 잘못되거나 퇴화(a===b)면 null. */
export function buildPerpendicular(model: VertexModel, segA: SegRef, segB: SegRef): Constraint[] | null {
  const va = segVerts(model, segA);
  const vb = segVerts(model, segB);
  if (!va || !vb) return null;
  if (va[0] === va[1] || vb[0] === vb[1]) return null;
  return [{ kind: "perpendicular", a: va[0], b: va[1], c: vb[0], d: vb[1] }];
}

/**
 * 두 세그먼트의 시작 끝점(segA.i 정점 == segB.i 정점)을 일치시키는 "coincident" 구속.
 * 한쪽이라도 잘못되면 null. (이미 같은 공유 정점이면 잔차 0 으로 무해하게 통과.)
 */
export function buildCoincidentStarts(model: VertexModel, segA: SegRef, segB: SegRef): Constraint[] | null {
  const va = segVerts(model, segA);
  const vb = segVerts(model, segB);
  if (!va || !vb) return null;
  return [{ kind: "coincident", a: va[0], b: vb[0] }];
}
