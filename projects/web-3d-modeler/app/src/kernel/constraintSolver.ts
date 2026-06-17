/**
 * 2D 스케치 구속 솔버 — 자체 자산 (외부 의존 없음).
 *
 * Shapr3D 식 파라메트릭 스케치의 토대: 점들을 자유 변수로 두고, 구속을 잔차(residual)
 * 함수로 표현해 **비선형 최소제곱**으로 동시 만족시킨다. 한 점을 끌면 연결된 구속이
 * 유지되도록 나머지가 따라 움직인다.
 *
 * 알고리즘: Levenberg–Marquardt (Gauss–Newton + 감쇠 λ).
 *  - 잔차 r(p), 야코비 J 를 수치미분으로 구하고
 *  - (JᵀJ + λ·diag(JᵀJ)) Δ = −Jᵀr 를 풀어 파라미터를 갱신
 *  - 잔차가 줄면 λ↓(가우스-뉴턴에 가깝게), 늘면 λ↑(경사하강에 가깝게) 후 롤백
 *
 * 이 슬라이스는 **순수 커널**(UI 미연결)이다. 다음 슬라이스에서 스케치 스토어와 연결한다.
 */

export interface Pt {
  x: number;
  y: number;
  /** 고정점 — 솔버가 움직이지 않는다 (드래그로 잡은 점, 원점 등). */
  fixed?: boolean;
}

/** a,b,c,d 는 points 배열의 인덱스. 선은 (a,b)·(c,d) 두 점으로 표현. */
export type Constraint =
  | { kind: "coincident"; a: number; b: number }
  | { kind: "horizontal"; a: number; b: number }
  | { kind: "vertical"; a: number; b: number }
  | { kind: "distance"; a: number; b: number; d: number }
  | { kind: "fixX"; a: number; x: number }
  | { kind: "fixY"; a: number; y: number }
  | { kind: "parallel"; a: number; b: number; c: number; d: number }
  | { kind: "perpendicular"; a: number; b: number; c: number; d: number };

export interface SolveOptions {
  maxIterations?: number;
  /** 수렴 판정 — 잔차 노름이 이 값 미만이면 성공. */
  tolerance?: number;
}

export interface SolveResult {
  points: Pt[];
  converged: boolean;
  iterations: number;
  /** 최종 잔차 노름 (√Σrᵢ²). */
  residual: number;
}

const DEFAULT_MAX_ITER = 100;
const DEFAULT_TOL = 1e-8;
const FD_STEP = 1e-6; // 수치미분 스텝

/** 한 구속이 만족될 때 0 이 되는 잔차들. (대부분 1개, coincident 만 2개) */
function residualsOf(c: Constraint, pts: Pt[]): number[] {
  switch (c.kind) {
    case "coincident":
      return [pts[c.a]!.x - pts[c.b]!.x, pts[c.a]!.y - pts[c.b]!.y];
    case "horizontal":
      return [pts[c.a]!.y - pts[c.b]!.y];
    case "vertical":
      return [pts[c.a]!.x - pts[c.b]!.x];
    case "distance": {
      const dx = pts[c.a]!.x - pts[c.b]!.x;
      const dy = pts[c.a]!.y - pts[c.b]!.y;
      return [Math.hypot(dx, dy) - c.d];
    }
    case "fixX":
      return [pts[c.a]!.x - c.x];
    case "fixY":
      return [pts[c.a]!.y - c.y];
    case "parallel": {
      // (b−a) × (d−c) = 0
      const ux = pts[c.b]!.x - pts[c.a]!.x;
      const uy = pts[c.b]!.y - pts[c.a]!.y;
      const vx = pts[c.d]!.x - pts[c.c]!.x;
      const vy = pts[c.d]!.y - pts[c.c]!.y;
      return [ux * vy - uy * vx];
    }
    case "perpendicular": {
      // (b−a) · (d−c) = 0
      const ux = pts[c.b]!.x - pts[c.a]!.x;
      const uy = pts[c.b]!.y - pts[c.a]!.y;
      const vx = pts[c.d]!.x - pts[c.c]!.x;
      const vy = pts[c.d]!.y - pts[c.c]!.y;
      return [ux * vx + uy * vy];
    }
  }
}

function allResiduals(constraints: Constraint[], pts: Pt[]): number[] {
  const r: number[] = [];
  for (const c of constraints) r.push(...residualsOf(c, pts));
  return r;
}

function norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

