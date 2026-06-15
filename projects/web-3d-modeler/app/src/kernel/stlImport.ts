/**
 * STL 불러오기 — 바이너리/ASCII STL → TessellatedMesh.
 *
 * 내보내기(stlExport)의 역방향. 기영님이 받은 .stl 을 다시 앱에 띄워 볼 수 있게 한다.
 * 면 ID 는 메시 수준이라 단일 면(faceId 0). 모서리는 EdgesGeometry 로 복원.
 */
import * as THREE from "three";
import type { TessellatedMesh } from "./types";
import { geometryToTessellated } from "./geometryToTessellated";

/** 헤더(80) + 삼각형수(uint32) + 삼각형당 50바이트 정확히 맞으면 바이너리. */
function isBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const n = new DataView(buffer).getUint32(80, true);
  return buffer.byteLength === 84 + n * 50;
}

function parseBinary(buffer: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buffer);
  const n = dv.getUint32(80, true);
  const positions = new Float32Array(n * 9);
  let o = 84;
  let p = 0;
  for (let i = 0; i < n; i++) {
    o += 12; // 면 법선 건너뜀 (정점에서 다시 계산)
    for (let v = 0; v < 3; v++) {
      positions[p++] = dv.getFloat32(o, true);
      positions[p++] = dv.getFloat32(o + 4, true);
      positions[p++] = dv.getFloat32(o + 8, true);
      o += 12;
    }
    o += 2; // 속성 바이트 수
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function parseAscii(text: string): THREE.BufferGeometry {
  const coords: number[] = [];
  const re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    coords.push(parseFloat(m[1]!), parseFloat(m[2]!), parseFloat(m[3]!));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(coords), 3));
  geo.computeVertexNormals();
  return geo;
}

export function parseStl(buffer: ArrayBuffer, shapeId: string): TessellatedMesh {
  const geo = isBinaryStl(buffer) ? parseBinary(buffer) : parseAscii(new TextDecoder().decode(buffer));
  if (geo.getAttribute("position").count < 3) {
    throw new Error("STL 에서 삼각형을 찾지 못했습니다");
  }
  return geometryToTessellated(geo, shapeId);
}
