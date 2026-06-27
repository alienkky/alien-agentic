import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMouse } from "./mouse";
import { meshesToStl } from "../kernel/stlExport";
import { renderMeshPng } from "./renderPreview";

describe("데모: 컴퓨터 마우스 — 스케치→돌출→불리언 파이프라인", () => {
  it("타원 돌출 → 돔 교집합 → 슬롯/홈 빼기 → 유효 솔리드", () => {
    const { mouse, steps } = buildMouse();

    // 각 단계가 삼각형을 만들어내야 한다 (불리언이 빈 결과면 0).
    for (const step of steps) {
      expect(step.positions.length).toBeGreaterThan(0);
      expect(step.indices.length % 3).toBe(0);
    }
    // 최종 마우스는 충분한 면을 가진 솔리드.
    expect(mouse.indices.length / 3).toBeGreaterThan(100);

    // STL 직렬화 → 헤더(84) + 삼각형당 50바이트, 삼각형 수 일치.
    const triCount = mouse.indices.length / 3;
    const stl = meshesToStl([mouse]);
    expect(stl.byteLength).toBe(84 + triCount * 50);
    expect(new DataView(stl).getUint32(80, true)).toBe(triCount);

    // 아티팩트 저장 (기영님 확인용). 저장소 추적 X — demo-out/.
    const stlPath = resolve(__dirname, "../../demo-out/alien-mouse.stl");
    mkdirSync(dirname(stlPath), { recursive: true });
    writeFileSync(stlPath, Buffer.from(stl));

    // PNG 미리보기 (소프트웨어 렌더). 유효 PNG 시그니처 확인.
    const png = renderMeshPng(mouse);
    expect(png[0]).toBe(137);
    expect(png[1]).toBe(80);
    writeFileSync(resolve(__dirname, "../../demo-out/alien-mouse.png"), Buffer.from(png));

    // 4단계 진행 컷도 한 장에 — 단계별로 살짝 띄워 렌더.
    for (let i = 0; i < steps.length; i++) {
      const sp = renderMeshPng(steps[i]!, { width: 520, height: 380 });
      writeFileSync(resolve(__dirname, `../../demo-out/mouse-step-${i + 1}.png`), Buffer.from(sp));
    }
  });
});
