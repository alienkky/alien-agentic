import { test, expect } from "@playwright/test";

/**
 * Phase 0~1 스모크: 앱 로드 → 프리미티브(삽입 플라이아웃) → 항목 패널 다중 선택 → 불리언(도구 플라이아웃).
 * UI 가 Shapr3D식 플라이아웃 툴바로 리팩터됨(PR #18) — 셀렉터를 현재 UI에 맞춤.
 */
test("박스 − 실린더 빼기까지", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  // 삽입 플라이아웃 → 박스
  await page.getByRole("button", { name: "삽입", exact: true }).click();
  await page.getByRole("button", { name: "박스", exact: true }).click();
  await expect(page.getByText(/box-1 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 삽입 플라이아웃 → 실린더
  await page.getByRole("button", { name: "삽입", exact: true }).click();
  await page.getByRole("button", { name: "실린더", exact: true }).click();
  await expect(page.getByText(/cylinder-2 추가됨/)).toBeVisible({ timeout: 15_000 });

  // 항목 패널에서 두 바디 다중 선택 (selectEntity 기본 additive) → 컨텍스트 바 불리언 노출
  await page.getByRole("button", { name: "box-1", exact: true }).click();
  await page.getByRole("button", { name: "cylinder-2", exact: true }).click();
  await expect(page.getByText(/불리언/)).toBeVisible();

  // 컨텍스트 바 → 빼기 → 결과 바디 생성
  await page.getByRole("button", { name: "빼기 (Subtract)" }).click();
  await expect(page.getByText(/빼기 완료/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "bool-3", exact: true })).toBeVisible();
});
