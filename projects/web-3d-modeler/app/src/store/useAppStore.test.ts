import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./useAppStore";

describe("useAppStore — 셰이프 선택(불리언) 로직", () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
  });

  it("토글로 추가/제거", () => {
    const { toggleShapeSelection } = useAppStore.getState();
    toggleShapeSelection("box-1");
    expect(useAppStore.getState().selectedShapeIds).toEqual(["box-1"]);
    toggleShapeSelection("box-1");
    expect(useAppStore.getState().selectedShapeIds).toEqual([]);
  });

  it("최대 2개 — 3번째는 가장 오래된 것을 밀어낸다", () => {
    const { toggleShapeSelection } = useAppStore.getState();
    toggleShapeSelection("a");
    toggleShapeSelection("b");
    toggleShapeSelection("c");
    expect(useAppStore.getState().selectedShapeIds).toEqual(["b", "c"]);
  });

  it("순서 보존 (대상 → 도구)", () => {
    const { toggleShapeSelection } = useAppStore.getState();
    toggleShapeSelection("target");
    toggleShapeSelection("tool");
    expect(useAppStore.getState().selectedShapeIds).toEqual(["target", "tool"]);
  });
});
