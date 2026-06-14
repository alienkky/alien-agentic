/**
 * 입력 종류별 픽킹 허용오차 (§2.5 입력 설계 1원칙).
 *
 * 손가락으로 모서리를 집는 것과 마우스로 집는 것은 근본적으로 다르다.
 * 히트 타깃 크기를 입력 종류에 따라 동적으로 둔다. 값은 CSS 픽셀(논리 px) 기준이며,
 * 디바이스 픽셀 비율은 픽킹 시점에 곱한다.
 */

export type InputKind = "mouse" | "pen" | "touch";

/** PointerEvent.pointerType → InputKind 정규화. */
export function inputKindFromPointerType(pointerType: string): InputKind {
  if (pointerType === "pen") return "pen";
  if (pointerType === "touch") return "touch";
  // "mouse" 및 미상(빈 문자열 등)은 마우스로 취급
  return "mouse";
}

/** 입력 종류별 기본 허용오차 (CSS px 반경). 손가락이 가장 관대하다. */
const TOLERANCE_PX: Record<InputKind, number> = {
  mouse: 4,
  pen: 4,
  touch: 18, // 약 ~10mm 안팎의 손가락 접점
};

export function pickTolerancePx(kind: InputKind): number {
  return TOLERANCE_PX[kind];
}
