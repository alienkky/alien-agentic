/**
 * 앱 상태 (Zustand). 카메라·셰이프·선택·커널 백엔드·상태 메시지.
 * 커널 워커 핸들은 여기서 소유하고, 모든 커널 호출은 브릿지를 경유한다.
 */
import { create } from "zustand";
import { createKernelClient, type KernelHandle } from "../kernel/bridge";
import type { KernelBackend } from "../kernel/worker";
import type { TessellatedMesh, BooleanOp } from "../kernel/types";
import { meshBoolean } from "../kernel/meshBoolean";
import { extrudeProfile, type SketchPoint } from "../kernel/extrude";
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

export type PrimitiveKind = "box" | "cylinder" | "sphere";
export type SketchTool = "rectangle" | "circle" | "line";

const SNAP = 0.5; // 격자 스냅 간격
const snap = (v: number): number => Math.round(v / SNAP) * SNAP;

function circlePolygon(center: SketchPoint, radius: number, segments = 48): SketchPoint[] {
  const pts: SketchPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), z: center.z + radius * Math.sin(a) });
  }
  return pts;
}

export type Vec3 = [number, number, number];

interface AppState {
  camera: CameraState;
  shapes: TessellatedMesh[];
  /** 셰이프별 위치 오프셋 (이동 기즈모). 없으면 원점. */
  transforms: Record<string, Vec3>;
  hovered: FaceRef | null;
  /** 불리언 대상으로 고른 셰이프들 (최대 2, 순서: 대상→도구) */
  selectedShapeIds: string[];
  /** 이동 기즈모 드래그 중 — 카메라 입력을 막는다 */
  gizmoDragging: boolean;
  /** 스케치 모드 활성 여부 */
  sketchActive: boolean;
  /** 현재 스케치 도구 */
  sketchTool: SketchTool;
  /** 사각형·원 드래그 초안 (시작점→현재점). 드래그 중 실시간 미리보기 */
  sketchDraft: { start: SketchPoint; current: SketchPoint } | null;
  /** 커서 위치 (선 도구 미리보기용) */
  sketchHover: SketchPoint | null;
  /** 확정된 프로파일 점들 (지면 XZ) */
  sketchPoints: SketchPoint[];
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

  setHovered: (ref: FaceRef | null) => void;
  toggleShapeSelection: (shapeId: string) => void;
  clearSelection: () => void;
  setTransform: (shapeId: string, pos: Vec3) => void;
  setGizmoDragging: (dragging: boolean) => void;

