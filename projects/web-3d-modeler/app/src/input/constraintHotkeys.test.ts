import { describe, it, expect } from "vitest";
import { resolveConstraintHotkey, type ConstraintAction } from "./constraintHotkeys";

/** Shift 만 눌린 기본 이벤트 헬퍼. */
function ev(
  key: string,
  over: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
): { key: string; shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } {
  return { key, shiftKey: true, ...over };
}

const MAPPINGS: ReadonlyArray<[string, ConstraintAction]> = [
  ["a", "parallel"],
  ["p", "perpendicular"],
  ["t", "tangent"],
  ["n", "coincident"],
  ["v", "horizontalVertical"],
  ["e", "equal"],
  ["l", "lock"],
];

describe("resolveConstraintHotkey", () => {
  it("각 매핑이 Shift+키로 발화한다", () => {
    for (const [key, action] of MAPPINGS) {
      expect(resolveConstraintHotkey(ev(key))).toBe(action);
    }
  });

  it("소문자/대문자 키 모두 동작한다", () => {
    for (const [key, action] of MAPPINGS) {
      expect(resolveConstraintHotkey(ev(key.toLowerCase()))).toBe(action);
      expect(resolveConstraintHotkey(ev(key.toUpperCase()))).toBe(action);
    }
  });

  it("Shift 가 없으면 null", () => {
    for (const [key] of MAPPINGS) {
      expect(resolveConstraintHotkey(ev(key, { shiftKey: false }))).toBeNull();
    }
  });

  it("ctrl 이 같이 눌리면 null", () => {
    expect(resolveConstraintHotkey(ev("a", { ctrlKey: true }))).toBeNull();
  });

  it("meta 가 같이 눌리면 null", () => {
    expect(resolveConstraintHotkey(ev("p", { metaKey: true }))).toBeNull();
  });

  it("alt 가 같이 눌리면 null", () => {
    expect(resolveConstraintHotkey(ev("t", { altKey: true }))).toBeNull();
  });

  it("매핑되지 않은 키는 null", () => {
    for (const key of ["z", "q", "1", "Escape", "Enter", " "]) {
      expect(resolveConstraintHotkey(ev(key))).toBeNull();
    }
  });
});
