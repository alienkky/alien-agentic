import { test, expect } from "@playwright/test";

/**
 * Phase 0 수직 슬라이스 스모크: 앱이 뜨고, 커널이 준비되고, Box 추가가 동작한다.
 * (결정론적 백엔드 기준 — 전 디바이스 즉시 동작. OCCT 백엔드 검증은 별도.)
 */
test("앱 로드 → 커널 준비 → Box 추가", async ({ page }) => {
  await page.goto("/");

  // 커널 준비 상태바
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  // 캔버스 렌더 확인
  await expect(page.locator("canvas")).toBeVisible();

  // Box 추가
  await page.getByRole("button", { name: "＋ Box" }).click();
  await expect(page.getByText(/박스 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 셰이프 카운트 반영
  await expect(page.getByText(/셰이프 1/)).toBeVisible();
});
