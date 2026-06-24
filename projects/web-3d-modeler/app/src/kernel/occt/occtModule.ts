/**
 * OCCT 백엔드 (production 경로) — opencascade.js 1.1.1.
 *
 * ⚠️ device-verify-pending: 65MB WASM + 브라우저 실행이 필요해 헤드리스(CI/tsc)에서는
 *    런타임 검증이 불가능하다. tsc·build 는 통과하지만, "실제로 도는지"는 디바이스에서 확인.
 *
 * 타입 정의 미제공 라이브러리 → 호출하는 부분만 facade(OccInstance)로 좁혀 캐스팅 격리.
 * 메모리 규칙(절대): new 로 만든 OCCT C++ 객체는 반드시 .delete() 한다.
 *
 * 불리언을 위해 **셰이프 레지스트리**(shapeStore)에 B-rep 핸들을 보관한다.
 * 테셀레이션 메시는 파생물이지만, 불리언은 원본 TopoDS_Shape 끼리 연산하기 때문.
 */
import type {
  TessellatedMesh,
  FaceRange,
  EdgePolyline,
  BooleanOp,
  FilletParams,
  ChamferParams,
  FacePushPullParams,
} from "../types";
import { resolveEdgeIds } from "../edgeFeature";

/* ── facade 타입 (우리가 쓰는 부분만) ─────────────────────────── */

interface OccDeletable {
  delete(): void;
}
interface OccShape extends OccDeletable {
  Orientation(): number;
}
interface OccPnt {
  X(): number;
  Y(): number;
  Z(): number;
  Transformed(trsf: unknown): OccPnt;
}
interface OccArray1OfPnt {
  Lower(): number;
  Upper(): number;
  Value(i: number): OccPnt;
}
interface OccPolyTriangle {
  Value(i: number): number;
}
interface OccArray1OfTriangle {
  Lower(): number;
  Upper(): number;
  Value(i: number): OccPolyTriangle;
}
interface OccTriangulation {
  NbNodes(): number;
  NbTriangles(): number;
  Nodes(): OccArray1OfPnt;
  Triangles(): OccArray1OfTriangle;
}
interface OccHandleTriangulation {
  IsNull(): boolean;
  get(): OccTriangulation;
}
interface OccLocation extends OccDeletable {
  Transformation(): unknown;
}
interface OccExplorer extends OccDeletable {
  More(): boolean;
  Next(): void;
  Current(): OccShape;
}
interface OccShapeMaker extends OccDeletable {
  Shape(): OccShape;
}
/** BRepFilletAPI_MakeFillet: Add(반지름, 모서리) 누적 후 Shape() 로 빌드. */
interface OccFilletMaker extends OccDeletable {
  Add(radius: number, edge: OccShape): void;
  Shape(): OccShape;
}
/** BRepFilletAPI_MakeChamfer: Add(거리, 모서리) 누적 후 Shape() 로 빌드. */
interface OccChamferMaker extends OccDeletable {
  Add(distance: number, edge: OccShape): void;
  Shape(): OccShape;
}
interface OccCurve extends OccDeletable {
  FirstParameter(): number;
  LastParameter(): number;
  Value(u: number): OccPnt;
}
/** gp_Vec: 면 Push/Pull 프리즘 압출 방향(법선 × 거리). */
interface OccVec extends OccDeletable {
  X(): number;
}

interface OccInstance {
  BRepPrimAPI_MakeBox: new (dx: number, dy: number, dz: number) => OccShapeMaker;
  BRepPrimAPI_MakeCylinder: new (r: number, h: number) => OccShapeMaker;
  BRepPrimAPI_MakeSphere: new (r: number) => OccShapeMaker;
  BRepAlgoAPI_Fuse: new (a: OccShape, b: OccShape) => OccShapeMaker;
  BRepAlgoAPI_Cut: new (a: OccShape, b: OccShape) => OccShapeMaker;
  BRepAlgoAPI_Common: new (a: OccShape, b: OccShape) => OccShapeMaker;
  BRepFilletAPI_MakeFillet: new (shape: OccShape) => OccFilletMaker;
  BRepFilletAPI_MakeChamfer: new (shape: OccShape) => OccChamferMaker;
  BRepPrimAPI_MakePrism: new (profile: OccShape, vec: OccVec) => OccShapeMaker;
  gp_Vec: new (x: number, y: number, z: number) => OccVec;
  BRepMesh_IncrementalMesh: new (
    shape: OccShape,
    deflection: number,
    relative: boolean,
    angle: number,
    parallel: boolean,
  ) => OccDeletable;
  BRepAdaptor_Curve: new (edge: OccShape) => OccCurve;
  TopExp_Explorer: new (shape: OccShape, toFind: number) => OccExplorer;
  TopLoc_Location: new () => OccLocation;
  TopoDS: { prototype: { Face(shape: OccShape): OccShape; Edge(shape: OccShape): OccShape } };
  BRep_Tool: { prototype: { Triangulation(face: OccShape, loc: OccLocation): OccHandleTriangulation } };
  TopAbs_FACE: number;
  TopAbs_EDGE: number;
  TopAbs_REVERSED: number;
}

