import { test, expect } from "@playwright/test";

/**
 * Phase 0~1 스모크: 앱 로드 → 프리미티브 → 선택 → 불리언(FAST 메시 CSG).
 * (OCCT B-rep 불리언은 디바이스 검증 대상.)
 */
test("박스 − 실린더 빼기까지", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  // 삽입 플라이아웃 → 박스
  await page.getByRole("button", { name: "삽입" }).click();
  await page.getByRole("button", { name: "박스", exact: true }).click();
  await expect(page.getByText(/box-1 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 삽입 플라이아웃 → 실린더
  await page.getByRole("button", { name: "삽입" }).click();
  await page.getByRole("button", { name: "실린더", exact: true }).click();
  await expect(page.getByText(/cylinder-2 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 우측 항목 패널에서 둘 다 선택 → 컨텍스트바에 불리언 액션 노출
  await page.getByRole("button", { name: /box-1/ }).first().click();
  await page.getByRole("button", { name: /cylinder-2/ }).first().click();

  // 컨텍스트바 빼기 → 결과 바디 생성
  await page.getByRole("button", { name: "빼기 (Subtract)" }).click();
  await expect(page.getByText(/빼기 완료/)).toBeVisible({ timeout: 15_000 });
  // 결과는 단일 바디(bool-3) — 항목 패널에 노출
  await expect(page.getByRole("button", { name: /bool-3/ }).first()).toBeVisible();
});
