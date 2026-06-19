/**
 * 구속 글리프 배치 — 순수 헬퍼.
 *
 * 스케치 (u,v) 공간 어디에 작은 "구속 배지(badge)"를 그릴지와 어떤 기호를 쓸지 계산한다.
 * 렌더러(SketchLayer 등)는 이 결과만 받아 화면에 찍으면 된다 — 좌표 계산 책임을 한곳에 모은다.
 *
 * 위치 규칙:
 *  - horizontal / vertical / distance: 세그먼트 (정점 a → 정점 b) 의 중점
 *  - parallel / perpendicular: 두 세그먼트(a→b, c→d) 각 중점의 중점
 *  - coincident: 정점 a 위치
 *
 * fixX / fixY 는 글리프를 만들지 않는다(스킵). 단일 점에 대한 좌표 고정은 시각적 배지로
 * 표현하지 않아 단순함을 유지한다.
 *
 * 참조 인덱스가 model.pts 범위를 벗어나면 그 구속은 건너뛴다.
 */
import type { SketchPoint } from "../kernel/sketchPlane";
import type { Constraint } from "../kernel/constraintSolver";
import type { VertexModel } from "../kernel/sketchConstraints";

export type GlyphKind =
  | "horizontal"
  | "vertical"
  | "parallel"
  | "perpendicular"
  | "coincident"
  | "distance";

export interface ConstraintGlyph {
  /** 배지를 렌더할 uv 위치. */
  at: SketchPoint;
  kind: GlyphKind;
  /** 짧은 기호. */
  label: string;
}

/** GlyphKind → 표시 기호. */
const LABELS: Record<GlyphKind, string> = {
  horizontal: "—",
  vertical: "|",
  parallel: "∥",
  perpendicular: "⊥",
  coincident: "•",
  distance: "↔",
};

/** 인덱스가 pts 범위 안인지. (noUncheckedIndexedAccess: 호출측에서 ! 사용 가능하도록 보장) */
function inRange(model: VertexModel, ...idx: number[]): boolean {
  const n = model.pts.length;
  return idx.every((i) => Number.isInteger(i) && i >= 0 && i < n);
}

/** pts[i] 를 (u,v) SketchPoint 로 (x=u, y=v). 범위 검증은 호출측 책임. */
function uv(model: VertexModel, i: number): SketchPoint {
  const p = model.pts[i]!;
  return { u: p.x, v: p.y };
}

/** 두 점의 중점. */
function mid(a: SketchPoint, b: SketchPoint): SketchPoint {
  return { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 };
}

/**
 * 구속마다 배지 1개를 계산한다. 참조 인덱스가 범위를 벗어나면 그 구속은 글리프 없이 건너뛴다.
 * fixX / fixY 는 항상 건너뛴다.
 */
export function computeGlyphs(model: VertexModel, constraints: Constraint[]): ConstraintGlyph[] {
  const out: ConstraintGlyph[] = [];
  for (const c of constraints) {
    switch (c.kind) {
      case "horizontal":
      case "vertical":
      case "distance": {
        if (!inRange(model, c.a, c.b)) continue;
        out.push({ at: mid(uv(model, c.a), uv(model, c.b)), kind: c.kind, label: LABELS[c.kind] });
        break;
      }
      case "parallel":
      case "perpendicular": {
        if (!inRange(model, c.a, c.b, c.c, c.d)) continue;
        const m1 = mid(uv(model, c.a), uv(model, c.b));
        const m2 = mid(uv(model, c.c), uv(model, c.d));
        out.push({ at: mid(m1, m2), kind: c.kind, label: LABELS[c.kind] });
        break;
      }
      case "coincident": {
        if (!inRange(model, c.a)) continue;
        out.push({ at: uv(model, c.a), kind: "coincident", label: LABELS.coincident });
        break;
      }
      case "fixX":
      case "fixY":
        // 의도적 스킵 — 단일 점 좌표 고정은 배지로 표현하지 않는다.
        continue;
    }
  }
  return out;
}