type OccFactory = (mod: { locateFile: (path: string) => string }) => unknown;

/* ── 로딩 (싱글톤) + 셰이프 레지스트리 ─────────────────────────── */

let occPromise: Promise<OccInstance> | null = null;
const shapeStore = new Map<string, OccShape>();

export function loadOcct(): Promise<OccInstance> {
  if (occPromise) return occPromise;
  occPromise = (async () => {
    const factoryMod = (await import("opencascade.js/dist/opencascade.wasm.js")) as { default: OccFactory };
    const wasmMod = (await import("opencascade.js/dist/opencascade.wasm.wasm?url")) as { default: string };
    const wasmUrl = wasmMod.default;
    const raw = factoryMod.default({
      locateFile: (path: string) => (path.endsWith(".wasm") ? wasmUrl : path),
    });
    const ready = (raw as { ready?: Promise<OccInstance> }).ready;
    return (await (ready ?? (raw as Promise<OccInstance>))) as OccInstance;
  })();
  return occPromise;
}

export function occtDeleteShape(shapeId: string): void {
  const shape = shapeStore.get(shapeId);
  if (shape) {
    shape.delete();
    shapeStore.delete(shapeId);
  }
}

/* ── 프리미티브 ─────────────────────────────────────────────── */

export async function occtMakeBox(w: number, h: number, d: number, id: string): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const maker = new oc.BRepPrimAPI_MakeBox(w, h, d);
  const shape = maker.Shape();
  maker.delete();
  return registerAndTessellate(oc, shape, id);
}

export async function occtMakeCylinder(r: number, h: number, id: string): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const maker = new oc.BRepPrimAPI_MakeCylinder(r, h);
  const shape = maker.Shape();
  maker.delete();
  return registerAndTessellate(oc, shape, id);
}

export async function occtMakeSphere(r: number, id: string): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const maker = new oc.BRepPrimAPI_MakeSphere(r);
  const shape = maker.Shape();
  maker.delete();
  return registerAndTessellate(oc, shape, id);
}

/* ── 불리언 ─────────────────────────────────────────────────── */

export async function occtBoolean(
  op: BooleanOp,
  idA: string,
  idB: string,
  resultId: string,
): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const a = shapeStore.get(idA);
  const b = shapeStore.get(idB);
  if (!a || !b) {
    throw new Error("불리언: 입력 셰이프를 찾을 수 없습니다 (OCCT 셰이프만 가능)");
  }

  const maker =
    op === "fuse"
      ? new oc.BRepAlgoAPI_Fuse(a, b)
      : op === "cut"
        ? new oc.BRepAlgoAPI_Cut(a, b)
        : new oc.BRepAlgoAPI_Common(a, b);
  const result = maker.Shape();
  maker.delete();

  // 입력 소비
  occtDeleteShape(idA);
  occtDeleteShape(idB);

  return registerAndTessellate(oc, result, resultId);
}

/* ── 모서리 피처 (필렛 / 모따기) ────────────────────────────── */

/**
 * 셰이프의 모서리들을 explorer 순서대로 TopoDS_Edge 배열로 수집한다.
 * **registerAndTessellate 의 모서리 루프와 동일한 순서**여야 edgeId 가 일치한다
 * (둘 다 TopExp_Explorer(shape, TopAbs_EDGE) + TopoDS.Edge(Current)).
 * 반환된 Edge 들은 호출 측이 .delete() 책임을 진다.
 */
function collectEdges(oc: OccInstance, shape: OccShape): OccShape[] {
  const out: OccShape[] = [];
  const exp = new oc.TopExp_Explorer(shape, oc.TopAbs_EDGE);
  try {
    for (; exp.More(); exp.Next()) {
      out.push(oc.TopoDS.prototype.Edge(exp.Current()));
    }
  } finally {
    exp.delete();
  }
  return out;
}

/**
 * 필렛/모따기 공통 본체. kind 에 따라 MakeFillet(반지름) / MakeChamfer(거리).
 * 메모리 규약: maker·수집한 모든 Edge 를 finally 에서 .delete(). 입력 셰이프는 소비.
 */
