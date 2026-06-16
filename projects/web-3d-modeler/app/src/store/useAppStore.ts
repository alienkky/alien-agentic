/**
 * 앱 상태 (Zustand). 카메라·셰이프·선택·커널 백엔드·상태 메시지.
 * 커널 워커 핸들은 여기서 소유하고, 모든 커널 호출은 브릿지를 경유한다.
 */
import { create } from "zustand";
import { createKernelClient, type KernelHandle } from "../kernel/bridge";
import type { KernelBackend } from "../kernel/worker";
import type { TessellatedMesh, BooleanOp } from "../kernel/types";
import { meshBoolean } from "../kernel/meshBoolean";
import { extrudeProfile } from "../kernel/extrude";
import { revolveProfile, type RevolveAxis } from "../kernel/revolve";
import { translateMesh, rotateMeshAxis, scaleMesh, mirrorMesh, centroidOf } from "../kernel/transformMesh";
import { meshAabb, aabbOverlap } from "../kernel/aabb";
import { parseStl } from "../kernel/stlImport";
import { SKETCH_PLANES, planeFromFace, worldToPlane, type PlaneId, type SketchPoint, type SketchPlaneDef } from "../kernel/sketchPlane";
import { trimAt, nearestStrokeIndex } from "../kernel/sketchTrim";
import { catmullRom, arc3 } from "../kernel/sketchCurves";
import { mirrorStrokes, patternLinearStrokes, patternCircularStrokes, offsetStroke, type UVAxis } from "../kernel/sketchTransform2d";
import {
  defaultCamera,
  orbit as orbitCam,
  pan as panCam,
  zoom as zoomCam,
  viewPreset,
  alignToNormal,
  type CameraState,
  type ViewPreset,
} from "../viewport/cameraMath";

export interface FaceRef {
  shapeId: string;
  faceId: number;
}

/** 통합 선택 항목 — 바디/면/모서리/스케치. (body·sketch 는 index = -1) */
export type SelKind = "body" | "face" | "edge" | "sketch";
export interface SelItem {
  kind: SelKind;
  shapeId: string;
  index: number;
}

export function selectionBodyIds(sel: SelItem[]): string[] {
  return [...new Set(sel.filter((s) => s.kind !== "sketch").map((s) => s.shapeId))];
}

function sameSel(a: SelItem, b: SelItem): boolean {
  return a.kind === b.kind && a.shapeId === b.shapeId && a.index === b.index;
}

export type PrimitiveKind = "box" | "cylinder" | "sphere";
export type SketchTool = "rectangle" | "circle" | "line" | "ellipse" | "polygon" | "trim" | "spline" | "arc" | "delete";
/** 점을 순서대로 찍어 그리는 도구 (선·스플라인·호) */
const isPointTool = (t: SketchTool): boolean => t === "line" || t === "spline" || t === "arc";
/** 돌출 방식 (Shapr3D식): 새 바디 / 겹친 바디에서 빼기 / 겹친 바디에 합치기. */
export type ExtrudeMode = "new" | "cut" | "fuse";
/** 패턴 축 (선형 방향 / 원형 회전축) */
export type Axis3 = "x" | "y" | "z";
const AXIS_VEC: Record<Axis3, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** 저장된 스케치 (독립 항목). 여러 프로파일(획)을 가질 수 있다. 도구→돌출 입력. */
export interface SketchEntity {
  id: string;
  /** 표준평면 또는 면 위 평면 (def 통째 보관) */
  plane: SketchPlaneDef;
  profiles: SketchPoint[][];
}

const SNAP = 0.5; // 격자 스냅 간격
const snap = (v: number): number => Math.round(v / SNAP) * SNAP;

function circlePolygon(center: SketchPoint, radius: number, segments = 48): SketchPoint[] {
  const pts: SketchPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ u: center.u + radius * Math.cos(a), v: center.v + radius * Math.sin(a) });
  }
  return pts;
}

/** 타원: 중심에서 반장축(ru)·반단축(rv) 으로 폴리곤화. */
export function ellipsePolygon(center: SketchPoint, ru: number, rv: number, segments = 48): SketchPoint[] {
  const pts: SketchPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ u: center.u + ru * Math.cos(a), v: center.v + rv * Math.sin(a) });
  }
  return pts;
}

/** 정다각형: 중심에서 반지름 radius, 꼭짓점 sides 개. 위쪽(+v)을 첫 꼭짓점으로. */
export function regularPolygon(center: SketchPoint, radius: number, sides = 6): SketchPoint[] {
  const pts: SketchPoint[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / 2;
    pts.push({ u: center.u + radius * Math.cos(a), v: center.v + radius * Math.sin(a) });
  }
  return pts;
}

/** 기본 정다각형 변의 수 (육각형). 향후 도구 옵션으로 조정. */
export const POLYGON_SIDES = 6;

const PLANE_VIEW: Record<PlaneId, "top" | "front" | "right"> = { xz: "top", xy: "front", yz: "right" };

/** 획이 유효한가 — 선은 2점 이상, 닫힌 도형은 3점 이상. */
function strokeValid(pts: SketchPoint[], tool: SketchTool): boolean {
  if (tool === "line" || tool === "spline") return pts.length >= 2;
  if (tool === "arc") return pts.length >= 3;
  return pts.length >= 3;
}

/** 찍은 제어점들을 도구에 맞는 최종 폴리라인으로 — 스플라인은 곡선화, 호는 3점 원호. */
function finalizeStroke(pts: SketchPoint[], tool: SketchTool): SketchPoint[] {
  if (tool === "spline") return catmullRom(pts);
  if (tool === "arc" && pts.length >= 3) return arc3(pts[0]!, pts[1]!, pts[2]!);
  return pts;
}

export type Vec3 = [number, number, number];

interface AppState {
  camera: CameraState;
  shapes: TessellatedMesh[];
  /** 저장된 스케치 항목들 (독립) */
  sketches: SketchEntity[];
  /** 셰이프별 위치 오프셋 (이동 기즈모). 없으면 원점. */
  transforms: Record<string, Vec3>;
  hovered: FaceRef | null;
  /** 통합 선택: 면·모서리·바디 (탭으로 토글, 다중 선택) */
  selection: SelItem[];
  /** 이동 기즈모 드래그 중 — 카메라 입력을 막는다 */
  gizmoDragging: boolean;
  /** 스케치 모드 활성 여부 */
  sketchActive: boolean;
  /** 선택된 기준면 (표준평면 또는 면 위 평면). null 이면 "활성 평면 없음" */
  sketchPlane: SketchPlaneDef | null;
  /** 현재 스케치 도구 */
  sketchTool: SketchTool;
  /** 사각형·원 드래그 초안 (평면 (u,v)). 드래그 중 실시간 미리보기 */
  sketchDraft: { start: SketchPoint; current: SketchPoint } | null;
  /** 커서 위치 (선 도구 미리보기용, (u,v)) */
  sketchHover: SketchPoint | null;
  /** 현재 그리는 중인 획의 점들 (평면 (u,v)) */
  sketchPoints: SketchPoint[];
  /** 이 스케치 안에서 이미 그린 획들 (누적) */
  sketchStrokes: SketchPoint[][];
  /** 치수 편집 중인 선분 (stroke 획 인덱스, seg 선분 인덱스) */
  sketchSelectedSeg: { s: number; i: number } | null;
  /** 선을 적극적으로 그리는 중인지 (false 면 선택 모드) */
  sketchLineDrawing: boolean;
  /** 내역(History) — 단계별 작업 로그 (우측 패널). 명세 Module 1.2 토대 */
  history: { id: string; label: string }[];
  /** 돌출 다이얼로그 열림 여부 (Shapr3D식 높이·모드 입력) */
  extrudeOpen: boolean;
  /** 회전 다이얼로그 열림 여부 (각도·축 입력) */
  revolveOpen: boolean;
  /** 돌출 드래그 세션 (스케치 핸들을 끌어 실시간 높이). null 이면 비활성 */
  extrudeDrag: { sketchId: string; height: number } | null;
  /** 패턴 다이얼로그 열림 여부 */
  patternOpen: boolean;
  /** 바디 변형 다이얼로그 모드 (null 이면 닫힘) */
  transformMode: "rotate" | "scale" | "mirror" | null;
  backend: KernelBackend;
  status: string;
  busy: boolean;

