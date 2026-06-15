/**
 * 초소형 소프트웨어 렌더러 — GPU 없이 테셀레이션 메시를 PNG 로 굽는다.
 * 데모 산출물(마우스)을 기영님께 바로 보여주기 위한 용도. z-버퍼 + 램버트 음영 + 등각 카메라.
 * 의존성 0 (node zlib 만). 앱 런타임 경로엔 들어가지 않는다.
 */
import { deflateSync } from "node:zlib";
import type { TessellatedMesh } from "../kernel/types";

type V3 = [number, number, number];

function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}
function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}
function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: V3): V3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function dot(a: V3, b: V3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export interface RenderOpts {
  width?: number;
  height?: number;
  yaw?: number;
  pitch?: number;
  base?: V3; // 기본 표면 색 (0..1)
  bg?: V3;
}

/** 메시를 등각 뷰로 래스터라이즈 → RGB 픽셀 버퍼. */
function rasterize(mesh: TessellatedMesh, opts: Required<RenderOpts>): Uint8Array {
  const { width: W, height: H, yaw, pitch, base, bg } = opts;
  const pos = mesh.positions, idx = mesh.indices;

  // 모델 정점 → 뷰 좌표로 회전.
  const view: V3[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    view.push(rotX(rotY([pos[i]!, pos[i + 1]!, pos[i + 2]!], yaw), pitch));
  }
  // 바운드 → 화면 맞춤(orthographic).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of view) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
  }
  const pad = 0.12;
  const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
  const scale = Math.min((W * (1 - 2 * pad)) / spanX, (H * (1 - 2 * pad)) / spanY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // 카메라는 +z 에서 본다 → view.z 가 클수록 가깝다. 가까운 면일수록 depth 0.
  const project = (v: V3): [number, number, number] => [
    W / 2 + (v[0] - cx) * scale,
    H / 2 - (v[1] - cy) * scale, // y 위로
    (maxZ - v[2]) / ((maxZ - minZ) || 1),
  ];

  const px = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { px[i * 3] = bg[0]; px[i * 3 + 1] = bg[1]; px[i * 3 + 2] = bg[2]; }
  const zbuf = new Float32Array(W * H).fill(Infinity);

  // 카메라는 +z 에서 본다. 빛은 좌상단·정면(+z)에서.
  const light = norm([-0.4, 0.7, 0.8]);
  for (let t = 0; t < idx.length; t += 3) {
    const a = view[idx[t]!]!, b = view[idx[t + 1]!]!, c = view[idx[t + 2]!]!;
    let n = norm(cross(sub(b, a), sub(c, a)));
    if (n[2] < 0) n = [-n[0], -n[1], -n[2]]; // 카메라(+z)를 향하도록 정렬
    const shade = 0.25 + 0.75 * Math.max(0, dot(n, light));
    const col: V3 = [base[0] * shade, base[1] * shade, base[2] * shade];
    // 가시성은 z-버퍼가 처리 — 컬링 불필요.
    rasterTri(px, zbuf, W, H, project(a), project(b), project(c), col);
  }

  const out = new Uint8Array(W * H * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(px[i]! * 255)));
  return out;
}

function rasterTri(
  px: Float32Array, zbuf: Float32Array, W: number, H: number,
  pa: [number, number, number], pb: [number, number, number], pc: [number, number, number], col: V3,
): void {
  const minX = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
  const minY = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));
  const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
  if (Math.abs(area) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      const w0 = ((pb[0] - sx) * (pc[1] - sy) - (pb[1] - sy) * (pc[0] - sx)) / area;
      const w1 = ((pc[0] - sx) * (pa[1] - sy) - (pc[1] - sy) * (pa[0] - sx)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * pa[2] + w1 * pb[2] + w2 * pc[2];
      const di = y * W + x;
      if (z >= zbuf[di]!) continue;
      zbuf[di] = z;
      px[di * 3] = col[0]; px[di * 3 + 1] = col[1]; px[di * 3 + 2] = col[2];
    }
  }
}

// ---- 최소 PNG 인코더 (RGB, 8bit, 필터 0) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  dv.setUint32(8 + len, crc);
  return out;
}
function encodePng(rgb: Uint8Array, W: number, H: number): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit, RGB
  // 필터 바이트(0) + 행
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(idat)), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** 메시 → PNG 바이트. */
export function renderMeshPng(mesh: TessellatedMesh, opts: RenderOpts = {}): Uint8Array {
  const full: Required<RenderOpts> = {
    width: opts.width ?? 900,
    height: opts.height ?? 650,
    yaw: opts.yaw ?? -0.95,
    pitch: opts.pitch ?? 0.62,
    base: opts.base ?? [0.31, 0.82, 0.77], // AA 청록
    bg: opts.bg ?? [0.043, 0.055, 0.078],
  };
  return encodePng(rasterize(mesh, full), full.width, full.height);
}
