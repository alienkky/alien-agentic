/**
 * 앱 상태 (Zustand). 카메라·셰이프·선택·커널 백엔드·상태 메시지.
 * 커널 워커 핸들은 여기서 소유하고, 모든 커널 호출은 브릿지를 경유한다.
 */
import { create } from "zustand";
import { createKernelClient, type KernelHandle } from "../kernel/bridge";
import type { KernelBackend } from "../kernel/worker";
import type { TessellatedMesh, BooleanOp } from "../kernel/types";
import {
  defaultCamera,
  orbit as orbitCam,
  pan as panCam,
  zoom as zoomCam,
  type CameraState,
} from "../viewport/cameraMath";

export interface FaceRef {
  shapeId: string;
  faceId: number;
}

export type PrimitiveKind = "box" | "cylinder" | "sphere";

interface AppState {
  camera: CameraState;
  shapes: TessellatedMesh[];
  hovered: FaceRef | null;
  /** 불리언 대상으로 고른 셰이프들 (최대 2, 순서: 대상→도구) */
  selectedShapeIds: string[];
  backend: KernelBackend;
  status: string;
  busy: boolean;

  orbit: (dxPx: number, dyPx: number) => void;
  pan: (dxPx: number, dyPx: number) => void;
  zoom: (factor: number) => void;
  resetCamera: () => void;

  initKernel: () => Promise<void>;
  setBackend: (backend: KernelBackend) => Promise<void>;
  addPrimitive: (kind: PrimitiveKind) => Promise<void>;
  booleanOp: (op: BooleanOp) => Promise<void>;
  clear: () => Promise<void>;

  setHovered: (ref: FaceRef | null) => void;
  toggleShapeSelection: (shapeId: string) => void;
  clearSelection: () => void;
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
  hovered: null,
  selectedShapeIds: [],
  backend: "deterministic",
  status: "초기화 중…",
  busy: false,

  orbit: (dxPx, dyPx) => set((s) => ({ camera: orbitCam(s.camera, dxPx, dyPx) })),
  pan: (dxPx, dyPx) => set((s) => ({ camera: panCam(s.camera, dxPx, dyPx) })),
  zoom: (factor) => set((s) => ({ camera: zoomCam(s.camera, factor) })),
  resetCamera: () => set({ camera: defaultCamera() }),

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
    if (!kernel || get().busy) return;
    if (sel.length < 2) {
      set({ status: "불리언: 셰이프 2개를 선택하세요 (대상 → 도구 순서)" });
      return;
    }
    if (get().backend !== "occt") {
      set({ status: "불리언은 OCCT 백엔드 필요 — 상단 OCCT 토글을 켜세요" });
      return;
    }
    const idA = sel[0]!;
    const idB = sel[1]!;
    set({ busy: true, status: `${BOOL_LABEL[op]} 중…` });
    try {
      const resultId = `bool-${++counter}`;
      const mesh = await kernel.client.boolean(op, idA, idB, resultId);
      set((s) => ({
        shapes: [...s.shapes.filter((m) => m.shapeId !== idA && m.shapeId !== idB), mesh],
        selectedShapeIds: [],
        status: `${BOOL_LABEL[op]} 완료 → ${resultId}`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  clear: async () => {
    if (kernel) {
      for (const m of get().shapes) {
        await kernel.client.deleteShape(m.shapeId);
      }
    }
    set({ shapes: [], hovered: null, selectedShapeIds: [], status: "비움" });
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
}));
