/**
 * 모서리 피처(필렛/모따기) 공통 — 백엔드 무관 순수 로직.
 *
 * 실제 B-rep 연산(BRepFilletAPI_*)은 OCCT 전용이라 헤드리스(CI)에서 못 돈다.
 * 하지만 "FAST 거부"·"모서리 id 해석"·"면수 불변식" 은 OCCT 없이 결정론적으로
 * 검증 가능하다 → 이 파일에 모아 단위테스트 대상으로 삼는다.
 */
import type { TessellatedMesh } from "./types";

export type EdgeFeatureKind = "fillet" | "chamfer";

const LABEL: Record<EdgeFeatureKind, string> = {
  fillet: "필렛(모깎기)",
  chamfer: "모따기",
};

/**
 * 백엔드·입력 검증. OCCT 가 아니면 임의 모서리 필렛/모따기를 **명확히 거부**한다.
 * FAST(메시) 경로엔 B-rep 토폴로지가 없어 임의 모서리를 둥글릴 수 없기 때문 —
 * 둥근 박스가 필요하면 RoundedBox 프리미티브를 쓴다(별개 기능).
 *
 * 워커가 OCCT 모듈(65MB WASM)을 import 하기 *전에* 호출 → 헤드리스에서도 거부가 검증된다.
 */
export function validateEdgeFeature(
  backend: "deterministic" | "occt",
  kind: EdgeFeatureKind,
  edgeIds: number[],
  value: number,
): void {
  if (backend !== "occt") {
    throw new Error(
      `${LABEL[kind]}는 OCCT(B-rep) 백엔드에서만 가능합니다. ` +
        `FAST(메시) 모드는 임의 모서리 둥글리기를 지원하지 않습니다 — 상단 OCCT 토글을 켜세요. ` +
        `(둥근 박스가 필요하면 RoundedBox 프리미티브를 쓰세요)`,
    );
  }
  if (edgeIds.length === 0) {
    throw new Error(`${LABEL[kind]}: 모서리를 1개 이상 선택하세요`);
  }
  if (!(value > 0)) {
    throw new Error(`${LABEL[kind]}: ${kind === "fillet" ? "반지름" : "거리"}은 0보다 커야 합니다`);
  }
}

/**
 * 선택한 모서리 id 를 셰이프의 실제 모서리 개수(totalEdges)에 맞춰 정규화한다.
 * 범위 밖·중복 id 제거 후 오름차순. 유효 id 가 하나도 없으면 던진다.
 */
export function resolveEdgeIds(totalEdges: number, requested: number[]): number[] {
  const valid = [...new Set(requested)]
    .filter((id) => Number.isInteger(id) && id >= 0 && id < totalEdges)
    .sort((a, b) => a - b);
  if (valid.length === 0) {
    throw new Error("모서리 피처: 유효한 모서리가 없습니다 (선택을 다시 확인하세요)");
  }
  return valid;
}

/** 테셀레이션 메시의 서로 다른 면 개수 (faceId 재발급 일관성·면수 증가 검증용). */
export function faceCount(mesh: TessellatedMesh): number {
  return mesh.faceRanges.length;
}
