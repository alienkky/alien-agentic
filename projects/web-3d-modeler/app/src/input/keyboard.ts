/**
 * 키보드 단축키 (Shapr3D 식). 스케치 도구 전환 + 일반 모드 동작.
 * 입력칸(치수·다이얼로그)에 포커스가 있으면 무시한다.
 */
import { useEffect } from "react";
import { useAppStore, selectionBodyIds, type SketchTool } from "../store/useAppStore";
import type { ViewPreset } from "../viewport/cameraMath";
import type { ConstraintKind } from "../kernel/sketchConstraints";

/** 숫자키 → 표준 뷰 (Shapr3D 식). 없으면 null. */
export function viewForKey(key: string): ViewPreset | null {
  const m: Record<string, ViewPreset> = {
    "1": "iso",
    "2": "front",
    "3": "back",
    "4": "top",
    "5": "bottom",
    "6": "right",
    "7": "left",
  };
  return m[key] ?? null;
}

/** 스케치 도구 단축키 매핑 (소문자 키 → 도구). 없으면 null. */
export function sketchToolForKey(key: string): SketchTool | null {
  const m: Record<string, SketchTool> = {
    l: "line",
    a: "arc",
    i: "spline",
    r: "rectangle",
    c: "circle",
    g: "polygon",
    t: "trim",
  };
  return m[key.toLowerCase()] ?? null;
}

/** Shift+키 → 구속조건 (스케치 모드). 없으면 null. */
export function sketchConstraintForKey(key: string): ConstraintKind | null {
  const m: Record<string, ConstraintKind> = {
    h: "horizontal",
    v: "vertical",
    a: "parallel",
    p: "perpendicular",
    e: "equal",
    n: "coincident",
  };
  return m[key.toLowerCase()] ?? null;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;

      const st = useAppStore.getState();
      const key = e.key;
      const low = key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (st.sketchActive) {
        // Shift+키 = 구속조건 (도구 단축키보다 먼저 — Shift+A 가 'arc' 로 새지 않게)
        if (e.shiftKey && !mod) {
          const con = sketchConstraintForKey(key);
          if (con) { st.applySketchConstraint(con); e.preventDefault(); return; }
        }
        const tool = sketchToolForKey(key);
        if (tool) { st.setSketchTool(tool); e.preventDefault(); return; }
        if (low === "o") { st.openSketchTransform("offset"); e.preventDefault(); return; }
        if (low === "p") { st.sketchProject(); e.preventDefault(); return; }
        if (key === "Escape") {
          // 그리는 중이면 현재 선 확정, 아니면 스케칭 종료
          if (st.sketchLineDrawing) st.finishLine();
          else st.finishSketch();
          e.preventDefault();
          return;
        }
        if (key === "Delete" || key === "Backspace") { st.setSketchTool("delete"); e.preventDefault(); return; }
        return;
      }

      // 일반 모드
      if (mod && low === "z") { void st.undoLast(); e.preventDefault(); return; }
      const view = viewForKey(key);
      if (view && !mod) { st.setView(view); e.preventDefault(); return; }
      if (key === "Escape") { st.clearSelection(); e.preventDefault(); return; }
      if (key === "Delete" || key === "Backspace") {
        const ids = selectionBodyIds(st.selection);
        if (ids.length) { ids.forEach((id) => void st.removeShape(id)); e.preventDefault(); }
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
