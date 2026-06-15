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
import { SKETCH_PLANES, type PlaneId, type SketchPoint } from "../kernel/sketchPlane";
import {
  defaultCamera,
  orbit as orbitCam,
  pan as panCam,
  zoom as zoomCam,
  viewPreset,
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
export type SketchTool = "rectangle" | "circle" | "line";

/** 저장된 스케치 (독립 항목). 도구→돌출 의 입력이 된다. */
export interface SketchEntity {
  id: string;
  plane: PlaneId;
  profile: SketchPoint[];
  tool: SketchTool;
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

const PLANE_VIEW: Record<PlaneId, "top" | "front" | "right"> = { xz: "top", xy: "front", yz: "right" };

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
  /** 선택된 기준면. null 이면 "활성 평면 없음" (면을 골라야 그릴 수 있음) */
  sketchPlane: PlaneId | null;
  /** 현재 스케치 도구 */
  sketchTool: SketchTool;
  /** 사각형·원 드래그 초안 (평면 (u,v)). 드래그 중 실시간 미리보기 */
  sketchDraft: { start: SketchPoint; current: SketchPoint } | null;
  /** 커서 위치 (선 도구 미리보기용, (u,v)) */
  sketchHover: SketchPoint | null;
  /** 확정된 프로파일 점들 (평면 (u,v)) */
  sketchPoints: SketchPoint[];
  /** 치수 편집 중인 선분 인덱스 (points[i]→points[i+1]) */
  sketchSelectedSeg: number | null;
  /** 선을 적극적으로 그리는 중인지 (false 면 선택 모드) */
  sketchLineDrawing: boolean;
  /** 내역(History) — 단계별 작업 로그 (우측 패널). 명세 Module 1.2 토대 */
  history: { id: string; label: string }[];
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
  /** 선분 치수 편집 선택 / 길이 설정 / 해제 */
  selectSketchSegment: (i: number) => void;
  setSegmentLength: (i: number, len: number) => void;
  clearSketchSegment: () => void;
  /** 선 그리기 종료 → 선택 모드 */
  finishLine: () => void;
  undoSketchPoint: () => void;
  cancelSketch: () => void;
  /** 스케치 종료 → 유효 프로파일이면 항목으로 저장 */
  finishSketch: () => void;
  /** 선택된 스케치를 돌출 (도구→돌출) */
  extrudeSketch: (depth: number) => void;
}

let kernel: KernelHandle | null = null;
let counter = 0;

const BOOL_LABEL: Record<BooleanOp, string> = {
  fuse: "합치기",
  cut: "빼기",
  common: "교집합",
};

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
  sketchSelectedSeg: null,
  sketchLineDrawing: false,
  history: [],
  displayMode: "shaded",
  panels: { items: true, history: true },
  showEdges: true,
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
    set({ shapes: [], sketches: [], transforms: {}, hovered: null, selection: [], history: [], status: "비움" });
  },

  setStatus: (msg) => set({ status: msg }),
  setDisplayMode: (mode) => set({ displayMode: mode, status: `디스플레이: ${mode}` }),
  togglePanel: (p) => set((s) => ({ panels: { ...s.panels, [p]: !s.panels[p] } })),
  toggleEdges: () => set((s) => ({ showEdges: !s.showEdges, status: `에지 표시: ${!s.showEdges ? "켜짐" : "꺼짐"}` })),
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

  beginSketch: () =>
    set({
      sketchActive: true,
      sketchPlane: null,
      sketchPoints: [],
      sketchDraft: null,
      sketchHover: null,
      selection: [],
      status: "스케치: 기준면(XY/YZ/XZ)을 선택하세요",
    }),

  pickPlane: (id) =>
    set((s) => ({
      sketchPlane: id,
      sketchPoints: [],
      sketchDraft: null,
      sketchLineDrawing: s.sketchTool === "line",
      camera: viewPreset(s.camera, PLANE_VIEW[id]), // 그 면을 정면으로
      status: `${SKETCH_PLANES[id].label} 위에서 그리세요`,
    })),

  setSketchTool: (tool) =>
    set({
      sketchTool: tool,
      sketchDraft: null,
      sketchPoints: [],
      sketchSelectedSeg: null,
      sketchLineDrawing: tool === "line",
      status:
        tool === "rectangle"
          ? "사각형 — 드래그해 그리기"
          : tool === "circle"
            ? "원 — 중심에서 바깥으로 드래그"
            : "선 — 점을 순서대로 탭 (3개 이상)",
    }),

  // 사각형·원: 드래그 (좌표는 평면 (u,v))
  sketchDragStart: (raw) => {
    if (get().sketchTool === "line" || !get().sketchPlane) return;
    const g = get().snap.grid;
    const p: SketchPoint = g ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    set({ sketchDraft: { start: p, current: p }, sketchPoints: [] });
  },

  sketchDragMove: (raw) => {
    const g = get().snap.grid;
    const p: SketchPoint = g ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    set((s) => (s.sketchDraft ? { sketchDraft: { start: s.sketchDraft.start, current: p }, sketchHover: p } : { sketchHover: p }));
  },

  sketchDragEnd: () => {
    const { sketchDraft, sketchTool } = get();
    if (!sketchDraft) return;
    const { start, current } = sketchDraft;
    let pts: SketchPoint[];
    if (sketchTool === "circle") {
      const r = Math.hypot(current.u - start.u, current.v - start.v);
      pts = r > 0.01 ? circlePolygon(start, r) : [];
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
    set({ sketchDraft: null, sketchPoints: pts, status: pts.length ? "프로파일 완성 — 스케칭 종료(저장) 후 도구→돌출" : "너무 작아요 — 다시 드래그" });
  },

  // 선: 점 클릭 누적 (마지막 점 다시 클릭 → 종료)
  sketchClickPoint: (raw) => {
    const s = get();
    if (s.sketchTool !== "line" || !s.sketchPlane) return;
    if (!s.sketchLineDrawing) {
      // 선택 모드 — 빈 곳 클릭은 선분 선택 해제
      set({ sketchSelectedSeg: null });
      return;
    }
    const p: SketchPoint = s.snap.grid ? { u: snap(raw.u), v: snap(raw.v) } : raw;
    const last = s.sketchPoints[s.sketchPoints.length - 1];
    if (last && Math.hypot(p.u - last.u, p.v - last.v) < 0.4) {
      // 끝점 다시 클릭 → 그리기 종료, 선택 모드로
      set({ sketchLineDrawing: false, sketchHover: null, status: "선 완료 — 선분을 클릭해 치수 편집" });
      return;
    }
    set({ sketchPoints: [...s.sketchPoints, p], sketchSelectedSeg: null, status: `선 — 점 ${s.sketchPoints.length + 1}개 (끝점 다시 클릭/Esc 로 종료)` });
  },

  selectSketchSegment: (i) => set({ sketchSelectedSeg: i }),
  clearSketchSegment: () => set({ sketchSelectedSeg: null }),
  finishLine: () => set({ sketchLineDrawing: false, sketchHover: null, status: "선 완료 — 선분을 클릭해 치수 편집" }),

  setSegmentLength: (i, len) =>
    set((s) => {
      const a = s.sketchPoints[i];
      const b = s.sketchPoints[i + 1];
      if (!a || !b || len <= 0) return { sketchSelectedSeg: null };
      const du = b.u - a.u;
      const dv = b.v - a.v;
      const cur = Math.hypot(du, dv);
      if (cur < 1e-6) return { sketchSelectedSeg: null };
      const k = len / cur;
      const deltaU = du * k - du;
      const deltaV = dv * k - dv;
      // i+1 부터 끝까지 동일 델타로 이동 → 폴리라인 연결 유지
      const pts = s.sketchPoints.map((p, idx) =>
        idx > i ? { u: p.u + deltaU, v: p.v + deltaV } : p,
      );
      return { sketchPoints: pts, sketchSelectedSeg: null, status: `선 길이 ${len} mm` };
    }),

  undoSketchPoint: () =>
    set((s) => ({ sketchPoints: s.sketchPoints.slice(0, -1), sketchDraft: null, sketchSelectedSeg: null })),

  cancelSketch: () =>
    set({ sketchActive: false, sketchPlane: null, sketchPoints: [], sketchDraft: null, sketchHover: null, sketchSelectedSeg: null, sketchLineDrawing: false, status: "스케치 취소" }),

  // 스케칭 종료 → 유효 프로파일이면 독립 스케치 항목으로 저장 (돌출은 도구에서)
  finishSketch: () => {
    const { sketchActive, sketchPlane, sketchPoints, sketchTool } = get();
    if (!sketchActive) return;
    const base: Partial<AppState> = {
      sketchActive: false,
      sketchPlane: null,
      sketchPoints: [],
      sketchDraft: null,
      sketchHover: null,
      sketchSelectedSeg: null,
      sketchLineDrawing: false,
    };
    if (sketchPlane && sketchPoints.length >= 3) {
      const id = `sketch-${++counter}`;
      set((s) => ({
        ...base,
        sketches: [...s.sketches, { id, plane: sketchPlane, profile: sketchPoints, tool: sketchTool }],
        history: [...s.history, { id, label: "스케치" }],
        status: `${id} 저장됨 — 선택 후 도구→돌출`,
      }));
    } else {
      set({ ...base, status: "스케치 종료 (저장할 프로파일 없음)" });
    }
  },

  // 도구 → 돌출: 선택된 스케치를 입체화
  extrudeSketch: (depth) => {
    const sel = get().selection.find((it) => it.kind === "sketch");
    const sketch = sel ? get().sketches.find((sk) => sk.id === sel.shapeId) : undefined;
    if (!sketch) {
      set({ status: "돌출: 먼저 스케치를 선택하세요 (스케치 항목 클릭)" });
      return;
    }
    try {
      const shapeId = `extrude-${++counter}`;
      const mesh = extrudeProfile(sketch.profile, SKETCH_PLANES[sketch.plane], depth, shapeId);
      set((s) => ({
        shapes: [...s.shapes, mesh],
        selection: [],
        history: [...s.history, { id: shapeId, label: "돌출" }],
        status: `돌출 완료 → ${shapeId} (높이 ${depth})`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
}));
