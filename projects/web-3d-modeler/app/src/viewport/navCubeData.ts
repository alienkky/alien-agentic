/**
 * 네비큐브(View Orientation Cube) 데이터 + CSS-3D 회전 (순수 — 단위테스트 가능).
 * Shapr3D "View Controls": 큐브 면/모서리/꼭짓점을 클릭해 표준 시점으로 스냅하고,
 * 큐브는 현재 카메라 방향을 거울처럼 반영한다.
 *
 * 클릭 매핑은 바깥 방향 벡터 dir 로 통일 → cameraMath.viewDirection 이 소비한다.
 * (면=축 1개, 모서리=축 2개, 꼭짓점=축 3개. 모두 같은 함수로 처리.)
 */

/** 큐브 반변 길이(px). 큐브 한 변 = 2*HALF. */
export const HALF = 36;

export interface CubeFace {
  id: string;
  label: string;
  dir: [number, number, number];
  /** 이 면을 큐브 표면에 배치하는 CSS transform. */
  transform: string;
}

export const CUBE_FACES: CubeFace[] = [
  { id: "front", label: "FR", dir: [0, 0, 1], transform: `translateZ(${HALF}px)` },
  { id: "back", label: "BK", dir: [0, 0, -1], transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { id: "right", label: "RT", dir: [1, 0, 0], transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { id: "left", label: "LF", dir: [-1, 0, 0], transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { id: "top", label: "TOP", dir: [0, 1, 0], transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { id: "bottom", label: "BT", dir: [0, -1, 0], transform: `rotateX(-90deg) translateZ(${HALF}px)` },
];

/** 8 꼭짓점 — 클릭 시 그 대각 방향에서 아이소 시점. translate3d 로 큐브 모서리에 박힌다. */
export const CUBE_CORNERS: { id: string; dir: [number, number, number] }[] = (
  [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  ] as [number, number, number][]
).map((d) => ({ id: `c${d.map((n) => (n > 0 ? "p" : "n")).join("")}`, dir: d }));

/**
 * 12 모서리 — 클릭 시 두 면 사이 대각(45°) 시점. 정확히 두 축이 ±1, 한 축은 0.
 * cornerTransform 을 그대로 쓰면 0 축은 0 오프셋이라 모서리 중점에 정확히 놓인다.
 */
export const CUBE_EDGES: { id: string; dir: [number, number, number] }[] = (
  [
    [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
    [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
    [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
  ] as [number, number, number][]
).map((d) => ({ id: `e${d.map((n) => (n > 0 ? "p" : n < 0 ? "n" : "z")).join("")}`, dir: d }));

/** 꼭짓점·모서리 마커를 큐브 표면에 놓는 CSS transform (0 축은 중점). */
export function cornerTransform(dir: [number, number, number]): string {
  return `translate3d(${dir[0] * HALF}px, ${-dir[1] * HALF}px, ${dir[2] * HALF}px)`;
}

const RAD2DEG = 180 / Math.PI;

/**
 * 카메라 구면각(azimuth, polar) → 큐브 컨테이너 CSS 회전 문자열.
 * cameraMath.toCartesian 의 카메라 방향 (sinP·sinA, cosP, sinP·cosA) 과 일관:
 *  - 정면(A=0, P=90°) → 회전 0 → FRONT 면이 정면.
 *  - 윗면(P→0)        → rotateX(-90°) → TOP 면이 정면.
 *  - 우측(A=90°)      → rotateY(-90°) → RIGHT 면이 정면.
 */
export function cubeTransform(azimuth: number, polar: number): string {
  const rx = (polar - Math.PI / 2) * RAD2DEG;
  const ry = -azimuth * RAD2DEG;
  return `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
}
