import { test, expect } from "@playwright/test";

/**
 * Phase 2 슬라이스 3 스모크: 사각형 드래그 → 치수 타이핑 입력 → 도형 정밀 보정.
 *
 * 캔버스 3D 드래그 시뮬레이트가 비결정적이라 dev 모드 윈도우 노출(`__alienStore`) 로
 * 도형 생성 단계만 결정론적으로 구동하고, *치수 입력 UI 자체*는 실제 DOM 클릭/타이핑으로 검증한다.
 */
test("사각형 드래그 → W×H 입력 → 도형 보정", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  // 사각형 그리기 단계를 결정론적으로 — 캔버스 위 정확한 좌표 드래그는 카메라/평면 픽킹에 의존하기 때문.
  await page.evaluate(() => {
    const store = (window as unknown as { __alienStore?: { getState: () => unknown } }).__alienStore;
    if (!store) throw new Error("store not exposed");
    const s = store.getState() as {
      beginSketch: () => void;
      pickPlane: (id: "xz" | "xy" | "yz") => void;
      setSketchTool: (t: string) => void;
      sketchDragStart: (p: { u: number; v: number }) => void;
      sketchDragMove: (p: { u: number; v: number }) => void;
      sketchDragEnd: () => void;
    };
    s.beginSketch();
    s.pickPlane("xz");
    s.setSketchTool("rectangle");
    s.sketchDragStart({ u: 0, v: 0 });
    s.sketchDragMove({ u: 3, v: 2 });
    s.sketchDragEnd();
  });

  // 치수 입력 박스가 떠야 한다
  const dimBox = page.getByTestId("sketch-dim-input");
  await expect(dimBox).toBeVisible({ timeout: 5_000 });

  const aInput = page.getByTestId("sketch-dim-a");
  const bInput = page.getByTestId("sketch-dim-b");
  await expect(aInput).toBeFocused();

  // W=10, H=5 입력 후 Enter
  await aInput.fill("10");
  await bInput.fill("5");
  await bInput.press("Enter");

  // 보정됨 메시지 + 입력 박스 사라짐
  await expect(page.getByText(/치수 보정됨/)).toBeVisible({ timeout: 5_000 });
  await expect(dimBox).toHaveCount(0);

  // 스토어에서 stroke 가 새 좌표인지 검증
  const stroke = await page.evaluate(() => {
    const store = (window as unknown as { __alienStore?: { getState: () => unknown } }).__alienStore!;
    const s = store.getState() as { sketchStrokes: { u: number; v: number }[][] };
    return s.sketchStrokes[0]!;
  });
  expect(stroke).toEqual(
    expect.arrayContaining([
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 5 },
      { u: 0, v: 5 },
    ]),
  );
});

test("거부값(0/음수/NaN) — 도형 그대로 유지", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  await page.evaluate(() => {
    const store = (window as unknown as { __alienStore?: { getState: () => unknown } }).__alienStore!;
    const s = store.getState() as {
      beginSketch: () => void;
      pickPlane: (id: "xz") => void;
      setSketchTool: (t: string) => void;
      sketchDragStart: (p: { u: number; v: number }) => void;
      sketchDragMove: (p: { u: number; v: number }) => void;
      sketchDragEnd: () => void;
    };
    s.beginSketch();
    s.pickPlane("xz");
    s.setSketchTool("circle");
    s.sketchDragStart({ u: 0, v: 0 });
    s.sketchDragMove({ u: 2, v: 0 });
    s.sketchDragEnd();
  });

  const dimBox = page.getByTestId("sketch-dim-input");
  await expect(dimBox).toBeVisible({ timeout: 5_000 });

  const before = await page.evaluate(() => {
    const store = (window as unknown as { __alienStore?: { getState: () => unknown } }).__alienStore!;
    const s = store.getState() as { sketchStrokes: { u: number; v: number }[][] };
    return s.sketchStrokes[0]!.length;
  });

  // 0 입력 → 거부 → 편집 닫힘 + stroke 유지
  await page.getByTestId("sketch-dim-a").fill("0");
  await page.getByTestId("sketch-dim-a").press("Enter");
  await expect(page.getByText(/치수 거부됨/)).toBeVisible({ timeout: 5_000 });
  await expect(dimBox).toHaveCount(0);

  const after = await page.evaluate(() => {
    const store = (window as unknown as { __alienStore?: { getState: () => unknown } }).__alienStore!;
    const s = store.getState() as { sketchStrokes: { u: number; v: number }[][] };
    return s.sketchStrokes[0]!.length;
  });
  expect(after).toBe(before);
});
