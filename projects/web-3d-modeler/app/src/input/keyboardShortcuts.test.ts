import { describe, it, expect } from "vitest";
import { resolveShortcut, type ShortcutContext } from "./keyboardShortcuts";

const base: ShortcutContext = { sketchActive: false, sketchLineDrawing: false, dimEditing: false, typing: false };
const mods = (over: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {}) => ({ ctrl: false, shift: false, alt: false, ...over });

describe("keyboardShortcuts — resolveShortcut", () => {
  it("입력 중·치수 편집 중엔 전면 차단", () => {
    expect(resolveShortcut("r", mods(), { ...base, sketchActive: true, typing: true })).toBeNull();
    expect(resolveShortcut("r", mods(), { ...base, sketchActive: true, dimEditing: true })).toBeNull();
  });

  it("스케치 도구 핫키 (L/A/I/R/C/G/T) — 스케치 모드에서만", () => {
    expect(resolveShortcut("r", mods(), { ...base, sketchActive: true })).toEqual({ type: "tool", tool: "rectangle" });
    expect(resolveShortcut("A", mods(), { ...base, sketchActive: true })).toEqual({ type: "tool", tool: "arc" });
    expect(resolveShortcut("c", mods(), { ...base, sketchActive: true })).toEqual({ type: "tool", tool: "circle" });
    expect(resolveShortcut("g", mods(), { ...base, sketchActive: true })).toEqual({ type: "tool", tool: "polygon" });
    // 비스케치 모드: 도구 핫키 무시
    expect(resolveShortcut("r", mods(), base)).toBeNull();
  });

  it("Ctrl+Z: 스케치 중엔 점 취소, 아니면 바디 실행취소", () => {
    expect(resolveShortcut("z", mods({ ctrl: true }), { ...base, sketchActive: true })).toEqual({ type: "undoSketchPoint" });
    expect(resolveShortcut("z", mods({ ctrl: true }), base)).toEqual({ type: "undo" });
  });

  it("Ctrl+A: 비스케치 모드 모두 선택 (스케치 중엔 무시)", () => {
    expect(resolveShortcut("a", mods({ ctrl: true }), base)).toEqual({ type: "selectAll" });
    expect(resolveShortcut("a", mods({ ctrl: true }), { ...base, sketchActive: true })).toBeNull();
  });

  it("Esc: 선 그리는 중엔 확정, 아니면 무시", () => {
    expect(resolveShortcut("Escape", mods(), { ...base, sketchActive: true, sketchLineDrawing: true })).toEqual({ type: "finishLine" });
    expect(resolveShortcut("Escape", mods(), { ...base, sketchActive: true })).toBeNull();
  });

  it("Shift/Alt 조합은 도구 핫키로 안 먹는다 (구속 핫키는 별도 에픽)", () => {
    expect(resolveShortcut("p", mods({ shift: true }), { ...base, sketchActive: true })).toBeNull();
    expect(resolveShortcut("r", mods({ alt: true }), { ...base, sketchActive: true })).toBeNull();
  });
});