  orbit: (dxPx: number, dyPx: number) => void;
  pan: (dxPx: number, dyPx: number) => void;
  zoom: (factor: number) => void;
  resetCamera: () => void;
  setView: (view: ViewPreset) => void;

  initKernel: () => Promise<void>;
  setBackend: (backend: KernelBackend) => Promise<void>;
  addPrimitive: (kind: PrimitiveKind) => Promise<void>;
  /** 외부에서 만든 메시(데모·가져오기)를 바디로 추가. */
  addMesh: (mesh: TessellatedMesh, label: string) => void;
  booleanOp: (op: BooleanOp) => Promise<void>;
  removeShape: (shapeId: string) => Promise<void>;
  undoLast: () => Promise<void>;
  clear: () => Promise<void>;

  setStatus: (msg: string) => void;
  /** 디스플레이 모드 (뷰 메뉴) */
  displayMode: "shaded" | "wireframe" | "xray";
  setDisplayMode: (mode: "shaded" | "wireframe" | "xray") => void;
  /** 사이드바 표시 (뷰 메뉴 토글) */
  panels: { items: boolean; history: boolean };
  togglePanel: (p: "items" | "history") => void;
  /** 에지(모서리) 표시 (우클릭 메뉴 토글) */
  showEdges: boolean;
  toggleEdges: () => void;
  /** 그리드 · 월드 축 표시 */
  showGrid: boolean;
  showAxes: boolean;
  toggleGrid: () => void;
  toggleAxes: () => void;
  /** 숨겨진 바디 id 목록 + 가시성 제어 */
  hidden: string[];
  hideSelectedBodies: () => void;
  showAllBodies: () => void;
  invertBodyVisibility: () => void;
  /** 스냅 설정 (우상단 팝업). grid=격자 스냅 실제 적용, 나머지는 가이드 표시 */
  snap: {
    grid: boolean;
    sketchLine: boolean;
    sketchPoint: boolean;
    guide3d: boolean;
    farEdge: boolean;
    guidePoint: boolean;
    snapHint: boolean;
  };
  toggleSnap: (key: "grid" | "sketchLine" | "sketchPoint" | "guide3d" | "farEdge" | "guidePoint" | "snapHint") => void;
  /** 모든 바디 선택 */
  selectAll: () => void;
  /** 단위 (단위 팝업) */
  unit: "mm" | "cm" | "m" | "in" | "ft";
  setUnit: (u: "mm" | "cm" | "m" | "in" | "ft") => void;
  /** 구속조건 설정 (스케치 구속 팝업) */
  sketchPrefs: { auto: boolean; showConstraints: boolean; showDims: boolean; anchor: "first" | "last" };
  setSketchPref: (patch: Partial<{ auto: boolean; showConstraints: boolean; showDims: boolean; anchor: "first" | "last" }>) => void;
  setHovered: (ref: FaceRef | null) => void;
  /** 항목 선택 토글 (탭). additive=false 면 단일 선택으로 교체 */
  selectEntity: (item: SelItem, additive?: boolean) => void;
  clearSelection: () => void;
  setTransform: (shapeId: string, pos: Vec3) => void;
  setGizmoDragging: (dragging: boolean) => void;

  beginSketch: () => void;
  pickPlane: (id: PlaneId) => void;
  setSketchTool: (tool: SketchTool) => void;
  /** 사각형·원: 드래그 시작 / 이동 / 종료. 선: 점 클릭 */
  sketchDragStart: (p: SketchPoint) => void;
  sketchDragMove: (p: SketchPoint) => void;
  sketchDragEnd: () => void;
  sketchClickPoint: (p: SketchPoint) => void;
  /** 자르기: 클릭 지점 근처 선분을 교차점 기준으로 잘라낸다 */
  trimSketchAt: (uv: SketchPoint) => void;
  /** 삭제: 클릭 지점 근처 획을 통째로 제거 */
  deleteSketchStrokeAt: (uv: SketchPoint) => void;
  /** 점 편집 — 선택/드래그 이동 */
  sketchSelectedPoint: { s: number; i: number } | null;
  sketchDraggingPoint: { s: number; i: number } | null;
  startPointDrag: (s: number, i: number) => void;
  movePointDrag: (uv: SketchPoint) => void;
  endPointDrag: () => void;
  /** 스케치 변형 다이얼로그 모드 (null=닫힘) */
  sketchTransformMode: "mirror" | "pattern" | "offset" | null;
  openSketchTransform: (mode: "mirror" | "pattern" | "offset") => void;
  closeSketchTransform: () => void;
  /** 스케치 변형 — 모두 확정 획(sketchStrokes)에 적용 */
  sketchMirror: (axis: UVAxis) => void;
  sketchPatternLinear: (axis: UVAxis, count: number, spacing: number) => void;
  sketchPatternCircular: (count: number, angleDeg: number) => void;
  sketchOffset: (dist: number) => void;
  /** 투상: 바디 모서리를 현재 스케치 평면에 투영해 획으로 */
  sketchProject: () => void;
  /** 선분 치수 편집 선택 / 길이 설정 / 해제 */
  selectSketchSegment: (s: number, i: number) => void;
  setSegmentLength: (s: number, i: number, len: number) => void;
  clearSketchSegment: () => void;
  /** 선 그리기 종료 → 선택 모드 */
  finishLine: () => void;
  undoSketchPoint: () => void;
  cancelSketch: () => void;
  /** 스케치 종료 → 유효 프로파일이면 항목으로 저장 */
  finishSketch: () => void;
  /** 선택된 스케치를 돌출 (도구→돌출, 기본 새 바디) */
  extrudeSketch: (depth: number) => void;
  /** Shapr3D식 돌출: 높이 + 모드(새 바디/빼기/합치기). 빼기·합치기는 겹친 바디에 적용 */
  extrudeSketchAs: (depth: number, mode: ExtrudeMode) => void;
  /** 돌출 다이얼로그 열기/닫기 */
  openExtrude: () => void;
  closeExtrude: () => void;
  /** 돌출 드래그: 시작 / 높이 갱신 / 확정 / 취소 */
  startExtrudeDrag: () => void;
  setExtrudeDragHeight: (h: number) => void;
  commitExtrudeDrag: () => void;
  cancelExtrudeDrag: () => void;
  /** 선택된 스케치를 회전체로 (도구→회전). 모드: 새 바디/빼기/합치기 */
  revolveSketchAs: (angleDeg: number, axis: RevolveAxis, mode: ExtrudeMode) => void;
  /** 회전 다이얼로그 열기/닫기 */
  openRevolve: () => void;
  closeRevolve: () => void;
  /** STL 파일 불러오기 → 바디로 추가 */
  importStl: (buffer: ArrayBuffer, name: string) => void;

