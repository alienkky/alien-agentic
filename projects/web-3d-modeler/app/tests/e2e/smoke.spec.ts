import { test, expect } from "@playwright/test";

/**
 * Phase 0~1 스모크: 앱 로드 → 커널 준비 → 프리미티브 추가 → 선택.
 * (결정론적 백엔드 기준. 불리언/OCCT 는 디바이스 검증 대상이라 여기서 다루지 않음.)
 */
test("앱 로드 → 커널 준비 → 박스/실린더 추가 → 선택", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "＋ Box" }).click();
  await expect(page.getByText(/box-1 추가됨/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "＋ Cyl" }).click();
  await expect(page.getByText(/cylinder-2 추가됨/)).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/셰이프 2/)).toBeVisible();
});
