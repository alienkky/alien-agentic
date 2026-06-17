import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore, selectionBodyIds, type SelItem } from "./useAppStore";
import { tessellateBox } from "../kernel/occt/boxMesh";

function makeRectSketch(): void {
  const st = useAppStore.getState();
  st.beginSketch();
  st.pickPlane("xz");
  st.setSketchTool("rectangle");
  st.sketchDragStart({ u: -1, v: -1 });
  st.sketchDragMove({ u: 1, v: 1 });
  st.sketchDragEnd();
  st.finishSketch();
  const sk = useAppStore.getState().sketches.at(-1)!;
  st.selectEntity({ kind: "sketch", shapeId: sk.id, index: -1 });
}

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

describe("useAppStore — Shapr3D식 돌출(빼기/합치기/새 바디)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  it("새 바디: 돌출체가 별도 바디로 추가", () => {
    const st = useAppStore.getState();
    makeRectSketch();
    st.extrudeSketchAs(5, "new");
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });

  it("빼기: 겹친 바디에서 깎고, 바디 수는 유지(도구 소비)", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(8, 8, 8, "box-1"), "박스"); // y -4..4, 중앙에 스케치 돌출이 관통
    makeRectSketch();
    const before = useAppStore.getState().shapes[0]!.indices.length;
    st.extrudeSketchAs(10, "cut");
    const after = useAppStore.getState();
    expect(after.shapes).toHaveLength(1); // 박스만 (돌출 도구는 빼기로 소비)
    expect(after.shapes[0]!.indices.length).not.toBe(before); // 가공됨
  });

  it("드래그 돌출: 시작→높이→확정 시 새 바디 생성", () => {
    const st = useAppStore.getState();
    makeRectSketch(); // 스케치 선택 상태
    st.startExtrudeDrag();
    expect(useAppStore.getState().extrudeDrag).not.toBeNull();
    expect(useAppStore.getState().gizmoDragging).toBe(true);
    st.setExtrudeDragHeight(6);
    expect(useAppStore.getState().extrudeDrag!.height).toBe(6);
    st.commitExtrudeDrag();
    const after = useAppStore.getState();
    expect(after.extrudeDrag).toBeNull();
    expect(after.gizmoDragging).toBe(false);
    expect(after.shapes).toHaveLength(1);
  });

  it("드래그 돌출: 격자 스냅 켜짐 → 0.5 단위, 음수는 최소 0.5", () => {
    const st = useAppStore.getState();
    makeRectSketch();
    st.startExtrudeDrag();
    st.setExtrudeDragHeight(3.3); // 0.5 단위로 스냅 → 3.5
    expect(useAppStore.getState().extrudeDrag!.height).toBe(3.5);
    st.setExtrudeDragHeight(-5); // 최소 0.5
    expect(useAppStore.getState().extrudeDrag!.height).toBe(0.5);
    st.cancelExtrudeDrag();
    expect(useAppStore.getState().extrudeDrag).toBeNull();
  });

  it("드래그 돌출: 격자 스냅 꺼짐 → 0.1 미만으로 안 내려감", () => {
    const st = useAppStore.getState();
    if (useAppStore.getState().snap.grid) st.toggleSnap("grid");
    makeRectSketch();
    st.startExtrudeDrag();
    st.setExtrudeDragHeight(-5);
    expect(useAppStore.getState().extrudeDrag!.height).toBe(0.1);
    st.toggleSnap("grid"); // 원복
  });

  it("빼기: 겹치는 바디 없으면 변화 없음", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-far"), "박스");
    // 멀리 떨어뜨려 겹치지 않게
    st.setTransform("box-far", [100, 0, 0]);
    makeRectSketch();
    st.extrudeSketchAs(5, "cut");
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });

  it("합치기: 겹친 바디에 흡수되어 바디 수 유지", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(8, 8, 8, "box-1"), "박스");
    makeRectSketch();
    st.extrudeSketchAs(10, "fuse");
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });
});

describe("useAppStore — 회전 모드(새/빼기/합치기)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  it("회전 새 바디: 스케치를 회전시켜 바디 추가", () => {
    const st = useAppStore.getState();
    makeRectSketch();
    st.revolveSketchAs(360, "v", "new");
    expect(useAppStore.getState().shapes.length).toBeGreaterThanOrEqual(1);
  });

  it("회전 빼기: 겹치는 바디 없으면 바디 수 유지", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "far"), "박스");
    st.setTransform("far", [100, 0, 0]);
    makeRectSketch();
    st.revolveSketchAs(360, "v", "cut");
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });
});

