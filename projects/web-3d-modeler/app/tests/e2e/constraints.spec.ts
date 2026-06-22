import { test, expect } from "@playwright/test";

/**
 * 스케치 구속조건 UI 스모크:
 *  스케치 진입 → 구속조건 패널에 실동작 6종 노출 → 선택 없이 누르면 안내 상태.
 * (선분 3D 피킹은 디바이스/좌표 의존이라 단위테스트가 담당 — 여기선 UI 배선만 검증.)
 */
test("구속조건 패널 — 실동작 버튼 + 선택 안내", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  // 좌측 툴바에서 스케치 진입
  await page.getByRole("button", { name: "스케치" }).click();

  // 구속조건 패널에 실동작 6종이 보인다 (버튼 라벨에 힌트·단축키 텍스트가 붙어 정확매칭 대신 부분매칭)
  await expect(page.getByRole("button", { name: /수평/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /평행/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /직교/ })).toBeVisible();
  await expect(page.getByText("추후(GCS 솔버)")).toBeVisible();

  // 선택 없이 평행(선분 2개 필요) → 안내 상태
  await page.getByRole("button", { name: /평행/ }).click();
  await expect(page.getByText(/선분 2개/)).toBeVisible({ timeout: 10_000 });
});
