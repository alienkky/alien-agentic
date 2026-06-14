/**
 * CAD 커널 워커 — 모든 커널 연산은 여기(워커) 안에서만 일어난다.
 * UI 스레드에서 커널을 직접 호출하지 않는다(절대 원칙 1). Comlink 로 노출.
 *
 * 백엔드 스위치:
 *  - "deterministic": OCCT 없이 도는 박스 테셀레이터 (Phase 0 기본, 전 디바이스 즉시 동작)
 *  - "occt": opencascade.js B-rep (device-verify-pending — 디바이스에서 켜서 검증)
 */
import * as Comlink from "comlink";
import type { KernelAPI, MakeBoxParams, TessellatedMesh } from "./types";
import { tessellateBox } from "./occt/boxMesh";

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
};

Comlink.expose(worker);