async function occtEdgeFeature(
  kind: "fillet" | "chamfer",
  shapeId: string,
  edgeIds: number[],
  value: number,
  resultId: string,
): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const src = shapeStore.get(shapeId);
  if (!src) {
    throw new Error("모서리 피처: 입력 셰이프를 찾을 수 없습니다 (OCCT 셰이프만 가능)");
  }

  const edges = collectEdges(oc, src);
  const maker =
    kind === "fillet"
      ? new oc.BRepFilletAPI_MakeFillet(src)
      : new oc.BRepFilletAPI_MakeChamfer(src);
  let result: OccShape;
  try {
    const ids = resolveEdgeIds(edges.length, edgeIds);
    for (const id of ids) {
      const edge = edges[id]!;
      if (kind === "fillet") {
        (maker as OccFilletMaker).Add(value, edge);
      } else {
        (maker as OccChamferMaker).Add(value, edge);
      }
    }
    // Shape() 가 내부적으로 빌드를 수행한다. 기하학적으로 불가능하면 여기서 throw.
    result = maker.Shape();
  } finally {
    maker.delete();
    for (const edge of edges) edge.delete();
  }

  // 입력 소비 (불리언과 동일 규약 — 원본은 결과로 대체된다)
  occtDeleteShape(shapeId);
  return registerAndTessellate(oc, result, resultId);
}

export function occtFillet(
  shapeId: string,
  params: FilletParams,
  resultId: string,
): Promise<TessellatedMesh> {
  return occtEdgeFeature("fillet", shapeId, params.edgeIds, params.radius, resultId);
}

export function occtChamfer(
  shapeId: string,
  params: ChamferParams,
  resultId: string,
): Promise<TessellatedMesh> {
  return occtEdgeFeature("chamfer", shapeId, params.edgeIds, params.distance, resultId);
}

/* ── 면 Push/Pull (평면 면 프리즘 ± 불리언) ──────────────────── */

/**
 * 셰이프의 면들을 explorer 순서대로 TopoDS_Face 배열로 수집한다.
 * **registerAndTessellate 의 면 루프와 동일한 순서** → faceId 가 일치한다.
 * 반환된 Face 들은 호출 측이 .delete() 책임을 진다.
 */
function collectFaces(oc: OccInstance, shape: OccShape): OccShape[] {
  const out: OccShape[] = [];
  const exp = new oc.TopExp_Explorer(shape, oc.TopAbs_FACE);
  try {
    for (; exp.More(); exp.Next()) {
      out.push(oc.TopoDS.prototype.Face(exp.Current()));
    }
  } finally {
    exp.delete();
  }
  return out;
}

/**
 * 평면 면 Push/Pull — 선택 면을 법선×거리 만큼 프리즘 압출 후, 당기기(+)는 Fuse,
 * 밀기(−)는 Cut 한다(압출 벡터가 부호를 그대로 담아 안쪽으로 향하면 재료를 깎는다).
 *
 * ⚠️ device-verify-pending: OCCT WASM 전용이라 헤드리스(CI)에서 런타임 검증 불가.
 *    평면 판정은 store 가 메시로 선검증하므로 여기서는 평면 면을 신뢰한다.
 * 메모리 규약(절대): gp_Vec·프리즘·불리언 maker·수집 Face 전부 .delete(). 입력 셰이프는 소비.
 */
export async function occtFacePushPull(
  shapeId: string,
  params: FacePushPullParams,
  resultId: string,
): Promise<TessellatedMesh> {
  const oc = await loadOcct();
  const src = shapeStore.get(shapeId);
  if (!src) {
    throw new Error("면 Push/Pull: 입력 셰이프를 찾을 수 없습니다 (OCCT 셰이프만 가능)");
  }

  const faces = collectFaces(oc, src);
  try {
    const face = faces[params.faceId];
    if (!face) {
      throw new Error("면 Push/Pull: 선택한 면을 찾을 수 없습니다");
    }
    const { distance, normal } = params;
    // 압출 벡터: 바깥 법선 × distance. 당기기(+)는 바깥, 밀기(−)는 안쪽으로 향한다.
    const vec = new oc.gp_Vec(normal[0] * distance, normal[1] * distance, normal[2] * distance);
    const prism = new oc.BRepPrimAPI_MakePrism(face, vec);
    let result: OccShape;
    try {
      const tool = prism.Shape();
      const maker =
        distance >= 0 ? new oc.BRepAlgoAPI_Fuse(src, tool) : new oc.BRepAlgoAPI_Cut(src, tool);
      try {
        result = maker.Shape();
      } finally {
        maker.delete();
      }
    } finally {
      vec.delete();
      prism.delete();
    }
    // 입력 소비 (필렛/불리언과 동일 규약 — 원본은 결과로 대체된다)
    occtDeleteShape(shapeId);
    return registerAndTessellate(oc, result, resultId);
  } finally {
    for (const face of faces) face.delete();
  }
}