  beginSketch: () => void;
  setSketchTool: (tool: SketchTool) => void;
  /** 사각형·원: 드래그 시작 / 이동 / 종료. 선: 점 클릭 */
  sketchDragStart: (p: SketchPoint) => void;
  sketchDragMove: (p: SketchPoint) => void;
  sketchDragEnd: () => void;
  sketchClickPoint: (p: SketchPoint) => void;
  undoSketchPoint: () => void;
  cancelSketch: () => void;
  commitExtrude: (depth: number) => void;
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
  transforms: {},
  hovered: null,
  selectedShapeIds: [],
  gizmoDragging: false,
  sketchActive: false,
  sketchTool: "rectangle",
  sketchDraft: null,
  sketchHover: null,
  sketchPoints: [],
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
      set((s) => ({
        shapes: [...s.shapes, mesh],
        status: `${shapeId} 추가됨 · 면 ${mesh.faceRanges.length} · 모서리 ${mesh.edges.length}`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  booleanOp: async (op) => {
    const sel = get().selectedShapeIds;
    if (get().busy) return;
    if (sel.length < 2) {
      set({ status: "불리언: 셰이프 2개를 선택하세요 (대상 → 도구 순서)" });
      return;
    }
    const idA = sel[0]!;
    const idB = sel[1]!;
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
          selectedShapeIds: [],
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
        selectedShapeIds: s.selectedShapeIds.filter((id) => id !== shapeId),
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
    set({ shapes: [], transforms: {}, hovered: null, selectedShapeIds: [], status: "비움" });
  },

  setHovered: (ref) => set({ hovered: ref }),

  toggleShapeSelection: (shapeId) =>
    set((s) => {
      const has = s.selectedShapeIds.includes(shapeId);
      let next = has
        ? s.selectedShapeIds.filter((id) => id !== shapeId)
        : [...s.selectedShapeIds, shapeId];
      if (next.length > 2) next = next.slice(next.length - 2);
      return { selectedShapeIds: next, status: `셰이프 ${next.length}개 선택` };
    }),

  clearSelection: () => set({ selectedShapeIds: [] }),

  setTransform: (shapeId, pos) =>
    set((s) => ({ transforms: { ...s.transforms, [shapeId]: pos } })),

  setGizmoDragging: (dragging) => set({ gizmoDragging: dragging }),

  beginSketch: () =>
    set((s) => ({
      sketchActive: true,
      sketchPoints: [],
      sketchDraft: null,
      sketchHover: null,
      selectedShapeIds: [],
      camera: viewPreset(s.camera, "top"), // 평면을 정면으로 — 2D 처럼
      status: "스케치: 사각형을 드래그해 그리세요",
    })),

  setSketchTool: (tool) =>
    set({
      sketchTool: tool,
      sketchDraft: null,
      sketchPoints: [],
      status:
        tool === "rectangle"
          ? "사각형 — 드래그해 그리기"
          : tool === "circle"
            ? "원 — 중심에서 바깥으로 드래그"
            : "선 — 점을 순서대로 탭 (3개 이상)",
    }),

  // 사각형·원: 드래그
  sketchDragStart: (raw) => {
    if (get().sketchTool === "line") return;
    const p: SketchPoint = { x: snap(raw.x), z: snap(raw.z) };
    set({ sketchDraft: { start: p, current: p }, sketchPoints: [] });
  },

  sketchDragMove: (raw) => {
    const p: SketchPoint = { x: snap(raw.x), z: snap(raw.z) };
    set((s) => (s.sketchDraft ? { sketchDraft: { start: s.sketchDraft.start, current: p }, sketchHover: p } : { sketchHover: p }));
  },

  sketchDragEnd: () => {
    const { sketchDraft, sketchTool } = get();
    if (!sketchDraft) return;
    const { start, current } = sketchDraft;
    let pts: SketchPoint[];
    if (sketchTool === "circle") {
      const r = Math.hypot(current.x - start.x, current.z - start.z);
      pts = r > 0.01 ? circlePolygon(start, r) : [];
    } else {
      pts =
        Math.abs(current.x - start.x) > 0.01 && Math.abs(current.z - start.z) > 0.01
          ? [
              { x: start.x, z: start.z },
              { x: current.x, z: start.z },
              { x: current.x, z: current.z },
              { x: start.x, z: current.z },
            ]
          : [];
    }
    set({ sketchDraft: null, sketchPoints: pts, status: pts.length ? "프로파일 완성 — 돌출하세요" : "너무 작아요 — 다시 드래그" });
  },

  // 선: 점 클릭 누적
  sketchClickPoint: (raw) => {
    if (get().sketchTool !== "line") return;
    const p: SketchPoint = { x: snap(raw.x), z: snap(raw.z) };
    set((s) => ({ sketchPoints: [...s.sketchPoints, p], status: `선 — 점 ${s.sketchPoints.length + 1}개` }));
  },

  undoSketchPoint: () =>
    set((s) => ({ sketchPoints: s.sketchPoints.slice(0, -1), sketchDraft: null })),

  cancelSketch: () =>
    set({ sketchActive: false, sketchPoints: [], sketchDraft: null, sketchHover: null, status: "스케치 취소" }),

  commitExtrude: (depth) => {
    const pts = get().sketchPoints;
    if (pts.length < 3) {
      set({ status: "돌출: 점이 3개 이상이어야 합니다" });
      return;
    }
    try {
      const shapeId = `extrude-${++counter}`;
      const mesh = extrudeProfile(pts, depth, shapeId);
      set((s) => ({
        shapes: [...s.shapes, mesh],
        sketchActive: false,
        sketchPoints: [],
        sketchDraft: null,
        sketchHover: null,
        status: `돌출 완료 → ${shapeId}`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
}));
