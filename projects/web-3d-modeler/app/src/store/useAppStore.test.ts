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
    expect(useAppStore.getState().sketchStrokes).toHaveLength(0);
  });

  it("사각형: 드래그 → 획으로 누적 (4점, 격자 스냅)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0.1, v: 0.1 });
    st.sketchDragMove({ u: 3.9, v: 2.1 });
    st.sketchDragEnd();
    const strokes = useAppStore.getState().sketchStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toHaveLength(4);
    expect(strokes[0]).toContainEqual({ u: 0, v: 0 });
    expect(strokes[0]).toContainEqual({ u: 4, v: 2 });
  });

  it("여러 도형을 그려도 기존 획이 사라지지 않는다", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 }); st.sketchDragMove({ u: 2, v: 2 }); st.sketchDragEnd();
    st.setSketchTool("circle"); // 도구 전환해도 기존 획 유지
    st.sketchDragStart({ u: 5, v: 5 }); st.sketchDragMove({ u: 7, v: 5 }); st.sketchDragEnd();
    expect(useAppStore.getState().sketchStrokes).toHaveLength(2);
  });

  it("선: 끝점 다시 클릭 → 현재 획 확정(누적), 새 클릭은 새 획 시작", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("line");
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 }); // 끝점 다시 → 확정
    expect(useAppStore.getState().sketchStrokes).toHaveLength(1);
    expect(useAppStore.getState().sketchLineDrawing).toBe(false);
    st.sketchClickPoint({ u: 9, v: 9 }); // 새 획 시작
    expect(useAppStore.getState().sketchLineDrawing).toBe(true);
    expect(useAppStore.getState().sketchPoints).toHaveLength(1);
    expect(useAppStore.getState().sketchStrokes).toHaveLength(1); // 기존 획 유지
  });

  it("선분 길이 설정: 확정 획의 선분을 정확한 길이로", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("line");
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 5, v: 0 });
    st.sketchClickPoint({ u: 5, v: 3 });
    st.finishLine(); // 획 확정 → strokes[0]
    st.setSegmentLength(0, 0, 10); // 획0의 0→1 선분을 10으로
    const stroke = useAppStore.getState().sketchStrokes[0]!;
    expect(stroke[1]).toEqual({ u: 10, v: 0 });
    expect(stroke[2]).toEqual({ u: 10, v: 3 });
  });

  it("타원: 드래그 → 닫힌 획 (가로·세로 반경)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("ellipse");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 2 });
    st.sketchDragEnd();
    const strokes = useAppStore.getState().sketchStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.length).toBeGreaterThan(8); // 폴리곤화
  });

  it("다각형: 드래그 → 6각형(6점)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("polygon");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 3, v: 0 });
    st.sketchDragEnd();
    const strokes = useAppStore.getState().sketchStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toHaveLength(6);
  });

  it("스케칭 종료 → 스케치 항목 저장, 도구 돌출 → 바디 생성", () => {
    const st = useAppStore.getState();
    st.clear();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 3 });
    st.sketchDragEnd();
    st.finishSketch();
    const after = useAppStore.getState();
    expect(after.sketchActive).toBe(false);
    expect(after.sketches).toHaveLength(1);
    expect(after.sketches[0]!.profiles).toHaveLength(1);
    expect(after.shapes).toHaveLength(0);
    const sk = after.sketches[0]!;
    st.selectEntity({ kind: "sketch", shapeId: sk.id, index: -1 });
    st.extrudeSketch(5);
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });
});
