/**
 * OCCT 백엔드 (production 경로) — opencascade.js 1.1.1.
 *
 * ⚠️ device-verify-pending: 65MB WASM + 브라우저 실행이 필요해 헤드리스(CI/tsc)에서는
 *    런타임 검증이 불가능하다. tsc·build 는 통과하지만, "박스가 실제로 뜨는지"는
 *    iPad/Galaxy Tab/Z Fold 6 에서 최종 확인한다 (Phase 0 DoD 디바이스 매트릭스).
 *
 * 이 라이브러리는 타입 정의를 제공하지 않는다(.d.ts 없음). 따라서 우리가 호출하는
 * 부분 집합만 facade 인터페이스(OccInstance)로 좁혀 캐스팅으로 격리한다.
 *
 * 메모리 규칙(절대): new 로 만든 OCCT C++ 객체는 반드시 .delete() 한다. 누락 = 누수.
 */
import type { TessellatedMesh, FaceRange, EdgePolyline } from "../types";

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
interface OccMakeBox extends OccDeletable {
  Shape(): OccShape;
}

interface OccInstance {
  BRepPrimAPI_MakeBox: new (dx: number, dy: number, dz: number) => OccMakeBox;
  BRepMesh_IncrementalMesh: new (
    shape: OccShape,
    deflection: number,
    relative: boolean,
    angle: number,
    parallel: boolean,
  ) => OccDeletable;
  TopExp_Explorer: new (shape: OccShape, toFind: number) => OccExplorer;
  TopLoc_Location: new () => OccLocation;
  TopoDS: { prototype: { Face(shape: OccShape): OccShape } };
  BRep_Tool: { prototype: { Triangulation(face: OccShape, loc: OccLocation): OccHandleTriangulation } };
  TopAbs_FACE: number;
  TopAbs_REVERSED: number;
}

type OccFactory = (mod: { locateFile: (path: string) => string }) => unknown;

/* ── 로딩 (싱글톤) ─────────────────────────────────────────── */

let occPromise: Promise<OccInstance> | null = null;

export function loadOcct(): Promise<OccInstance> {
  if (occPromise) return occPromise;
  occPromise = (async () => {
    // 동적 import: OCCT 모드가 켜질 때만 65MB 청크를 가져온다.
    const factoryMod = (await import("opencascade.js/dist/opencascade.wasm.js")) as { default: OccFactory };
    const wasmMod = (await import("opencascade.js/dist/opencascade.wasm.wasm?url")) as { default: string };
    const wasmUrl = wasmMod.default;

    const raw = factoryMod.default({
      locateFile: (path: string) => (path.endsWith(".wasm") ? wasmUrl : path),
    });
    // emscripten: 팩토리가 promise 를 주거나, Module.ready 가 promise 다 — 둘 다 흡수.
    const ready = (raw as { ready?: Promise<OccInstance> }).ready;
    const oc = (await (ready ?? (raw as Promise<OccInstance>))) as OccInstance;
    return oc;
  })();
  return occPromise;
}

/* ── 박스 → 테셀레이션 ──────────────────────────────────────── */

export async function occtMakeBox(
  width: number,
  height: number,
  depth: number,
  shapeId: string,
): Promise<TessellatedMesh> {
  const oc = await loadOcct();

  const maker = new oc.BRepPrimAPI_MakeBox(width, height, depth);
  const shape = maker.Shape();

  // 테셀레이션: 선형 편차 0.1, 각 편차 0.5rad. 적응형 품질은 후속 페이즈.
  const mesher = new oc.BRepMesh_IncrementalMesh(shape, 0.1, false, 0.5, false);

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const triFaceId: number[] = [];
  const faceRanges: FaceRange[] = [];
  const edges: EdgePolyline[] = [];

  const explorer = new oc.TopExp_Explorer(shape, oc.TopAbs_FACE);
  let faceId = 0;
  try {
    for (; explorer.More(); explorer.Next()) {
      const face = oc.TopoDS.prototype.Face(explorer.Current());
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
          // 평면 면 가정 — 정확 법선은 후속(폴리곤 법선/스무딩). 임시 0 채움 후 계산.
          normals.push(0, 0, 0);
        }

        const triangles = tri.Triangles();
        const indexStart = indices.length;
        const lowerT = triangles.Lower();
        const upperT = triangles.Upper();
        for (let i = lowerT; i <= upperT; i++) {
          const t = triangles.Value(i);
          // Poly_Triangle 노드 인덱스는 1-기반 → baseVertex 보정
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
    explorer.delete();
    mesher.delete();
    maker.delete();
    shape.delete();
  }

  computeFlatNormals(positions, indices, normals);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    triFaceId: new Uint32Array(triFaceId),
    faceRanges,
    edges, // 모서리 폴리라인은 Phase 1 에서 TopAbs_EDGE 탐색으로 채운다
    shapeId,
  };
}

/** 삼각형별 면 법선을 정점에 누적·정규화 (평면 면 기준 충분). */
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