/* ── 테셀레이션 (면 + 모서리) ───────────────────────────────── */

function registerAndTessellate(oc: OccInstance, shape: OccShape, shapeId: string): TessellatedMesh {
  shapeStore.set(shapeId, shape);

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const triFaceId: number[] = [];
  const faceRanges: FaceRange[] = [];
  const edges: EdgePolyline[] = [];

  const mesher = new oc.BRepMesh_IncrementalMesh(shape, 0.1, false, 0.5, false);
  try {
    // 면
    const faceExp = new oc.TopExp_Explorer(shape, oc.TopAbs_FACE);
    let faceId = 0;
    try {
      for (; faceExp.More(); faceExp.Next()) {
        const face = oc.TopoDS.prototype.Face(faceExp.Current());
        const location = new oc.TopLoc_Location();
        try {
          const handle = oc.BRep_Tool.prototype.Triangulation(face, location);
          if (handle.IsNull()) continue;
          const tri = handle.get();
          const trsf = location.Transformation();
          const reversed = face.Orientation() === oc.TopAbs_REVERSED;

          const nodes = tri.Nodes();
          const baseVertex = positions.length / 3;
          const lowerN = nodes.Lower();
          const upperN = nodes.Upper();
          for (let i = lowerN; i <= upperN; i++) {
            const p = nodes.Value(i).Transformed(trsf);
            positions.push(p.X(), p.Y(), p.Z());
            normals.push(0, 0, 0);
          }

          const triangles = tri.Triangles();
          const indexStart = indices.length;
          for (let i = triangles.Lower(); i <= triangles.Upper(); i++) {
            const t = triangles.Value(i);
            let a = t.Value(1) - lowerN + baseVertex;
            let b = t.Value(2) - lowerN + baseVertex;
            const c = t.Value(3) - lowerN + baseVertex;
            if (reversed) {
              const tmp = a;
              a = b;
              b = tmp;
            }
            indices.push(a, b, c);
            triFaceId.push(faceId);
          }
          faceRanges.push({ faceId, start: indexStart, count: indices.length - indexStart });
          faceId += 1;
        } finally {
          location.delete();
        }
      }
    } finally {
      faceExp.delete();
    }

    // 모서리 (3D 곡선을 균일 샘플링)
    const edgeExp = new oc.TopExp_Explorer(shape, oc.TopAbs_EDGE);
    let edgeId = 0;
    try {
      for (; edgeExp.More(); edgeExp.Next()) {
        const edge = oc.TopoDS.prototype.Edge(edgeExp.Current());
        const curve = new oc.BRepAdaptor_Curve(edge);
        try {
          const u0 = curve.FirstParameter();
          const u1 = curve.LastParameter();
          const steps = 24;
          const pts: number[] = [];
          for (let s = 0; s <= steps; s++) {
            const u = u0 + ((u1 - u0) * s) / steps;
            const p = curve.Value(u);
            pts.push(p.X(), p.Y(), p.Z());
          }
          edges.push({ edgeId, positions: new Float32Array(pts) });
          edgeId += 1;
        } finally {
          curve.delete();
        }
      }
    } finally {
      edgeExp.delete();
    }
  } finally {
    mesher.delete();
  }

  computeFlatNormals(positions, indices, normals);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    triFaceId: new Uint32Array(triFaceId),
    faceRanges,
    edges,
    shapeId,
  };
}

/** 삼각형별 면 법선을 정점에 채운다 (평면 면 기준 충분). */
function computeFlatNormals(positions: number[], indices: number[], normals: number[]): void {
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3;
    const ib = indices[i + 1]! * 3;
    const ic = indices[i + 2]! * 3;
    const ax = positions[ia]!, ay = positions[ia + 1]!, az = positions[ia + 2]!;
    const bx = positions[ib]!, by = positions[ib + 1]!, bz = positions[ib + 2]!;
    const cx = positions[ic]!, cy = positions[ic + 1]!, cz = positions[ic + 2]!;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const base of [ia, ib, ic]) {
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i]!, ny = normals[i + 1]!, nz = normals[i + 2]!;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / len;
    normals[i + 1] = ny / len;
    normals[i + 2] = nz / len;
  }
}
