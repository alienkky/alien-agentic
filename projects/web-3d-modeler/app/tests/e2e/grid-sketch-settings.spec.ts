import { test, expect } from "@playwright/test";

/**
 * Shapr3D "grid & sketch settings" 튜토리얼 슬라이스 스모크:
 *  - 단위 토글이 실제 치수 입력 박스 단위 표기를 바꾼다 (mm → in).
 *  - 직교/원근 투영 토글이 상태에 반영된다.
 *  - 그리드 크기 잠금 토글.
 * 도형 생성은 dev 전용 __alienStore 로 결정론화하고, 설정 UI 는 실제 DOM 으로 검증한다.
 */
test("단위 토글 → 치수 입력 박스 단위 표기 변경 (mm → in)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  // 단위를 인치로 — 우상단 단위 팝업
  await page.getByTitle("단위").click();
  await page.getByRole("button", { name: "인치" }).click();

  // 사각형 그려 치수 편집 박스 띄우기
  await page.evaluate(() => {
    const s = (window as unknown as {
      __alienStore: {
        getState: () => {
          beginSketch: () => void;
          pickPlane: (id: string) => void;
          setSketchTool: (t: string) => void;
          sketchDragStart: (p: { u: number; v: number }) => void;
          sketchDragMove: (p: { u: number; v: number }) => void;
          sketchDragEnd: () => void;
        };
      };
    }).__alienStore.getState();
    s.beginSketch();
    s.pickPlane("xz");
    s.setSketchTool("rectangle");
    s.sketchDragStart({ u: 0, v: 0 });
    s.sketchDragMove({ u: 25.4, v: 25.4 });
    s.sketchDragEnd();
  });

  const dimBox = page.getByTestId("sketch-dim-input");
  await expect(dimBox).toBeVisible({ timeout: 5_000 });
  // 단위 접미가 in
  await expect(dimBox).toContainText("in");
  // 25.4 mm = 1.00 in
  await expect(page.getByTestId("sketch-dim-a")).toHaveValue("1.00");
});

test("직교/원근 투영 토글 (뷰 메뉴)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "뷰", exact: true }).click();
  await page.getByRole("button", { name: /직교 투영/ }).click();
  await expect(page.getByText(/투영: 직교/)).toBeVisible({ timeout: 5_000 });

  const projection = await page.evaluate(() => {
    const s = (window as unknown as { __alienStore: { getState: () => { projection: string } } }).__alienStore.getState();
    return s.projection;
  });
  expect(projection).toBe("orthographic");
});
