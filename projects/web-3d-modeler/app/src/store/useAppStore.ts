/**
 * 앱 상태 (Zustand). 카메라·셰이프·선택·커널 백엔드·상태 메시지.
 * 커널 워커 핸들은 여기서 소유하고, 모든 커널 호출은 브릿지를 경유한다.
 */
import { create } from "zustand";
import { createKernelClient, type KernelHandle } from "../kernel/bridge";
import type { KernelBackend } from "../kernel/worker";
import type { TessellatedMesh } from "../kernel/types";
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

interface AppState {
  camera: CameraState;
  shapes: TessellatedMesh[];
  selected: FaceRef | null;
  hovered: FaceRef | null;
  backend: KernelBackend;
  status: string;
  busy: boolean;

  orbit: (dxPx: number, dyPx: number) => void;
  pan: (dxPx: number, dyPx: number) => void;
  zoom: (factor: number) => void;
  resetCamera: () => void;

  initKernel: () => Promise<void>;
  setBackend: (backend: KernelBackend) => Promise<void>;
  addBox: () => Promise<void>;
  clear: () => void;

  setHovered: (ref: FaceRef | null) => void;
  setSelected: (ref: FaceRef | null) => void;
}

let kernel: KernelHandle | null = null;
let boxCounter = 0;

export const useAppStore = create<AppState>((set, get) => ({
  camera: defaultCamera(),
  shapes: [],
  selected: null,
  hovered: null,
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
    set({ backend, status: "커널 준비됨 — Add Box 를 눌러보세요" });
  },

  setBackend: async (backend) => {
    if (!kernel) return;
    await kernel.client.setBackend(backend);
    set({
      backend,
      status:
        backend === "occt"
          ? "OCCT(B-rep) 백엔드 — 디바이스에서 검증 필요"
          : "결정론적 백엔드 — 전 디바이스 동작",
    });
  },

  addBox: async () => {
    if (!kernel || get().busy) return;
    set({ busy: true, status: "박스 생성 중…" });
    try {
      const shapeId = `box-${++boxCounter}`;
      const mesh = await kernel.client.makeBox({ width: 4, height: 4, depth: 4 }, shapeId);
      set((s) => ({
        shapes: [...s.shapes, mesh],
        status: `박스 추가됨 (${shapeId}) · 면 ${mesh.faceRanges.length}개`,
      }));
    } catch (err) {
      set({ status: `오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      set({ busy: false });
    }
  },

  clear: () => set({ shapes: [], selected: null, hovered: null, status: "비움" }),

  setHovered: (ref) => set({ hovered: ref }),
  setSelected: (ref) =>
    set({
      selected: ref,
      status: ref ? `선택: ${ref.shapeId} / face ${ref.faceId}` : "선택 해제",
    }),
}));
