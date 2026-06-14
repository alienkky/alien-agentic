/**
 * 워커 풀 크기 산정 (§2.5 성능 예산).
 * 커널 워커는 무겁다(WASM). 태블릿 발열·메모리를 고려해 코어의 절반, 1~4 로 제한.
 * Phase 0 는 워커 1개만 쓰지만, 풀 확장 시 이 값을 따른다.
 */
export function recommendedWorkerCount(hardwareConcurrency?: number): number {
  const cores = hardwareConcurrency && hardwareConcurrency > 0 ? hardwareConcurrency : 4;
  return Math.max(1, Math.min(4, Math.floor(cores / 2)));
}
