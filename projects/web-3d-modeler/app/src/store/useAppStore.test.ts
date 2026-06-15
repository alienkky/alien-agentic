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

  it("기준면 미선택이면 그릴 수 없다", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    expect(useAppStore.getState().sketchPlane).toBeNull();
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 2 });
    st.sketchDragEnd();
    expect(useAppStore.getState().sketchPoints).toHaveLength(0);
  });

  it("사각형: 평면 선택 후 드래그 → 4점 프로파일 (격자 스냅)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0.1, v: 0.1 }); // → (0,0)
    st.sketchDragMove({ u: 3.9, v: 2.1 }); // → (4,2)
    st.sketchDragEnd();
    const pts = useAppStore.getState().sketchPoints;
    expect(pts).toHaveLength(4);
    expect(pts).toContainEqual({ u: 0, v: 0 });
    expect(pts).toContainEqual({ u: 4, v: 2 });
    expect(useAppStore.getState().sketchDraft).toBeNull();
  });

  it("원: 평면 선택 후 중심에서 드래그 → 48점", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xy");
    st.setSketchTool("circle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 3, v: 0 });
    st.sketchDragEnd();
    expect(useAppStore.getState().sketchPoints).toHaveLength(48);
  });

  it("선: 끝점 다시 클릭 → 그리기 종료(선택 모드), 점 추가 안 됨", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("line");
    expect(useAppStore.getState().sketchLineDrawing).toBe(true);
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 }); // 끝점 다시 클릭 → 종료
    expect(useAppStore.getState().sketchLineDrawing).toBe(false);
    expect(useAppStore.getState().sketchPoints).toHaveLength(2);
    // 종료 후엔 점이 더 안 늘어난다
    st.sketchClickPoint({ u: 9, v: 9 });
    expect(useAppStore.getState().sketchPoints).toHaveLength(2);
  });

  it("선분 길이 설정: 방향 유지하며 정확한 길이로 (이후 점 동반 이동)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("line");
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 }); // 길이 5
    st.sketchClickPoint({ u: 5, v: 3 });
    st.setSegmentLength(0, 10); // 0→1 구간을 10으로
    const pts = useAppStore.getState().sketchPoints;
    expect(pts[1]).toEqual({ u: 10, v: 0 });
    expect(pts[2]).toEqual({ u: 10, v: 3 }); // 뒤 점도 +5 이동
  });

  it("선: 클릭마다 점 누적", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("yz");
    st.setSketchTool("line");
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 2, v: 0 });
    st.sketchClickPoint({ u: 2, v: 2 });
    expect(useAppStore.getState().sketchPoints).toHaveLength(3);
  });
});
