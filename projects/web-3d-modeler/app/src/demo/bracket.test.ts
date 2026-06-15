import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildBracket } from "./bracket";
import { meshesToStl } from "../kernel/stlExport";
import { renderMeshPng } from "./renderPreview";

describe("데모: 브래킷 — 둥근박스+구멍+보스+보어 파이프라인", () => {
  it("4단계 모두 유효 솔리드 → STL/PNG 산출", () => {
    const { bracket, steps } = buildBracket();
    for (const s of steps) {
      expect(s.positions.length).toBeGreaterThan(0);
      expect(s.indices.length % 3).toBe(0);
    }
    expect(bracket.indices.length / 3).toBeGreaterThan(200);

    const stl = meshesToStl([bracket]);
    expect(new DataView(stl).getUint32(80, true)).toBe(bracket.indices.length / 3);

    const out = resolve(__dirname, "../../demo-out/bracket.stl");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(stl));

    const png = renderMeshPng(bracket, { width: 900, height: 620, yaw: -0.8, pitch: 0.55 });
    expect(png[0]).toBe(137);
    writeFileSync(resolve(__dirname, "../../demo-out/bracket.png"), Buffer.from(png));
  });
});
