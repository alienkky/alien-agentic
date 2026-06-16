import { describe, it, expect } from "vitest";
import { sketchToolForKey, viewForKey } from "./keyboard";

describe("표준 뷰 단축키 매핑", () => {
  it("숫자키 → 뷰", () => {
    expect(viewForKey("1")).toBe("iso");
    expect(viewForKey("2")).toBe("front");
    expect(viewForKey("4")).toBe("top");
    expect(viewForKey("6")).toBe("right");
    expect(viewForKey("9")).toBeNull();
  });
});

describe("스케치 단축키 매핑", () => {
  it("기본 도구 키", () => {
    expect(sketchToolForKey("l")).toBe("line");
    expect(sketchToolForKey("A")).toBe("arc"); // 대문자도
    expect(sketchToolForKey("r")).toBe("rectangle");
    expect(sketchToolForKey("c")).toBe("circle");
    expect(sketchToolForKey("g")).toBe("polygon");
    expect(sketchToolForKey("i")).toBe("spline");
    expect(sketchToolForKey("t")).toBe("trim");
  });

  it("매핑 없는 키는 null", () => {
    expect(sketchToolForKey("z")).toBeNull();
    expect(sketchToolForKey("Enter")).toBeNull();
  });
});