  /** 선형 패턴: 선택 바디를 axis 방향으로 count개, spacing 간격 복제 */
  patternLinear: (axis: Axis3, count: number, spacing: number) => void;
  /** 원형 패턴: 선택 바디를 axis 둘레로 count개, 총 angleDeg 각도에 복제 */
  patternCircular: (axis: Axis3, count: number, angleDeg: number) => void;
  openPattern: () => void;
  closePattern: () => void;

  /** 바디 변형 — 모두 바디 중심 기준 제자리 변형 (선택 바디 대상) */
  rotateBody: (axis: Axis3, angleDeg: number) => void;
  scaleBody: (factor: number) => void;
  mirrorBody: (axis: Axis3) => void;
  openTransform: (mode: "rotate" | "scale" | "mirror") => void;
  closeTransform: () => void;

  /** 측정 도구 — 두 점을 클릭하면 거리 표시 */
  measureActive: boolean;
  measurePoints: Vec3[];
  toggleMeasure: () => void;
  addMeasurePoint: (p: Vec3) => void;
  clearMeasure: () => void;
}

let kernel: KernelHandle | null = null;
let counter = 0;

const BOOL_LABEL: Record<BooleanOp, string> = {
  fuse: "합치기",
  cut: "빼기",
  common: "교집합",
};

/**
 * 돌출·회전 공통 — 만들어진 공구 솔리드(tools)를 기존 바디에 cut/fuse 한다.
 * 공구와 AABB 가 겹치는 바디에만 불리언을 건다. 합치기에서 어디와도 안 겹친 공구는 새 바디로.
 * 반환: 갱신된 shapes·transforms·가공된 곳 수(affected).
 */
function combineTools(
  shapes: TessellatedMesh[],
  transformsIn: Record<string, Vec3>,
  tools: TessellatedMesh[],
  mode: "cut" | "fuse",
): { shapes: TessellatedMesh[]; transforms: Record<string, Vec3>; affected: number } {
  const op: BooleanOp = mode === "cut" ? "cut" : "fuse";
  const toolBoxes = tools.map((t) => ({ t, box: meshAabb(t) }));
  const consumed = new Set<TessellatedMesh>();
  const transforms = { ...transformsIn };
  const nextShapes: TessellatedMesh[] = [];
  let affected = 0;
  for (const body of shapes) {
    let acc = body;
    let baked = false; // 첫 불리언 후엔 오프셋이 좌표에 구워짐
    const off = (): Vec3 => (baked ? [0, 0, 0] : transformsIn[body.shapeId] ?? [0, 0, 0]);
    for (const { t, box } of toolBoxes) {
      if (mode === "fuse" && consumed.has(t)) continue;
      if (!aabbOverlap(meshAabb(acc, off()), box)) continue;
      acc = meshBoolean(acc, t, op, `${mode}-${++counter}`, off(), [0, 0, 0]);
      baked = true;
      affected++;
      if (mode === "fuse") consumed.add(t);
    }
    if (baked) delete transforms[body.shapeId];
    nextShapes.push(acc);
  }
  if (mode === "fuse") for (const { t } of toolBoxes) if (!consumed.has(t)) nextShapes.push(t);
  return { shapes: nextShapes, transforms, affected };
}