describe("useAppStore — 스케치 그리기 도구(호·스플라인·삭제)", () => {
  beforeEach(() => {
    useAppStore.getState().cancelSketch();
  });

  it("스플라인: 점 찍고 확정 → 곡선 획(점 증가)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("spline");
    st.sketchClickPoint({ u: 0, v: 0 });
    st.sketchClickPoint({ u: 3, v: 2 });
    st.sketchClickPoint({ u: 6, v: 0 });
    st.sketchClickPoint({ u: 6, v: 0 }); // 끝점 재클릭 → 확정
    const strokes = useAppStore.getState().sketchStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.length).toBeGreaterThan(10); // 곡선화
  });

  it("호: 3점 클릭 → 자동 확정(원호 폴리라인)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("arc");
    st.sketchClickPoint({ u: 1, v: 0 });
    st.sketchClickPoint({ u: 0, v: 1 });
    st.sketchClickPoint({ u: -1, v: 0 }); // 3점 → 자동 확정
    const strokes = useAppStore.getState().sketchStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.length).toBeGreaterThan(10);
  });

  it("삭제: 클릭한 획 제거", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 3 });
    st.sketchDragEnd();
    expect(useAppStore.getState().sketchStrokes).toHaveLength(1);
    st.setSketchTool("delete");
    st.deleteSketchStrokeAt({ u: 0, v: 0 });
    expect(useAppStore.getState().sketchStrokes).toHaveLength(0);
  });

  it("안내선 스냅: 두 번째 점이 첫 점과 수직 정렬로 스냅", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz"); // 자동 선 도구
    st.sketchClickPoint({ u: 2, v: 0 });
    st.sketchClickPoint({ u: 2.1, v: 5 }); // u≈2 → 수직 정렬 스냅
    const pts = useAppStore.getState().sketchPoints;
    expect(pts[1]!.u).toBe(2);
  });

  it("스케치 진입 시 기본 도구가 선(line)", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    expect(useAppStore.getState().sketchTool).toBe("line");
  });

  it("점 드래그: 선택한 점이 이동", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 4 });
    st.sketchDragEnd();
    st.startPointDrag(0, 0);
    expect(useAppStore.getState().sketchDraggingPoint).toEqual({ s: 0, i: 0 });
    st.movePointDrag({ u: 1, v: 1 });
    expect(useAppStore.getState().sketchStrokes[0]![0]).toEqual({ u: 1, v: 1 });
    st.endPointDrag();
    expect(useAppStore.getState().sketchDraggingPoint).toBeNull();
  });

  it("선분 드래그: 두 끝점이 함께 평행 이동", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 0, v: 0 });
    st.sketchDragMove({ u: 4, v: 4 });
    st.sketchDragEnd();
    // 사각형 획 [(0,0),(4,0),(4,4),(0,4)] — 선분 0 = (0,0)-(4,0)
    st.startSegDrag(0, 0, { u: 2, v: 0 });
    st.moveSegDrag({ u: 2, v: 3 }); // +v 3
    const stroke = useAppStore.getState().sketchStrokes[0]!;
    expect(stroke[0]).toEqual({ u: 0, v: 3 });
    expect(stroke[1]).toEqual({ u: 4, v: 3 });
    expect(stroke[2]).toEqual({ u: 4, v: 4 }); // 나머지 점은 그대로
    st.endSegDrag();
    expect(useAppStore.getState().sketchDraggingSeg).toBeNull();
  });
});

describe("useAppStore — 스케치 변형(미러·패턴·오프셋·투상)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  function drawRect(): void {
    const st = useAppStore.getState();
    st.beginSketch();
    st.pickPlane("xz");
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: 2, v: 2 });
    st.sketchDragMove({ u: 4, v: 4 });
    st.sketchDragEnd();
  }

  it("미러: 획이 반사 복제되어 2배", () => {
    drawRect();
    expect(useAppStore.getState().sketchStrokes).toHaveLength(1);
    useAppStore.getState().sketchMirror("v");
    expect(useAppStore.getState().sketchStrokes).toHaveLength(2);
  });

  it("선형 패턴: count배 만큼 획 증가", () => {
    drawRect();
    useAppStore.getState().sketchPatternLinear("u", 4, 5);
    expect(useAppStore.getState().sketchStrokes).toHaveLength(4); // 원본1 + 복제3
  });

  it("오프셋: 각 획마다 오프셋 획 추가", () => {
    drawRect();
    useAppStore.getState().sketchOffset(0.5);
    expect(useAppStore.getState().sketchStrokes).toHaveLength(2);
  });

  it("투상: 바디 모서리를 평면에 투영해 획 생성", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(4, 4, 4, "box-1"), "박스");
    st.beginSketch();
    st.pickPlane("xz");
    st.sketchProject();
    // 박스 모서리(12) 가 획으로
    expect(useAppStore.getState().sketchStrokes.length).toBeGreaterThanOrEqual(12);
  });
});

