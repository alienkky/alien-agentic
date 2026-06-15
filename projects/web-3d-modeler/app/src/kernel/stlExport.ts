/**
 * STL 내보내기 — 테셀레이션 메시들을 바이너리 STL 로 직렬화.
 *
 * 바이너리 STL 포맷:
 *   80바이트 헤더 + uint32 삼각형 수 + 삼각형마다 50바이트
 *   (법선 3×float32, 정점 3×(3×float32), uint16 속성).
 *
 * 좌표는 월드 변환(이동 오프셋)을 반영해 굽는다 — 화면에 보이는 그대로 내보낸다.
 */
import type { TessellatedMesh } from "./types";
import type { Vec3 } from "../store/useAppStore";

function triNormal(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): [number, number, number] {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** 한 메시의 삼각형 수 합산. */
function triCount(meshes: TessellatedMesh[]): number {
  return meshes.reduce((n, m) => n + m.indices.length / 3, 0);
}

/**
 * 메시 배열 → 바이너리 STL (ArrayBuffer).
 * transforms 가 있으면 shapeId 별 위치 오프셋을 적용한다.
 */
export function meshesToStl(meshes: TessellatedMesh[], transforms: Record<string, Vec3> = {}): ArrayBuffer {
  const total = triCount(meshes);
  const buffer = new ArrayBuffer(84 + total * 50);
  const view = new DataView(buffer);

  // 헤더 80바이트는 0으로 둔다 (ASCII "solid" 로 시작하면 일부 뷰어가 ASCII 로 오인하므로 비움).
  view.setUint32(80, total, true);

  let offset = 84;
  for (const mesh of meshes) {
    const [ox, oy, oz] = transforms[mesh.shapeId] ?? [0, 0, 0];
    const pos = mesh.positions;
    const idx = mesh.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t]! * 3, i1 = idx[t + 1]! * 3, i2 = idx[t + 2]! * 3;
      const ax = pos[i0]! + ox, ay = pos[i0 + 1]! + oy, az = pos[i0 + 2]! + oz;
      const bx = pos[i1]! + ox, by = pos[i1 + 1]! + oy, bz = pos[i1 + 2]! + oz;
      const cx = pos[i2]! + ox, cy = pos[i2 + 1]! + oy, cz = pos[i2 + 2]! + oz;
      const [nx, ny, nz] = triNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
      view.setFloat32(offset, nx, true); view.setFloat32(offset + 4, ny, true); view.setFloat32(offset + 8, nz, true);
      view.setFloat32(offset + 12, ax, true); view.setFloat32(offset + 16, ay, true); view.setFloat32(offset + 20, az, true);
      view.setFloat32(offset + 24, bx, true); view.setFloat32(offset + 28, by, true); view.setFloat32(offset + 32, bz, true);
      view.setFloat32(offset + 36, cx, true); view.setFloat32(offset + 40, cy, true); view.setFloat32(offset + 44, cz, true);
      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }
  }
  return buffer;
}

/** 브라우저: STL 파일 다운로드 트리거. */
export function downloadStl(meshes: TessellatedMesh[], transforms: Record<string, Vec3>, filename = "alien-space.stl"): void {
  const buffer = meshesToStl(meshes, transforms);
  const blob = new Blob([buffer], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".stl") ? filename : `${filename}.stl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