export const useAppStore = create<AppState>((set, get) => ({
  camera: defaultCamera(),
  shapes: [],
  sketches: [],
  transforms: {},
  hovered: null,
  selection: [],
  gizmoDragging: false,
  sketchActive: false,
  sketchPlane: null,
  sketchTool: "rectangle",
  sketchDraft: null,
  sketchHover: null,
  sketchPoints: [],
  sketchStrokes: [],
  sketchSelectedSeg: null,
  sketchLineDrawing: false,
  sketchTransformMode: null,
  sketchSelectedPoint: null,
  sketchDraggingPoint: null,
  history: [],
  extrudeOpen: false,
  revolveOpen: false,
  extrudeDrag: null,
  patternOpen: false,
  transformMode: null,
  measureActive: false,
  measurePoints: [],
  displayMode: "shaded",
  panels: { items: true, history: true },
  showEdges: true,
  showGrid: true,
  showAxes: true,
  hidden: [],
  snap: { grid: true, sketchLine: true, sketchPoint: true, guide3d: true, farEdge: true, guidePoint: true, snapHint: true },
  unit: "mm",
  sketchPrefs: { auto: true, showConstraints: false, showDims: true, anchor: "first" },
  backend: "deterministic",
  status: "초기화 중…",
  busy: false,

  orbit: (dxPx, dyPx) => set((s) => ({ camera: orbitCam(s.camera, dxPx, dyPx) })),
  pan: (dxPx, dyPx) => set((s) => ({ camera: panCam(s.camera, dxPx, dyPx) })),
  zoom: (factor) => set((s) => ({ camera: zoomCam(s.camera, factor) })),
  resetCamera: () => set({ camera: defaultCamera() }),
  setView: (view) => set((s) => ({ camera: viewPreset(s.camera, view) })),

  initKernel: async () => {
    if (kernel || typeof Worker === "undefined") return;
    kernel = createKernelClient();
    await kernel.client.ready();
    const backend = await kernel.client.getBackend();
    set({ backend, status: "커널 준비됨 — 프리미티브를 추가해보세요" });
  },

  setBackend: async (backend) => {
    if (!kernel) return;
    await kernel.client.setBackend(backend);
    set({
      backend,
      status:
        backend === "occt"
          ? "OCCT(B-rep) 백엔드 — 불리언 가능 (디바이스 검증 대상)"
          : "결정론적 백엔드 — 전 디바이스 동작 (불리언은 OCCT 필요)",
    });
  },

  addPrimitive: async (kind) => {
    if (!kernel || get().busy) return;
    set({ busy: true, status: `${kind} 생성 중…` });
    try {
      const shapeId = `${kind}-${++counter}`;
      let mesh: TessellatedMesh;
      if (kind === "box") {
        mesh = await kernel.client.makeBox({ width: 4, height: 4, depth: 4 }, shapeId);
      } else if (kind === "cylinder") {
        mesh = await kernel.client.makeCylinder({ radius: 1.5, height: 6 }, shapeId);
      } else {
        mesh = await kernel.client.makeSphere({ radius: 2.5 }, shapeId);
      }
      const kindLabel = kind === "box" ? "박스" : kind === "cylinder" ? "실린더" : "구";
      set((s) => ({
        shapes: [...s.shapes, mesh],
        history: [...s.history, { id: shapeId, label: `${kindLabel} 추가` }],
        status: `${shapeId} 추가됨 · 면 ${mesh.faceRanges.length} · 모서리 ${mesh.edges.length}`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  addMesh: (mesh, label) =>
    set((s) => ({
      shapes: [...s.shapes, mesh],
      history: [...s.history, { id: mesh.shapeId, label }],
      status: `${label} 추가됨 · 면 ${mesh.faceRanges.length} · 삼각형 ${mesh.indices.length / 3}`,
    })),

  booleanOp: async (op) => {
    const bodies = selectionBodyIds(get().selection);
    if (get().busy) return;
    if (bodies.length < 2) {
      set({ status: "불리언: 서로 다른 바디 2개를 선택하세요 (대상 → 도구)" });
      return;
    }
    const idA = bodies[0]!;
    const idB = bodies[1]!;
    const a = get().shapes.find((m) => m.shapeId === idA);
    const b = get().shapes.find((m) => m.shapeId === idB);
    if (!a || !b) {
      set({ status: "불리언: 선택한 셰이프를 찾을 수 없습니다" });
      return;
    }
    set({ busy: true, status: `${BOOL_LABEL[op]} 중…` });
    try {
      const resultId = `bool-${++counter}`;
      const t = get().transforms;
      // OCCT 모드면 진짜 B-rep 불리언(워커), 아니면 메시 CSG(메인 스레드).
      // 메시 CSG 는 이동 기즈모 오프셋을 월드 변환으로 반영한다.
      const mesh =
        get().backend === "occt" && kernel
          ? await kernel.client.boolean(op, idA, idB, resultId)
          : meshBoolean(a, b, op, resultId, t[idA] ?? [0, 0, 0], t[idB] ?? [0, 0, 0]);
      set((s) => {
        const transforms = { ...s.transforms };
        delete transforms[idA];
        delete transforms[idB];
        return {
          shapes: [...s.shapes.filter((m) => m.shapeId !== idA && m.shapeId !== idB), mesh],
          transforms,
          selection: [],
          history: [...s.history, { id: resultId, label: `${BOOL_LABEL[op]}` }],
          status: `${BOOL_LABEL[op]} 완료 → ${resultId}`,
        };
      });
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  removeShape: async (shapeId) => {
    if (kernel) await kernel.client.deleteShape(shapeId);
    set((s) => {
      const transforms = { ...s.transforms };
      delete transforms[shapeId];
      return {
        shapes: s.shapes.filter((m) => m.shapeId !== shapeId),
        selection: s.selection.filter((it) => it.shapeId !== shapeId),
        hovered: s.hovered?.shapeId === shapeId ? null : s.hovered,
        transforms,
        status: `${shapeId} 삭제`,
      };
    });
  },

  undoLast: async () => {
    const last = get().shapes[get().shapes.length - 1];
    if (!last) return;
    await get().removeShape(last.shapeId);
    set({ status: `실행취소 — ${last.shapeId} 제거` });
  },

  clear: async () => {
    if (kernel) {
      for (const m of get().shapes) {
        await kernel.client.deleteShape(m.shapeId);
      }
    }
    set({ shapes: [], sketches: [], transforms: {}, hovered: null, selection: [], history: [], hidden: [], status: "비움" });
  },

  setStatus: (msg) => set({ status: msg }),
  setDisplayMode: (mode) => set({ displayMode: mode, status: `디스플레이: ${mode}` }),
  togglePanel: (p) => set((s) => ({ panels: { ...s.panels, [p]: !s.panels[p] } })),
  toggleEdges: () => set((s) => ({ showEdges: !s.showEdges, status: `에지 표시: ${!s.showEdges ? "켜짐" : "꺼짐"}` })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  hideSelectedBodies: () =>
    set((s) => {
      const ids = selectionBodyIds(s.selection);
      return { hidden: [...new Set([...s.hidden, ...ids])], selection: [], status: `${ids.length}개 바디 숨김` };
    }),
  showAllBodies: () => set({ hidden: [], status: "모든 바디 표시" }),
  invertBodyVisibility: () =>
    set((s) => ({ hidden: s.shapes.filter((m) => !s.hidden.includes(m.shapeId)).map((m) => m.shapeId), status: "바디 표시 반전" })),
  toggleSnap: (key) => set((s) => ({ snap: { ...s.snap, [key]: !s.snap[key] } })),
  setUnit: (u) => set({ unit: u, status: `단위: ${u}` }),
  setSketchPref: (patch) => set((s) => ({ sketchPrefs: { ...s.sketchPrefs, ...patch } })),
  selectAll: () =>
    set((s) => ({
      selection: s.shapes.map((m) => ({ kind: "body" as const, shapeId: m.shapeId, index: -1 })),
      status: `모두 선택 (${s.shapes.length})`,
    })),
  setHovered: (ref) => set({ hovered: ref }),

  selectEntity: (item, additive = true) =>
    set((s) => {
      const exists = s.selection.some((it) => sameSel(it, item));
      let next: SelItem[];
      if (!additive) {
        next = exists ? [] : [item];
      } else {
        next = exists ? s.selection.filter((it) => !sameSel(it, item)) : [...s.selection, item];
      }
      const label = item.kind === "body" ? "바디" : item.kind === "face" ? "면" : "모서리";
      return {
        selection: next,
        status: next.length ? `선택 ${next.length}개 (${label})` : "선택 해제",
      };
    }),

  clearSelection: () => set({ selection: [] }),

  setTransform: (shapeId, pos) =>
    set((s) => ({ transforms: { ...s.transforms, [shapeId]: pos } })),

  setGizmoDragging: (dragging) => set({ gizmoDragging: dragging }),

  beginSketch: () => {
    // 면(face)이 선택돼 있으면 그 면 위에서 바로 스케치 (Shapr3D식). 아니면 기준면 선택.
    const st = get();
    const faceSel = st.selection.find((it) => it.kind === "face");
    let plane: SketchPlaneDef | null = null;
    if (faceSel) {
      const mesh = st.shapes.find((m) => m.shapeId === faceSel.shapeId);
      const range = mesh?.faceRanges.find((r) => r.faceId === faceSel.index);
      if (mesh && range) {
        const off = st.transforms[mesh.shapeId] ?? [0, 0, 0];
        const verts: number[] = [];
        for (let i = range.start; i < range.start + range.count; i++) {
          const vi = mesh.indices[i]! * 3;
          verts.push(mesh.positions[vi]! + off[0], mesh.positions[vi + 1]! + off[1], mesh.positions[vi + 2]! + off[2]);
        }
        const ni = mesh.indices[range.start]! * 3;
        const normal: [number, number, number] = [mesh.normals[ni]!, mesh.normals[ni + 1]!, mesh.normals[ni + 2]!];
        plane = planeFromFace(verts, normal, `face-${mesh.shapeId}-${faceSel.index}`);
      }
    }
    set({
      sketchActive: true,
      sketchPlane: plane,
      // 면 위 스케치면 카메라를 그 면 정면으로 자동 정렬 (펜 그리기 편의)
      camera: plane ? alignToNormal(st.camera, plane.normal, plane.origin) : st.camera,
      sketchPoints: [],
      sketchStrokes: [],
      sketchDraft: null,
      sketchHover: null,
      sketchSelectedSeg: null,
      sketchLineDrawing: false,
      selection: [],
      status: plane ? "선택한 면 위에 스케치 — 도형을 그리세요" : "스케치: 기준면(XY/YZ/XZ)을 선택하세요",
    });
  },

  pickPlane: (id) =>
    set((s) => ({
      sketchPlane: SKETCH_PLANES[id],
      sketchPoints: [],
      sketchStrokes: [],
      sketchDraft: null,
      sketchLineDrawing: isPointTool(s.sketchTool),
      camera: viewPreset(s.camera, PLANE_VIEW[id]), // 그 면을 정면으로
      status: `${SKETCH_PLANES[id].label} 위에서 그리세요`,
    })),

  // 도구 전환 — 현재 그리던 획은 누적 보존 (사라지지 않음)
  setSketchTool: (tool) =>
    set((s) => ({
      sketchTool: tool,
      sketchDraft: null,
      sketchStrokes: strokeValid(s.sketchPoints, s.sketchTool) ? [...s.sketchStrokes, finalizeStroke(s.sketchPoints, s.sketchTool)] : s.sketchStrokes,
      sketchPoints: [],
      sketchSelectedSeg: null,
      sketchLineDrawing: isPointTool(tool),
      status:
        tool === "rectangle"
          ? "사각형 — 드래그해 그리기"
          : tool === "circle"
            ? "원 — 중심에서 바깥으로 드래그"
            : tool === "ellipse"
              ? "타원 — 중심에서 가로·세로로 드래그"
              : tool === "polygon"
                ? `다각형 — 중심에서 바깥으로 드래그 (${POLYGON_SIDES}각형)`
                : tool === "trim"
                  ? "자르기 — 지울 선 구간을 클릭"
                  : tool === "delete"
                    ? "삭제 — 지울 선을 클릭"
                    : tool === "spline"
                      ? "스플라인 — 점을 이어 찍기 (끝점 재클릭/Esc 로 확정)"
                      : tool === "arc"
                        ? "호 — 시작·중간·끝 3점을 클릭"
                        : "선 — 점을 순서대로 탭 (끝점 재클릭/Esc 로 확정)",
    })),

  // 사각형·원: 드래그 (좌표는 평면 (u,v))
  sketchDragStart: (raw) => {
    const t = get().sketchTool;
    if (isPointTool(t) || t === "trim" || t === "delete" || !get().sketchPlane) return;
    const g = get().snap.grid;
    const p: SketchPoint = g ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    set({ sketchDraft: { start: p, current: p }, sketchPoints: [] });
  },

  sketchDragMove: (raw) => {
    const g = get().snap.grid;
    const p: SketchPoint = g ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    set((s) => (s.sketchDraft ? { sketchDraft: { start: s.sketchDraft.start, current: p }, sketchHover: p } : { sketchHover: p }));
  },

  // 사각형·원: 드래그 종료 → 획으로 누적 (기존 획 유지)
  sketchDragEnd: () => {
    const { sketchDraft, sketchTool } = get();
    if (!sketchDraft) return;
    const { start, current } = sketchDraft;
    let pts: SketchPoint[];
    if (sketchTool === "circle") {
      const r = Math.hypot(current.u - start.u, current.v - start.v);
      pts = r > 0.01 ? circlePolygon(start, r) : [];
    } else if (sketchTool === "ellipse") {
      const ru = Math.abs(current.u - start.u);
      const rv = Math.abs(current.v - start.v);
      pts = ru > 0.01 && rv > 0.01 ? ellipsePolygon(start, ru, rv) : [];
    } else if (sketchTool === "polygon") {
      const r = Math.hypot(current.u - start.u, current.v - start.v);
      pts = r > 0.01 ? regularPolygon(start, r, POLYGON_SIDES) : [];
    } else {
      pts =
        Math.abs(current.u - start.u) > 0.01 && Math.abs(current.v - start.v) > 0.01
          ? [
              { u: start.u, v: start.v },
              { u: current.u, v: start.v },
              { u: current.u, v: current.v },
              { u: start.u, v: current.v },
            ]
          : [];
    }
    if (pts.length) {
      set((s) => ({ sketchDraft: null, sketchStrokes: [...s.sketchStrokes, pts], status: "도형 추가됨 — 계속 그리거나 스케칭 종료" }));
    } else {
      set({ sketchDraft: null, status: "너무 작아요 — 다시 드래그" });
    }
  },

  // 점 도구(선·스플라인·호) 클릭. 끝점 재클릭→확정. 호는 3점 모이면 자동 확정.
  sketchClickPoint: (raw) => {
    const s = get();
    if (!isPointTool(s.sketchTool) || !s.sketchPlane) return;
    const tool = s.sketchTool;
    const p: SketchPoint = s.snap.grid ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    if (!s.sketchLineDrawing) {
      set({ sketchLineDrawing: true, sketchPoints: [p], sketchSelectedSeg: null, status: "점을 이어 찍기 (끝점 재클릭/Esc 로 확정)" });
      return;
    }
    const last = s.sketchPoints[s.sketchPoints.length - 1];
    // 선·스플라인: 끝점 재클릭 → 확정
    if (tool !== "arc" && last && Math.hypot(p.u - last.u, p.v - last.v) < 0.4 && s.sketchPoints.length >= 2) {
      set((st) => ({ sketchStrokes: [...st.sketchStrokes, finalizeStroke(st.sketchPoints, tool)], sketchPoints: [], sketchLineDrawing: false, sketchHover: null, status: "확정 — 계속 그리기 / 스케칭 종료" }));
      return;
    }
    const next = [...s.sketchPoints, p];
    // 호: 3점(시작·중간·끝) 모이면 자동 확정
    if (tool === "arc" && next.length >= 3) {
      set((st) => ({ sketchStrokes: [...st.sketchStrokes, arc3(next[0]!, next[1]!, next[2]!)], sketchPoints: [], sketchLineDrawing: false, sketchHover: null, status: "호 완성 — 계속 그리기 / 스케칭 종료" }));
      return;
    }
    set({ sketchPoints: next, status: tool === "arc" ? `호 — 점 ${next.length}/3` : `점 ${next.length}개` });
  },

  trimSketchAt: (uv) =>
    set((s) => {
      // 화면에서 일정한 클릭 반경 (줌에 비례)
      const thr = Math.max(0.4, s.camera.radius * 0.06);
      const res = trimAt(s.sketchStrokes, uv, thr);
      if (!res) return { status: "자르기: 잘릴 선 위를 클릭하세요" };
      return { sketchStrokes: res, sketchSelectedSeg: null, sketchSelectedPoint: null, status: "선 잘림" };
    }),

  deleteSketchStrokeAt: (uv) =>
    set((s) => {
      const thr = Math.max(0.4, s.camera.radius * 0.06);
      const idx = nearestStrokeIndex(s.sketchStrokes, uv, thr);
      if (idx === null) return { status: "삭제: 지울 선을 클릭하세요" };
      return { sketchStrokes: s.sketchStrokes.filter((_, i) => i !== idx), sketchSelectedSeg: null, sketchSelectedPoint: null, status: "선 삭제" };
    }),

  startPointDrag: (s, i) => set({ sketchSelectedPoint: { s, i }, sketchDraggingPoint: { s, i }, gizmoDragging: true, status: "점 이동 — 끌어서 옮기기" }),
  movePointDrag: (uv) =>
    set((s) => {
      if (!s.sketchDraggingPoint) return {};
      const { s: si, i } = s.sketchDraggingPoint;
      const p: SketchPoint = s.snap.grid ? { u: snap(uv.u), v: snap(uv.v) } : uv;
      const strokes = s.sketchStrokes.map((st, idx) => (idx === si ? st.map((pt, j) => (j === i ? p : pt)) : st));
      return { sketchStrokes: strokes };
    }),
  endPointDrag: () => set({ sketchDraggingPoint: null, gizmoDragging: false, status: "점 이동 완료" }),

  openSketchTransform: (mode) =>
    set((s) => (s.sketchStrokes.length === 0 ? { status: "먼저 스케치 도형을 그리세요" } : { sketchTransformMode: mode })),
  closeSketchTransform: () => set({ sketchTransformMode: null }),
  sketchMirror: (axis) =>
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, ...mirrorStrokes(s.sketchStrokes, axis)], sketchTransformMode: null, status: `스케치 미러 (${axis === "u" ? "가로축" : "세로축"})` })),
  sketchPatternLinear: (axis, count, spacing) =>
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, ...patternLinearStrokes(s.sketchStrokes, axis, Math.max(2, count), spacing)], sketchTransformMode: null, status: `스케치 선형 패턴 ${count}개` })),
  sketchPatternCircular: (count, angleDeg) =>
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, ...patternCircularStrokes(s.sketchStrokes, Math.max(2, count), angleDeg)], sketchTransformMode: null, status: `스케치 원형 패턴 ${count}개` })),
  sketchOffset: (dist) =>
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, ...s.sketchStrokes.filter((st) => st.length >= 2).map((st) => offsetStroke(st, dist))], sketchTransformMode: null, status: `모서리 오프셋 ${dist} mm` })),
  sketchProject: () => {
    const st = get();
    const plane = st.sketchPlane;
    if (!plane) {
      set({ status: "투상: 스케치 평면이 없습니다" });
      return;
    }
    const ids = selectionBodyIds(st.selection);
    const bodies = ids.length ? st.shapes.filter((m) => ids.includes(m.shapeId)) : st.shapes;
    if (bodies.length === 0) {
      set({ status: "투상: 투영할 바디가 없습니다" });
      return;
    }
    const newStrokes: SketchPoint[][] = [];
    for (const body of bodies) {
      const off = st.transforms[body.shapeId] ?? [0, 0, 0];
      for (const e of body.edges) {
        const pts: SketchPoint[] = [];
        for (let i = 0; i < e.positions.length; i += 3) {
          pts.push(worldToPlane(plane, e.positions[i]! + off[0], e.positions[i + 1]! + off[1], e.positions[i + 2]! + off[2]));
        }
        if (pts.length >= 2) newStrokes.push(pts);
      }
    }
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, ...newStrokes], status: `투상 — 모서리 ${newStrokes.length}개` }));
  },

  selectSketchSegment: (st, i) => set({ sketchSelectedSeg: { s: st, i } }),
  clearSketchSegment: () => set({ sketchSelectedSeg: null }),
  finishLine: () =>
    set((s) => {
      if (strokeValid(s.sketchPoints, s.sketchTool)) {
        return { sketchStrokes: [...s.sketchStrokes, finalizeStroke(s.sketchPoints, s.sketchTool)], sketchPoints: [], sketchLineDrawing: false, sketchHover: null, status: "확정 — 계속 / 종료" };
      }
      return { sketchPoints: [], sketchLineDrawing: false, sketchHover: null };
    }),

  // 확정된 획(stroke s)의 선분 i 길이를 변경 (방향 유지, 뒤 점 동반 이동)
  setSegmentLength: (st, i, len) =>
    set((s) => {
      const stroke = s.sketchStrokes[st];
      if (!stroke) return { sketchSelectedSeg: null };
      const a = stroke[i];
      const b = stroke[i + 1];
      if (!a || !b || len <= 0) return { sketchSelectedSeg: null };
      const du = b.u - a.u;
      const dv = b.v - a.v;
      const cur = Math.hypot(du, dv);
      if (cur < 1e-6) return { sketchSelectedSeg: null };
      const k = len / cur;
      const deltaU = du * k - du;
      const deltaV = dv * k - dv;
      const newStroke = stroke.map((p, idx) => (idx > i ? { u: p.u + deltaU, v: p.v + deltaV } : p));
      const strokes = s.sketchStrokes.map((st2, idx) => (idx === st ? newStroke : st2));
      return { sketchStrokes: strokes, sketchSelectedSeg: null, status: `선 길이 ${len} mm` };
    }),

  undoSketchPoint: () =>
    set((s) => ({ sketchPoints: s.sketchPoints.slice(0, -1), sketchDraft: null, sketchSelectedSeg: null })),

  cancelSketch: () =>
    set({ sketchActive: false, sketchPlane: null, sketchPoints: [], sketchStrokes: [], sketchDraft: null, sketchHover: null, sketchSelectedSeg: null, sketchLineDrawing: false, status: "스케치 취소" }),

  // 스케칭 종료 → 그린 획들을 독립 스케치 항목으로 저장 (돌출은 도구에서)
  finishSketch: () => {
    const { sketchActive, sketchPlane, sketchPoints, sketchTool, sketchStrokes } = get();
    if (!sketchActive) return;
    const allStrokes = strokeValid(sketchPoints, sketchTool) ? [...sketchStrokes, finalizeStroke(sketchPoints, sketchTool)] : sketchStrokes;
    const base: Partial<AppState> = {
      sketchActive: false, sketchPlane: null, sketchPoints: [], sketchStrokes: [],
      sketchDraft: null, sketchHover: null, sketchSelectedSeg: null, sketchLineDrawing: false,
    };
    if (sketchPlane && allStrokes.length > 0) {
      const id = `sketch-${++counter}`;
      set((s) => ({
        ...base,
        sketches: [...s.sketches, { id, plane: sketchPlane, profiles: allStrokes }],
        history: [...s.history, { id, label: "스케치" }],
        status: `${id} 저장됨 (획 ${allStrokes.length}) — 선택 후 도구→돌출`,
      }));
    } else {
      set({ ...base, status: "스케치 종료 (저장할 프로파일 없음)" });
    }
  },

  // 도구 → 돌출: 선택된 스케치의 닫힌 프로파일을 입체화 (기본: 새 바디)
  extrudeSketch: (depth) => get().extrudeSketchAs(depth, "new"),

  // Shapr3D식 돌출 — 높이 + 모드(새 바디/빼기/합치기).
  //  cut/fuse 는 돌출체와 AABB 가 겹치는 기존 바디에만 불리언을 건다.
  extrudeSketchAs: (depth, mode) => {
    const st = get();
    const sel = st.selection.find((it) => it.kind === "sketch");
    const sketch = sel ? st.sketches.find((sk) => sk.id === sel.shapeId) : undefined;
    if (!sketch) {
      set({ status: "돌출: 먼저 스케치를 선택하세요 (항목 패널에서 스케치 클릭)" });
      return;
    }
    const closed = sketch.profiles.filter((p) => p.length >= 3);
    if (closed.length === 0) {
      set({ status: "돌출: 닫힌 프로파일이 없습니다 (점 3개 이상)" });
      return;
    }
    try {
      const plane = sketch.plane;
      const tools = closed.map((p) => extrudeProfile(p, plane, depth, `extrude-${++counter}`));

      if (mode === "new") {
        set((s) => ({
          shapes: [...s.shapes, ...tools],
          selection: [],
          extrudeOpen: false,
          history: [...s.history, ...tools.map((m) => ({ id: m.shapeId, label: "돌출(새 바디)" }))],
          status: `돌출 — 새 바디 ${tools.length}개 (높이 ${depth})`,
        }));
        return;
      }

      const { shapes: nextShapes, transforms, affected } = combineTools(st.shapes, st.transforms, tools, mode);
      if (affected === 0) {
        set({ extrudeOpen: false, status: `돌출(${mode === "cut" ? "빼기" : "합치기"}): 겹치는 바디가 없습니다` });
        return;
      }
      set((s) => ({
        shapes: nextShapes,
        transforms,
        selection: [],
        extrudeOpen: false,
        history: [...s.history, { id: `${mode}-${counter}`, label: mode === "cut" ? "돌출(빼기)" : "돌출(합치기)" }],
        status: mode === "cut" ? `돌출 빼기 — ${affected}곳 가공` : `돌출 합치기 — ${affected}곳 결합`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  openExtrude: () => {
    const sel = get().selection.find((it) => it.kind === "sketch");
    if (!sel) {
      set({ status: "돌출: 먼저 스케치를 선택하세요 (항목 패널에서 스케치 클릭)" });
      return;
    }
    set({ extrudeOpen: true, status: "돌출 — 높이와 방식을 정하세요" });
  },
  closeExtrude: () => set({ extrudeOpen: false }),

  startExtrudeDrag: () => {
    const sel = get().selection.find((it) => it.kind === "sketch");
    if (!sel) {
      set({ status: "돌출: 스케치를 선택하세요" });
      return;
    }
    set({ extrudeDrag: { sketchId: sel.shapeId, height: 1 }, gizmoDragging: true, status: "드래그해서 돌출 높이를 정하세요" });
  },
  setExtrudeDragHeight: (h) =>
    set((s) => {
      if (!s.extrudeDrag) return {};
      // 격자 스냅이 켜져 있으면 0.5 mm 단위로 딱딱 끊는다
      const height = s.snap.grid ? Math.max(SNAP, Math.round(h / SNAP) * SNAP) : Math.max(0.1, h);
      return { extrudeDrag: { ...s.extrudeDrag, height }, status: `돌출 높이 ${height.toFixed(1)} mm` };
    }),
  commitExtrudeDrag: () => {
    const d = get().extrudeDrag;
    set({ extrudeDrag: null, gizmoDragging: false });
    if (d) get().extrudeSketchAs(d.height, "new");
  },
  cancelExtrudeDrag: () => set({ extrudeDrag: null, gizmoDragging: false, status: "돌출 취소" }),

  // 도구 → 회전: 선택된 스케치의 닫힌 프로파일을 축 둘레로 회전 (새/빼기/합치기)
  revolveSketchAs: (angleDeg, axis, mode) => {
    const st = get();
    const sel = st.selection.find((it) => it.kind === "sketch");
    const sketch = sel ? st.sketches.find((sk) => sk.id === sel.shapeId) : undefined;
    if (!sketch) {
      set({ status: "회전: 먼저 스케치를 선택하세요 (항목 패널에서 스케치 클릭)" });
      return;
    }
    const closed = sketch.profiles.filter((p) => p.length >= 3);
    if (closed.length === 0) {
      set({ status: "회전: 닫힌 프로파일이 없습니다 (점 3개 이상)" });
      return;
    }
    try {
      const plane = sketch.plane;
      const tools = closed.map((p) => revolveProfile(p, plane, angleDeg, axis, `revolve-${++counter}`));
      if (mode === "new") {
        set((s) => ({
          shapes: [...s.shapes, ...tools],
          selection: [],
          revolveOpen: false,
          history: [...s.history, ...tools.map((m) => ({ id: m.shapeId, label: "회전(새 바디)" }))],
          status: `회전 — 새 바디 ${tools.length}개 (${angleDeg}°, ${axis === "v" ? "세로축" : "가로축"})`,
        }));
        return;
      }
      const { shapes: nextShapes, transforms, affected } = combineTools(st.shapes, st.transforms, tools, mode);
      if (affected === 0) {
        set({ revolveOpen: false, status: `회전(${mode === "cut" ? "빼기" : "합치기"}): 겹치는 바디가 없습니다` });
        return;
      }
      set((s) => ({
        shapes: nextShapes,
        transforms,
        selection: [],
        revolveOpen: false,
        history: [...s.history, { id: `${mode}-${counter}`, label: mode === "cut" ? "회전(빼기)" : "회전(합치기)" }],
        status: mode === "cut" ? `회전 빼기 — ${affected}곳 가공` : `회전 합치기 — ${affected}곳 결합`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  openRevolve: () => {
    const sel = get().selection.find((it) => it.kind === "sketch");
    if (!sel) {
      set({ status: "회전: 먼저 스케치를 선택하세요 (항목 패널에서 스케치 클릭)" });
      return;
    }
    set({ revolveOpen: true, status: "회전 — 각도와 축을 정하세요" });
  },
  closeRevolve: () => set({ revolveOpen: false }),

  importStl: (buffer, name) => {
    try {
      const id = `import-${++counter}`;
      const mesh = parseStl(buffer, id);
      set((s) => ({
        shapes: [...s.shapes, mesh],
        history: [...s.history, { id, label: `가져오기: ${name}` }],
        status: `${name} 불러옴 · 삼각형 ${mesh.indices.length / 3}`,
      }));
    } catch (err) {
      set({ status: `불러오기 오류: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  patternLinear: (axis, count, spacing) => {
    const st = get();
    const ids = selectionBodyIds(st.selection);
    if (ids.length === 0) {
      set({ status: "패턴: 바디를 선택하세요" });
      return;
    }
    const n = Math.max(2, Math.floor(count));
    const dir = AXIS_VEC[axis];
    const made: TessellatedMesh[] = [];
    for (const id of ids) {
      const body = st.shapes.find((m) => m.shapeId === id);
      if (!body) continue;
      const off = st.transforms[id] ?? [0, 0, 0];
      for (let k = 1; k < n; k++) {
        made.push(translateMesh(body, off[0] + dir[0] * spacing * k, off[1] + dir[1] * spacing * k, off[2] + dir[2] * spacing * k, `pat-${++counter}`));
      }
    }
    set((s) => ({
      shapes: [...s.shapes, ...made],
      patternOpen: false,
      history: [...s.history, { id: `pat-${counter}`, label: "선형 패턴" }],
      status: `선형 패턴 — 복제 ${made.length}개 (${axis}축, ${spacing} 간격)`,
    }));
  },

  patternCircular: (axis, count, angleDeg) => {
    const st = get();
    const ids = selectionBodyIds(st.selection);
    if (ids.length === 0) {
      set({ status: "패턴: 바디를 선택하세요" });
      return;
    }
    const n = Math.max(2, Math.floor(count));
    const axisVec = AXIS_VEC[axis];
    // 360°면 마지막이 원본과 겹치므로 step=360/n, 부분각이면 양끝 포함 step=angle/(n-1)
    const stepDeg = angleDeg >= 360 ? 360 / n : angleDeg / (n - 1);
    const made: TessellatedMesh[] = [];
    for (const id of ids) {
      const body = st.shapes.find((m) => m.shapeId === id);
      if (!body) continue;
      const off = st.transforms[id] ?? [0, 0, 0];
      const based = (off[0] || off[1] || off[2]) ? translateMesh(body, off[0], off[1], off[2], `${id}-b`) : body;
      for (let k = 1; k < n; k++) {
        made.push(rotateMeshAxis(based, axisVec, (stepDeg * k * Math.PI) / 180, `pat-${++counter}`));
      }
    }
    set((s) => ({
      shapes: [...s.shapes, ...made],
      patternOpen: false,
      history: [...s.history, { id: `pat-${counter}`, label: "원형 패턴" }],
      status: `원형 패턴 — 복제 ${made.length}개 (${axis}축, ${angleDeg}°)`,
    }));
  },

  openPattern: () => {
    if (selectionBodyIds(get().selection).length === 0) {
      set({ status: "패턴: 먼저 바디를 선택하세요" });
      return;
    }
    set({ patternOpen: true, status: "패턴 — 방식과 수치를 정하세요" });
  },
  closePattern: () => set({ patternOpen: false }),

  // 선택 바디를 변형(map). transform 오프셋을 좌표에 굽고 같은 id 로 교체.
  // mapper(body, center) 가 변형된 메시를 돌려준다.
  rotateBody: (axis, angleDeg) => {
    const st = get();
    const ids = new Set(selectionBodyIds(st.selection));
    if (ids.size === 0) {
      set({ status: "회전: 바디를 선택하세요" });
      return;
    }
    const k = AXIS_VEC[axis];
    const ang = (angleDeg * Math.PI) / 180;
    const transforms = { ...st.transforms };
    const shapes = st.shapes.map((body) => {
      if (!ids.has(body.shapeId)) return body;
      const off = st.transforms[body.shapeId] ?? [0, 0, 0];
      const based = off[0] || off[1] || off[2] ? translateMesh(body, off[0], off[1], off[2], body.shapeId) : body;
      const c = centroidOf(based);
      // 중심 기준 회전: translate(-c) → rotate(원점) → translate(+c)
      const r = translateMesh(rotateMeshAxis(translateMesh(based, -c[0], -c[1], -c[2], body.shapeId), k, ang, body.shapeId), c[0], c[1], c[2], body.shapeId);
      delete transforms[body.shapeId];
      return r;
    });
    set((s) => ({ shapes, transforms, transformMode: null, history: [...s.history, { id: `rot-${++counter}`, label: "회전" }], status: `바디 회전 ${angleDeg}° (${axis}축)` }));
  },

  scaleBody: (factor) => {
    const st = get();
    const ids = new Set(selectionBodyIds(st.selection));
    if (ids.size === 0 || factor <= 0) {
      set({ status: "스케일: 바디를 선택하고 양수 배율을 쓰세요" });
      return;
    }
    const transforms = { ...st.transforms };
    const shapes = st.shapes.map((body) => {
      if (!ids.has(body.shapeId)) return body;
      const off = st.transforms[body.shapeId] ?? [0, 0, 0];
      const based = off[0] || off[1] || off[2] ? translateMesh(body, off[0], off[1], off[2], body.shapeId) : body;
      delete transforms[body.shapeId];
      return scaleMesh(based, factor, centroidOf(based), body.shapeId);
    });
    set((s) => ({ shapes, transforms, transformMode: null, history: [...s.history, { id: `scl-${++counter}`, label: "스케일" }], status: `바디 스케일 ×${factor}` }));
  },

  mirrorBody: (axis) => {
    const st = get();
    const ids = new Set(selectionBodyIds(st.selection));
    if (ids.size === 0) {
      set({ status: "미러: 바디를 선택하세요" });
      return;
    }
    const a = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const transforms = { ...st.transforms };
    const shapes = st.shapes.map((body) => {
      if (!ids.has(body.shapeId)) return body;
      const off = st.transforms[body.shapeId] ?? [0, 0, 0];
      const based = off[0] || off[1] || off[2] ? translateMesh(body, off[0], off[1], off[2], body.shapeId) : body;
      delete transforms[body.shapeId];
      return mirrorMesh(based, a, centroidOf(based), body.shapeId);
    });
    set((s) => ({ shapes, transforms, transformMode: null, history: [...s.history, { id: `mir-${++counter}`, label: "미러" }], status: `바디 미러 (${axis}축)` }));
  },

  openTransform: (mode) => {
    if (selectionBodyIds(get().selection).length === 0) {
      set({ status: "변형: 먼저 바디를 선택하세요" });
      return;
    }
    set({ transformMode: mode });
  },
  closeTransform: () => set({ transformMode: null }),

  toggleMeasure: () =>
    set((s) => ({
      measureActive: !s.measureActive,
      measurePoints: [],
      selection: s.measureActive ? s.selection : [],
      status: s.measureActive ? "측정 종료" : "측정: 모델 위 두 점을 클릭하세요",
    })),
  addMeasurePoint: (p) =>
    set((s) => {
      const pts = s.measurePoints.length >= 2 ? [p] : [...s.measurePoints, p];
      if (pts.length === 2) {
        const a = pts[0]!;
        const b = pts[1]!;
        const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        return { measurePoints: pts, status: `거리 ${d.toFixed(2)} mm` };
      }
      return { measurePoints: pts, status: "측정: 두 번째 점을 클릭하세요" };
    }),
  clearMeasure: () => set({ measurePoints: [], measureActive: false }),
}));
