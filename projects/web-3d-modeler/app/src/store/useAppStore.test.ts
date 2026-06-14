import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, selectionBodyIds, type SelItem } from "./useAppStore";

const face = (shapeId: string, index: number): SelItem => ({ kind: "face", shapeId, index });
const body = (shapeId: string): SelItem => ({ kind: "body", shapeId, index: -1 });

describe("useAppStore — 통합 선택(면·모서리·바디)", () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
  });

  it("면 탭으로 추가/제거(토글)", () => {
    const { selectEntity } = useAppStore.getState();
    selectEntity(face("box-1", 0));
    expect(useAppStore.getState().selection).toEqual([face("box-1", 0)]);
    selectEntity(face("box-1", 0));
    expect(useAppStore.getState().selection).toEqual([]);
  });

  it("서로 다른 면은 다중 선택", () => {
    const { selectEntity } = useAppStore.getState();
    selectEntity(face("box-1", 0));
    selectEntity(face("box-1", 3));
    expect(useAppStore.getState().selection).toHaveLength(2);
  });

  it("selectionBodyIds: 면 선택에서 부모 바디를 도출 (불리언용)", () => {
    const { selectEntity } = useAppStore.getState();
    selectEntity(face("box-1", 0));
    selectEntity(face("cyl-2", 1));
    expect(selectionBodyIds(useAppStore.getState().selection)).toEqual(["box-1", "cyl-2"]);
  });

  it("같은 바디의 면 2개는 바디 1개로 집계", () => {
    const { selectEntity } = useAppStore.getState();
    selectEntity(face("box-1", 0));
    selectEntity(face("box-1", 2));
    expect(selectionBodyIds(useAppStore.getState().selection)).toEqual(["box-1"]);
  });

  it("additive=false 면 단일 선택으로 교체", () => {
    const { selectEntity } = useAppStore.getState();
    selectEntity(face("box-1", 0));
    selectEntity(body("cyl-2"), false);
    expect(useAppStore.getState().selection).toEqual([body("cyl-2")]);
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
