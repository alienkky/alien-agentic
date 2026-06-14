import { test, expect } from "@playwright/test";

/**
 * Phase 0~1 스모크: 앱 로드 → 프리미티브 → 선택 → 불리언(FAST 메시 CSG).
 * (OCCT B-rep 불리언은 디바이스 검증 대상.)
 */
test("박스 − 실린더 빼기까지", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "박스 (Box)" }).click();
  await expect(page.getByText(/box-1 추가됨/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "실린더 (Cylinder)" }).click();
  await expect(page.getByText(/cylinder-2 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 우측 바디 패널에서 둘 다 선택
  await page.getByRole("button", { name: /box-1/ }).first().click();
  await page.getByRole("button", { name: /cylinder-2/ }).first().click();
  await expect(page.getByText(/불리언/)).toBeVisible();

  // 빼기 → 결과 바디 생성
  await page.getByRole("button", { name: "빼기 (Subtract)" }).click();
  await expect(page.getByText(/빼기 완료/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/바디 \(1\)/)).toBeVisible();
});
