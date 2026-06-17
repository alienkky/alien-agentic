/**
 * 키보드 단축키 해석 (순수 함수 — 단위테스트 가능) + 마운트 훅.
 * Shapr3D 식: 스케치 도구 핫키(L/A/I/R/C/G/T), Ctrl+Z 실행취소, Ctrl+A 모두 선택, Esc 선 확정.
 * 입력 박스 포커스 중이거나 치수 타이핑(sketchDimEdit) 중엔 모든 단축키를 무시한다.
 */
import { useEffect } from "react";
import { useAppStore, type SketchTool } from "../store/useAppStore";

export interface ShortcutMods {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutContext {
  sketchActive: boolean;
  sketchLineDrawing: boolean;
  /** 치수 타이핑 편집 활성 여부 */
  dimEditing: boolean;
  /** 입력/텍스트영역에 포커스가 있는지 */
  typing: boolean;
}

export type ShortcutAction =
  | { type: "tool"; tool: SketchTool }
  | { type: "undo" }
  | { type: "undoSketchPoint" }
  | { type: "selectAll" }
  | { type: "finishLine" }
  | null;

/** 스케치 도구 핫키 맵 (소문자 키 → 도구). 비스케치 모드에선 무시. */
const TOOL_KEYS: Record<string, SketchTool> = {
  l: "line",
  a: "arc",
  i: "spline",
  r: "rectangle",
  c: "circle",
  g: "polygon",
  t: "trim",
};

export function resolveShortcut(key: string, mods: ShortcutMods, ctx: ShortcutContext): ShortcutAction {
  // 입력 중이거나 치수 편집 중엔 단축키가 위젯 입력을 가로채지 않게 전면 차단.
  if (ctx.typing || ctx.dimEditing) return null;
  const k = key.toLowerCase();

  if (mods.ctrl) {
    if (k === "z") return ctx.sketchActive ? { type: "undoSketchPoint" } : { type: "undo" };
    if (k === "a" && !ctx.sketchActive) return { type: "selectAll" };
    return null;
  }
  if (mods.shift || mods.alt) return null; // Shift 구속 핫키는 솔버 도입 후 (별도 에픽)

  if (key === "Escape") return ctx.sketchActive && ctx.sketchLineDrawing ? { type: "finishLine" } : null;

  if (ctx.sketchActive) {
    const tool = TOOL_KEYS[k];
    if (tool) return { type: "tool", tool };
  }
  return null;
}

/** keydown 을 store 액션으로 디스패치하는 마운트 훅. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useAppStore.getState();
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true;
      const action = resolveShortcut(
        e.key,
        { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey },
        { sketchActive: st.sketchActive, sketchLineDrawing: st.sketchLineDrawing, dimEditing: !!st.sketchDimEdit, typing },
      );
      if (!action) return;
      e.preventDefault();
      switch (action.type) {
        case "tool": st.setSketchTool(action.tool); break;
        case "undo": void st.undoLast(); break;
        case "undoSketchPoint": st.undoSketchPoint(); break;
        case "selectAll": st.selectAll(); break;
        case "finishLine": st.finishLine(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
