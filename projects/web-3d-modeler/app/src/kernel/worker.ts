/**
 * CAD 커널 워커 — 모든 커널 연산은 여기(워커) 안에서만 일어난다.
 * UI 스레드에서 커널을 직접 호출하지 않는다(절대 원칙 1). Comlink 로 노출.
 *
 * 백엔드 스위치:
 *  - "deterministic": OCCT 없이 도는 프리미티브 테셀레이터 (전 디바이스 즉시 동작)
 *    → 불리언은 진짜 B-rep 이 필요하므로 거부한다.
 *  - "occt": opencascade.js B-rep (device-verify-pending) → 프리미티브 + 불리언 모두.
 */
import * as Comlink from "comlink";
import type {
  KernelAPI,
  MakeBoxParams,
  MakeCylinderParams,
  MakeSphereParams,
  BooleanOp,
  FilletParams,
  ChamferParams,
  FacePushPullParams,
  TessellatedMesh,
} from "./types";
import { tessellateBox } from "./occt/boxMesh";
import { tessellateCylinder } from "./occt/cylinderMesh";
import { tessellateSphere } from "./occt/sphereMesh";
import { validateEdgeFeature } from "./edgeFeature";

export type KernelBackend = "deterministic" | "occt";

export interface KernelWorker extends KernelAPI {
  setBackend(backend: KernelBackend): Promise<void>;
  getBackend(): Promise<KernelBackend>;
}

let backend: KernelBackend = "deterministic";

const worker: KernelWorker = {
  async ready(): Promise<boolean> {
    return true;
  },

  async setBackend(next: KernelBackend): Promise<void> {
    backend = next;
  },

  async getBackend(): Promise<KernelBackend> {
    return backend;
  },

  async makeBox(params: MakeBoxParams, shapeId: string): Promise<TessellatedMesh> {
    if (backend === "occt") {
      const { occtMakeBox } = await import("./occt/occtModule");
      return occtMakeBox(params.width, params.height, params.depth, shapeId);
    }
    return tessellateBox(params.width, params.height, params.depth, shapeId);
  },

  async makeCylinder(params: MakeCylinderParams, shapeId: string): Promise<TessellatedMesh> {
    if (backend === "occt") {
      const { occtMakeCylinder } = await import("./occt/occtModule");
      return occtMakeCylinder(params.radius, params.height, shapeId);
    }
    return tessellateCylinder(params.radius, params.height, shapeId);
  },

  async makeSphere(params: MakeSphereParams, shapeId: string): Promise<TessellatedMesh> {
    if (backend === "occt") {
      const { occtMakeSphere } = await import("./occt/occtModule");
      return occtMakeSphere(params.radius, shapeId);
    }
    return tessellateSphere(params.radius, shapeId);
  },

  async boolean(op: BooleanOp, idA: string, idB: string, resultId: string): Promise<TessellatedMesh> {
    if (backend !== "occt") {
      throw new Error("불리언은 OCCT 백엔드에서만 가능합니다 (진짜 B-rep 필요). 상단 OCCT 토글을 켜세요.");
    }
    const { occtBoolean } = await import("./occt/occtModule");
    return occtBoolean(op, idA, idB, resultId);
  },

  async fillet(shapeId: string, params: FilletParams, resultId: string): Promise<TessellatedMesh> {
    // FAST(메시) 거부 — OCCT WASM import 전에 검증한다.
    validateEdgeFeature(backend, "fillet", params.edgeIds, params.radius);
    const { occtFillet } = await import("./occt/occtModule");
    return occtFillet(shapeId, params, resultId);
  },

  async chamfer(shapeId: string, params: ChamferParams, resultId: string): Promise<TessellatedMesh> {
    validateEdgeFeature(backend, "chamfer", params.edgeIds, params.distance);
    const { occtChamfer } = await import("./occt/occtModule");
    return occtChamfer(shapeId, params, resultId);
  },

  async facePushPull(shapeId: string, params: FacePushPullParams, resultId: string): Promise<TessellatedMesh> {
    // OCCT 전용 B-rep 경로. FAST(메시) 평면 면 변형은 store 가 결정론 경로(meshFacePushPull)로 처리한다.
    if (backend !== "occt") {
      throw new Error("면 Push/Pull(B-rep)은 OCCT 백엔드에서만 가능합니다. FAST 모드는 메시 경로를 씁니다.");
    }
    const { occtFacePushPull } = await import("./occt/occtModule");
    return occtFacePushPull(shapeId, params, resultId);
  },

  async deleteShape(shapeId: string): Promise<void> {
    if (backend === "occt") {
      const { occtDeleteShape } = await import("./occt/occtModule");
      occtDeleteShape(shapeId);
    }
  },
};

Comlink.expose(worker);
