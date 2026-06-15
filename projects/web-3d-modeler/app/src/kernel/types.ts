/**
 * 커널 ↔ UI 경계 타입.
 *
 * 핵심 불변식(WORKFLOW §4): 테셀레이션 결과에는 토폴로지 ID(faceId/edgeId)가
 * 반드시 함께 실린다. 삼각형 → 면/모서리 역추적이 불가능하면 픽킹도 편집도 못 한다.
 * 이 포맷은 전 페이즈가 공유하며 함부로 바꾸지 않는다.
 */

/** 한 면(face)이 차지하는 삼각형 인덱스 구간. */
export interface FaceRange {
  faceId: number;
  /** indices 배열에서의 시작 위치 (삼각형 단위 아님, 인덱스 단위) */
  start: number;
  /** 인덱스 개수 (삼각형 수 × 3) */
  count: number;
}

/** 한 모서리(edge)의 폴리라인 — 모서리 픽킹·하이라이트용. */
export interface EdgePolyline {
  edgeId: number;
  /** xyz 평탄 배열 (포인트 N개 → 길이 3N) */
  positions: Float32Array;
}

/** 워커가 반환하는 표준 테셀레이션 페이로드. */
export interface TessellatedMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** 삼각형 i(=indices[3i..3i+2]) → 소속 faceId */
  triFaceId: Uint32Array;
  faceRanges: FaceRange[];
  edges: EdgePolyline[];
  shapeId: string;
}

export interface MakeBoxParams {
  width: number;
  height: number;
  depth: number;
}

export interface MakeCylinderParams {
  radius: number;
  height: number;
}

export interface MakeSphereParams {
  radius: number;
}

/** 불리언 연산: 합(fuse)·차(cut)·교(common). */
export type BooleanOp = "fuse" | "cut" | "common";

/** 워커가 expose 하는 커널 API (Comlink 경유). */
export interface KernelAPI {
  /** WASM 로딩 완료까지 대기. true 면 준비됨. */
  ready(): Promise<boolean>;
  /** 박스 생성 → 테셀레이션. shapeId 는 호출 측에서 부여. */
  makeBox(params: MakeBoxParams, shapeId: string): Promise<TessellatedMesh>;
  makeCylinder(params: MakeCylinderParams, shapeId: string): Promise<TessellatedMesh>;
  makeSphere(params: MakeSphereParams, shapeId: string): Promise<TessellatedMesh>;
  /**
   * 불리언: idA(대상)에 idB(도구)를 op 적용 → resultId 로 새 셰이프.
   * 입력 셰이프는 소비된다(삭제). OCCT 백엔드 전용 — 결정론적 백엔드는 거부한다.
   */
  boolean(op: BooleanOp, idA: string, idB: string, resultId: string): Promise<TessellatedMesh>;
  /** 셰이프 폐기 (커널 측 메모리 해제). */
  deleteShape(shapeId: string): Promise<void>;
}
