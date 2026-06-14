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

describe("useAppStore — 스케치 도구", () => {
  beforeEach(() => {
    useAppStore.getState().cancelSketch();
  });

  it("사각형: 두 모서리 탭 → 4점 프로파일 (격자 스냅)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("rectangle");
    st.sketchTap({ x: 0.1, z: 0.1 }); // → (0,0)
    expect(useAppStore.getState().sketchStart).toEqual({ x: 0, z: 0 });
    st.sketchTap({ x: 3.9, z: 2.1 }); // → (4,2)
    const pts = useAppStore.getState().sketchPoints;
    expect(pts).toHaveLength(4);
    expect(pts).toContainEqual({ x: 0, z: 0 });
    expect(pts).toContainEqual({ x: 4, z: 2 });
    expect(useAppStore.getState().sketchStart).toBeNull();
  });

  it("원: 중심+반지름 탭 → 48점", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("circle");
    st.sketchTap({ x: 0, z: 0 });
    st.sketchTap({ x: 3, z: 0 });
    expect(useAppStore.getState().sketchPoints).toHaveLength(48);
  });

  it("선: 탭마다 점 누적", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("line");
    st.sketchTap({ x: 0, z: 0 });
    st.sketchTap({ x: 2, z: 0 });
    st.sketchTap({ x: 2, z: 2 });
    expect(useAppStore.getState().sketchPoints).toHaveLength(3);
  });
});
