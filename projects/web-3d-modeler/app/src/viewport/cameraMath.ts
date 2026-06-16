/**
 * 궤도 카메라 수학 (순수 함수 — 단위테스트 가능).
 * 타깃을 중심으로 한 구면 좌표(azimuth/polar/radius)로 카메라를 표현한다.
 * 입력 제스처(orbit/pan/zoom)가 이 상태를 갱신하고, toCartesian 으로 위치를 낸다.
 */

export interface CameraState {
  /** 수평각 (rad) */
  azimuth: number;
  /** 수직각 (rad), (0, PI) 로 클램프 */
  polar: number;
  /** 타깃까지 거리 */
  radius: number;
  /** 바라보는 중심점 */
  target: [number, number, number];
}

const POLAR_EPS = 0.02;
const MIN_RADIUS = 0.5;
const MAX_RADIUS = 2000;
const ORBIT_SPEED = 0.005;

export function defaultCamera(): CameraState {
  return {
    azimuth: Math.PI / 4,
    polar: Math.PI / 3,
    radius: 12,
    target: [0, 0, 0],
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function orbit(state: CameraState, dxPx: number, dyPx: number): CameraState {
  return {
    ...state,
    azimuth: state.azimuth - dxPx * ORBIT_SPEED,
    polar: clamp(state.polar - dyPx * ORBIT_SPEED, POLAR_EPS, Math.PI - POLAR_EPS),
  };
}

export function zoom(state: CameraState, factor: number): CameraState {
  if (factor <= 0) return state;
  return { ...state, radius: clamp(state.radius / factor, MIN_RADIUS, MAX_RADIUS) };
}

export function pan(state: CameraState, dxPx: number, dyPx: number): CameraState {
  // 화면 픽셀 이동을 카메라 평면(right/up)으로 옮긴다. 거리에 비례.
  const { right, up } = basis(state);
  const scale = state.radius * 0.0018;
  const tx = state.target[0] - (right[0] * dxPx - up[0] * dyPx) * scale;
  const ty = state.target[1] - (right[1] * dxPx - up[1] * dyPx) * scale;
  const tz = state.target[2] - (right[2] * dxPx - up[2] * dyPx) * scale;
  return { ...state, target: [tx, ty, tz] };
}

export type ViewPreset = "iso" | "front" | "back" | "top" | "bottom" | "right" | "left";

/** 표준 뷰로 카메라 방향을 맞춘다 (radius·target 유지). Shapr3D 네비큐브 대응. */
export function viewPreset(state: CameraState, view: ViewPreset): CameraState {
  const angles: Record<ViewPreset, { azimuth: number; polar: number }> = {
    iso: { azimuth: Math.PI / 4, polar: Math.PI / 3 },
    front: { azimuth: 0, polar: Math.PI / 2 },
    back: { azimuth: Math.PI, polar: Math.PI / 2 },
    top: { azimuth: 0, polar: POLAR_EPS },
    bottom: { azimuth: 0, polar: Math.PI - POLAR_EPS },
    right: { azimuth: Math.PI / 2, polar: Math.PI / 2 },
    left: { azimuth: -Math.PI / 2, polar: Math.PI / 2 },
  };
  const a = angles[view];
  return { ...state, azimuth: a.azimuth, polar: a.polar };
}

/**
 * 카메라를 면 법선 정면으로 정렬 — 그 면을 정면으로 바라보게(타깃=면 중심).
 * 면 위 스케치 진입 시 사용. 법선이 수직(위/아래)이면 방위각은 유지.
 */
export function alignToNormal(
  state: CameraState,
  normal: [number, number, number],
  target: [number, number, number],
): CameraState {
  const N = normalize(normal);
  const polar = clamp(Math.acos(clamp(N[1], -1, 1)), POLAR_EPS, Math.PI - POLAR_EPS);
  const sinP = Math.sin(polar);
  const azimuth = sinP < 1e-4 ? state.azimuth : Math.atan2(N[0], N[2]);
  return { ...state, azimuth, polar, target };
}

/**
 * 어댑티브 그리드 셀 크기 — 카메라 거리(radius)에 따라 10의 거듭제곱 단계로.
 * 확대(거리↓)하면 셀이 잘아진다 (Shapr3D 식). 예: r12→1, r3→0.1, r120→10.
 */
export function adaptiveCellSize(radius: number): number {
  const e = Math.floor(Math.log10(Math.max(radius, 1e-4)));
  return Math.pow(10, e - 1);
}

export function toCartesian(state: CameraState): [number, number, number] {
  const { polar, azimuth, radius, target } = state;
  const sinP = Math.sin(polar);
  return [
    target[0] + radius * sinP * Math.sin(azimuth),
    target[1] + radius * Math.cos(polar),
    target[2] + radius * sinP * Math.cos(azimuth),
  ];
}

/** 카메라의 right/up 단위벡터 (pan 계산용). */
function basis(state: CameraState): {
  right: [number, number, number];
  up: [number, number, number];
} {
  const pos = toCartesian(state);
  const fwd: [number, number, number] = [
    state.target[0] - pos[0],
    state.target[1] - pos[1],
    state.target[2] - pos[2],
  ];
  const worldUp: [number, number, number] = [0, 1, 0];
  const right = normalize(cross(fwd, worldUp));
  const up = normalize(cross(right, fwd));
  return { right, up };
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(a: [number, number, number]): [number, number, number] {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}
