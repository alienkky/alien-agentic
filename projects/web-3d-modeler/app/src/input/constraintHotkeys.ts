/**
 * 스케치 구속(constraint) 핫키 해석 (순수 함수 — 단위테스트 가능).
 * Shapr3D 식: Shift+글자 로 구속을 건다.
 *   ⇧A 평행 · ⇧P 수직 · ⇧T 접선 · ⇧N 일치 · ⇧V 수평/수직 · ⇧E 동일 · ⇧L 잠금.
 * shiftKey 가 켜졌을 때만 발화하고, ctrl/meta/alt 가 하나라도 눌리면 무시한다.
 */

export type ConstraintAction =
  | "parallel"        // ⇧A
  | "perpendicular"   // ⇧P
  | "tangent"         // ⇧T
  | "coincident"      // ⇧N
  | "horizontalVertical" // ⇧V
  | "equal"           // ⇧E
  | "lock";           // ⇧L

/** Shift+소문자 키 → 구속 액션 맵. 인식 안 되는 키는 맵에 없음. */
const CONSTRAINT_KEYS: Record<string, ConstraintAction> = {
  a: "parallel",
  p: "perpendicular",
  t: "tangent",
  n: "coincident",
  v: "horizontalVertical",
  e: "equal",
  l: "lock",
};

/** Map a keydown to a constraint action, or null. Only fires when shiftKey is true.
 *  Case-insensitive on key. Ignores when ctrl/meta/alt held. */
export function resolveConstraintHotkey(e: {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): ConstraintAction | null {
  if (!e.shiftKey) return null;
  // Shift 단독 조합만 허용 — 다른 수정자가 끼면 OS/앱 단축키와 충돌하므로 무시.
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const k = e.key.toLowerCase();
  // noUncheckedIndexedAccess 대응: 존재 여부를 먼저 확인하고 ! 로 단언.
  if (Object.prototype.hasOwnProperty.call(CONSTRAINT_KEYS, k)) {
    return CONSTRAINT_KEYS[k]!;
  }
  return null;
}
