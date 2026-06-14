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

  it("사각형: 드래그 → 4점 프로파일 (격자 스냅)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("rectangle");
    st.sketchDragStart({ x: 0.1, z: 0.1 }); // → (0,0)
    st.sketchDragMove({ x: 3.9, z: 2.1 }); // → (4,2)
    st.sketchDragEnd();
    const pts = useAppStore.getState().sketchPoints;
    expect(pts).toHaveLength(4);
    expect(pts).toContainEqual({ x: 0, z: 0 });
    expect(pts).toContainEqual({ x: 4, z: 2 });
    expect(useAppStore.getState().sketchDraft).toBeNull();
  });

  it("원: 중심에서 드래그 → 48점", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("circle");
    st.sketchDragStart({ x: 0, z: 0 });
    st.sketchDragMove({ x: 3, z: 0 });
    st.sketchDragEnd();
    expect(useAppStore.getState().sketchPoints).toHaveLength(48);
  });

  it("너무 작은 드래그는 프로파일을 만들지 않는다", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("rectangle");
    st.sketchDragStart({ x: 0, z: 0 });
    st.sketchDragMove({ x: 0, z: 0 });
    st.sketchDragEnd();
    expect(useAppStore.getState().sketchPoints).toHaveLength(0);
  });

  it("선: 클릭마다 점 누적", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.setSketchTool("line");
    st.sketchClickPoint({ x: 0, z: 0 });
    st.sketchClickPoint({ x: 2, z: 0 });
    st.sketchClickPoint({ x: 2, z: 2 });
    expect(useAppStore.getState().sketchPoints).toHaveLength(3);
  });
});