/**
 * 선형계 A·x = b 를 부분 피벗 가우스 소거로 푼다 (n×n, 작은 밀집 행렬).
 * 특이하면 null. A·b 는 호출측에서 복사본을 넘긴다(파괴적).
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    if (Math.abs(A[piv]![col]!) < 1e-14) return null;
    if (piv !== col) {
      [A[piv], A[col]] = [A[col]!, A[piv]!];
      [b[piv], b[col]] = [b[col]!, b[piv]!];
    }
    const pivVal = A[col]![col]!;
    for (let r = col + 1; r < n; r++) {
      const f = A[r]![col]! / pivVal;
      if (f === 0) continue;
      for (let k = col; k < n; k++) A[r]![k]! -= f * A[col]![k]!;
      b[r]! -= f * b[col]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let k = r + 1; k < n; k++) s -= A[r]![k]! * x[k]!;
    x[r] = s / A[r]![r]!;
  }
  return x;
}

/**
 * 구속을 동시에 만족하도록 점 좌표를 푼다. 고정점(fixed)은 움직이지 않는다.
 * 입력 points 는 변형하지 않고, 해를 담은 새 배열을 돌려준다.
 */
export function solveConstraints(
  points: Pt[],
  constraints: Constraint[],
  opts: SolveOptions = {},
): SolveResult {
  const maxIter = opts.maxIterations ?? DEFAULT_MAX_ITER;
  const tol = opts.tolerance ?? DEFAULT_TOL;
  const pts = points.map((p) => ({ ...p }));

  // 자유 변수 슬롯: 비고정 점마다 (x,y) 두 개. cols[k] = {pi, axis}.
  const cols: { pi: number; axis: "x" | "y" }[] = [];
  points.forEach((p, pi) => {
    if (!p.fixed) {
      cols.push({ pi, axis: "x" });
      cols.push({ pi, axis: "y" });
    }
  });
  const n = cols.length;

  const readParams = (): number[] => cols.map((c) => pts[c.pi]![c.axis]);
  const writeParams = (x: number[]): void => {
    cols.forEach((c, j) => {
      pts[c.pi]![c.axis] = x[j]!;
    });
  };

  let r = allResiduals(constraints, pts);
  let rNorm = norm(r);
  if (n === 0 || rNorm < tol) {
    return { points: pts, converged: rNorm < tol, iterations: 0, residual: rNorm };
  }

  let lambda = 1e-3;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    if (rNorm < tol) break;
    const m = r.length;
    const base = readParams();

    // 수치 야코비 J (m×n).
    const J: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j++) {
      const saved = base[j]!;
      writeParams(base.map((v, k) => (k === j ? v + FD_STEP : v)));
      const rPlus = allResiduals(constraints, pts);
      for (let i = 0; i < m; i++) J[i]![j] = (rPlus[i]! - r[i]!) / FD_STEP;
      // 복원
      writeParams(base.map((v, k) => (k === j ? saved : v)));
    }
    writeParams(base);

    // JᵀJ, Jᵀr
    const JtJ: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const Jtr = new Array<number>(n).fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) {
        let s = 0;
        for (let i = 0; i < m; i++) s += J[i]![a]! * J[i]![b]!;
        JtJ[a]![b] = s;
        JtJ[b]![a] = s;
      }
      let s = 0;
      for (let i = 0; i < m; i++) s += J[i]![a]! * r[i]!;
      Jtr[a] = s;
    }

    // LM: λ 감쇠를 대각에 더해 풀고, 개선되면 채택.
    let stepTaken = false;
    for (let tries = 0; tries < 8; tries++) {
      // 가법 감쇠(Levenberg): 대각에 λ(1+JᵀJ_aa) 를 더한다. 곱셈 감쇠(v·(1+λ))는
      // 구속 없는 변수의 0 대각을 0으로 남겨 특이행렬이 되므로 가법이라야 한다.
      const A = JtJ.map((row, a) => row.map((v, b2) => (a === b2 ? v + lambda * (1 + v) : v)));
      const rhs = Jtr.map((v) => -v);
      const delta = solveLinear(A, rhs);
      if (delta) {
        const cand = base.map((v, j) => v + delta[j]!);
        writeParams(cand);
        const rNew = allResiduals(constraints, pts);
        const nNew = norm(rNew);
        if (nNew < rNorm) {
          r = rNew;
          rNorm = nNew;
          lambda = Math.max(lambda * 0.5, 1e-12);
          stepTaken = true;
          break;
        }
      }
      writeParams(base);
      lambda = Math.min(lambda * 4, 1e8);
    }
    if (!stepTaken) break; // 더 못 줄임 — 지역 최소 또는 과소구속
  }

  return { points: pts, converged: rNorm < tol, iterations: iter, residual: rNorm };
}
