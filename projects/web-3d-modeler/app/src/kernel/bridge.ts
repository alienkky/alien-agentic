/**
 * 커널 브릿지 — 메인 스레드에서 워커를 타입드로 호출하는 유일한 통로.
 * 위 레이어(뷰포트·도구)는 워커의 존재를 모른 채 KernelClient 만 본다.
 */
import * as Comlink from "comlink";
import type { KernelWorker } from "./worker";

export type KernelClient = Comlink.Remote<KernelWorker>;

export interface KernelHandle {
  client: KernelClient;
  dispose(): void;
}

export function createKernelClient(): KernelHandle {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "nebula-kernel",
  });
  const client = Comlink.wrap<KernelWorker>(worker);
  return {
    client,
    dispose: () => worker.terminate(),
  };
}