describe("useAppStore — 측정", () => {
  beforeEach(() => {
    useAppStore.getState().clearMeasure();
  });

  it("두 점 클릭 → 거리 계산, 세 번째 클릭은 새 측정 시작", () => {
    const st = useAppStore.getState();
    st.toggleMeasure();
    expect(useAppStore.getState().measureActive).toBe(true);
    st.addMeasurePoint([0, 0, 0]);
    st.addMeasurePoint([3, 4, 0]);
    expect(useAppStore.getState().measurePoints).toHaveLength(2);
    expect(useAppStore.getState().status).toContain("5.00"); // 3-4-5
    st.addMeasurePoint([1, 1, 1]); // 새 측정
    expect(useAppStore.getState().measurePoints).toHaveLength(1);
  });
});

describe("useAppStore — 패턴(선형·원형)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  it("선형 패턴: count-1 개 복제 추가", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-1"), "박스");
    st.selectEntity({ kind: "body", shapeId: "box-1", index: -1 });
    st.patternLinear("x", 4, 5);
    expect(useAppStore.getState().shapes).toHaveLength(4); // 원본 + 복제 3
  });

  it("원형 패턴: count-1 개 복제 추가", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-1"), "박스");
    st.setTransform("box-1", [5, 0, 0]); // 축에서 떨어뜨려 원형 배열
    st.selectEntity({ kind: "body", shapeId: "box-1", index: -1 });
    st.patternCircular("y", 6, 360);
    expect(useAppStore.getState().shapes).toHaveLength(6);
  });

  it("선택 바디 없으면 패턴 안 됨", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-1"), "박스");
    st.patternLinear("x", 3, 5);
    expect(useAppStore.getState().shapes).toHaveLength(1);
  });
});

describe("useAppStore — 바디 변형(회전·스케일·미러)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  function bbox(): { min: number[]; max: number[] } {
    const p = useAppStore.getState().shapes[0]!.positions;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, p[i + k]!); max[k] = Math.max(max[k]!, p[i + k]!); }
    return { min, max };
  }

  it("스케일: 중심 기준 2배 → 바운딩 2배 (바디 수 유지)", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-1"), "박스"); // -1..1
    st.selectEntity({ kind: "body", shapeId: "box-1", index: -1 });
    st.scaleBody(2);
    expect(useAppStore.getState().shapes).toHaveLength(1);
    const b = bbox();
    expect(b.max[0]! - b.min[0]!).toBeCloseTo(4, 4); // 2 → 4
  });

  it("회전: 바디 수 유지, 중심 보존(중심은 제자리)", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(4, 2, 2, "box-1"), "박스");
    st.selectEntity({ kind: "body", shapeId: "box-1", index: -1 });
    st.rotateBody("y", 90);
    const b = bbox();
    // 4x2x2 가 y축 90° → x폭 2, z폭 4
    expect(b.max[0]! - b.min[0]!).toBeCloseTo(2, 3);
    expect(b.max[2]! - b.min[2]!).toBeCloseTo(4, 3);
  });

  it("미러: 바디 수 유지, winding 뒤집혀도 유효(인덱스 길이 동일)", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(2, 2, 2, "box-1"), "박스");
    const before = useAppStore.getState().shapes[0]!.indices.length;
    st.selectEntity({ kind: "body", shapeId: "box-1", index: -1 });
    st.mirrorBody("x");
    expect(useAppStore.getState().shapes).toHaveLength(1);
    expect(useAppStore.getState().shapes[0]!.indices.length).toBe(before);
  });
});

describe("useAppStore — 면 위에 스케치(Sketch on Face)", () => {
  beforeEach(() => {
    void useAppStore.getState().clear();
    useAppStore.getState().cancelSketch();
  });

  it("면을 선택하고 스케치 시작 → 그 면의 법선·위치로 평면 생성", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(4, 4, 4, "box-1"), "박스"); // 면 2 = +Y (y=+2)
    st.selectEntity({ kind: "face", shapeId: "box-1", index: 2 });
    st.beginSketch();
    const plane = useAppStore.getState().sketchPlane;
    expect(plane).not.toBeNull();
    expect(plane!.normal[1]).toBeCloseTo(1, 5); // +Y
    expect(plane!.origin[1]).toBeCloseTo(2, 5); // 윗면 y=+2
  });

  it("면이 없으면 기준면 선택(평면 null)으로 진입", () => {
    const st = useAppStore.getState();
    st.beginSketch();
    expect(useAppStore.getState().sketchPlane).toBeNull();
  });

  it("면 위 스케치 → 저장된 스케치가 그 면 평면을 보존", () => {
    const st = useAppStore.getState();
    st.addMesh(tessellateBox(4, 4, 4, "box-1"), "박스");
    st.selectEntity({ kind: "face", shapeId: "box-1", index: 2 });
    st.beginSketch();
    st.setSketchTool("rectangle");
    st.sketchDragStart({ u: -1, v: -1 });
    st.sketchDragMove({ u: 1, v: 1 });
    st.sketchDragEnd();
    st.finishSketch();
    const sk = useAppStore.getState().sketches.at(-1)!;
    expect(sk.plane.normal[1]).toBeCloseTo(1, 5);
  });
});
