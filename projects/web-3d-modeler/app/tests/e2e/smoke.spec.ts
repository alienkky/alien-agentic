import { test, expect } from "@playwright/test";

/**
 * Phase 0~1 스모크: 앱 로드 → 커널 준비 → 프리미티브 추가 → 바디 목록 → 선택.
 * (결정론적 백엔드 기준. 불리언/OCCT 는 디바이스 검증 대상.)
 */
test("앱 로드 → 박스/실린더 추가 → 바디 목록 → 선택 컨텍스트", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  // 좌측 툴레일에서 프리미티브 추가
  await page.getByRole("button", { name: "박스 (Box)" }).click();
  await expect(page.getByText(/box-1 추가됨/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "실린더 (Cylinder)" }).click();
  await expect(page.getByText(/cylinder-2 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 우측 바디 패널에 2개
  await expect(page.getByText(/바디 \(2\)/)).toBeVisible();

  // 바디 행 클릭으로 선택 → 컨텍스트바 등장
  await page.getByRole("button", { name: /box-1/ }).first().click();
  await expect(page.getByText(/1\/2 선택/)).toBeVisible();
});
