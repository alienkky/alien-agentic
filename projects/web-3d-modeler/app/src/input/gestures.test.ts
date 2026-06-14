import { describe, it, expect } from "vitest";
import { GestureResolver, type PointerSample } from "./gestures";

function s(over: Partial<PointerSample> & { pointerId: number; x: number; y: number }): PointerSample {
  return { pointerType: "touch", buttons: 0, ...over };
}

describe("GestureResolver — 입력 역할 분리", () => {
  it("손가락 1개 드래그 → 궤도", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 100, y: 100 }));
    const cmds = g.move(s({ pointerId: 1, x: 120, y: 110 }));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ type: "orbit", dxPx: 20, dyPx: 10 });
  });

  it("펜 드래그 → 궤도 (Phase 0)", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 0, y: 0, pointerType: "pen" }));
    const cmds = g.move(s({ pointerId: 1, x: 5, y: 0, pointerType: "pen" }));
    expect(cmds[0]?.type).toBe("orbit");
  });

  it("마우스 우버튼 드래그 → 팬", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 0, y: 0, pointerType: "mouse", buttons: 2 }));
    const cmds = g.move(s({ pointerId: 1, x: 10, y: 0, pointerType: "mouse", buttons: 2 }));
    expect(cmds[0]?.type).toBe("pan");
  });

  it("마우스 좌버튼 드래그 → 궤도", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 0, y: 0, pointerType: "mouse", buttons: 1 }));
    const cmds = g.move(s({ pointerId: 1, x: 10, y: 0, pointerType: "mouse", buttons: 1 }));
    expect(cmds[0]?.type).toBe("orbit");
  });

  it("손가락 2개 벌리기 → 줌(확대) 명령 포함", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 100, y: 100 }));
    g.down(s({ pointerId: 2, x: 200, y: 100 })); // 거리 100
    const cmds = g.move(s({ pointerId: 2, x: 300, y: 100 })); // 거리 200 → factor 2
    const zoomCmd = cmds.find((c) => c.type === "zoom");
    expect(zoomCmd).toBeDefined();
    if (zoomCmd && zoomCmd.type === "zoom") {
      expect(zoomCmd.factor).toBeGreaterThan(1);
    }
  });

  it("휠 위로 → 확대(factor>1)", () => {
    const g = new GestureResolver();
    expect(g.wheel(-100, 0, 0).factor).toBeGreaterThan(1);
    expect(g.wheel(100, 0, 0).factor).toBeLessThan(1);
  });

  it("up 후 active 카운트가 줄어든다", () => {
    const g = new GestureResolver();
    g.down(s({ pointerId: 1, x: 0, y: 0 }));
    expect(g.activeCount).toBe(1);
    g.up(1);
    expect(g.activeCount).toBe(0);
  });
});
