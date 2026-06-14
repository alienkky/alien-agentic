import { describe, it, expect } from "vitest";
import { readScreenLayout, canSplitHorizontally, type WindowLike } from "./posture";

describe("readScreenLayout — 폴더블 인지 + 폴백", () => {
  it("미지원 브라우저는 단일 연속 화면으로 폴백", () => {
    const win: WindowLike = { innerWidth: 1024, innerHeight: 768 };
    const layout = readScreenLayout(win);
    expect(layout.posture).toBe("continuous");
    expect(layout.horizontalSegments).toBe(1);
    expect(layout.segments).toHaveLength(1);
    expect(canSplitHorizontally(layout)).toBe(false);
  });

  it("접힘 posture 를 읽는다", () => {
    const win: WindowLike = {
      innerWidth: 904,
      innerHeight: 800,
      navigator: { devicePosture: { type: "folded" } },
    };
    expect(readScreenLayout(win).posture).toBe("folded");
  });

  it("좌우로 나뉜 세그먼트 → 가로 분할 가능", () => {
    const win: WindowLike = {
      innerWidth: 1812,
      innerHeight: 800,
      viewport: {
        segments: [
          { x: 0, y: 0, width: 900, height: 800 },
          { x: 912, y: 0, width: 900, height: 800 },
        ],
      },
    };
    const layout = readScreenLayout(win);
    expect(layout.horizontalSegments).toBe(2);
    expect(canSplitHorizontally(layout)).toBe(true);
  });

  it("위아래로 나뉜 세그먼트는 가로 분할로 보지 않는다", () => {
    const win: WindowLike = {
      innerWidth: 900,
      innerHeight: 1612,
      viewport: {
        segments: [
          { x: 0, y: 0, width: 900, height: 800 },
          { x: 0, y: 812, width: 900, height: 800 },
        ],
      },
    };
    const layout = readScreenLayout(win);
    expect(layout.horizontalSegments).toBe(1);
    expect(canSplitHorizontally(layout)).toBe(false);
  });
});
