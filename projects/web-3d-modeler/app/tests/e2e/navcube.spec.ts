import { test, expect } from "@playwright/test";

/**
 * Shapr3D "View Controls" 튜토리얼 슬라이스 스모크 — 네비큐브(View Orientation Cube).
 *  - 면(FRONT) 클릭 → 카메라가 정면 방위/극각으로 스냅.
 *  - 둘레 화살표 클릭 → 90° 스핀으로 방위각 변화.
 * 카메라 상태는 dev 전용 __alienStore 로 결정론 검증한다.
 */
type Cam = { azimuth: number; polar: number };
const readCam = async (page: import("@playwright/test").Page): Promise<Cam> =>
  page.evaluate(
    () =>
      (window as unknown as { __alienStore: { getState: () => { camera: Cam } } }).__alienStore.getState()
        .camera,
  );

test("네비큐브 면(FRONT) 클릭 → 카메라가 정면으로 스냅", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  // CSS-3D 큐브라 합성 클릭의 좌표 히트테스트가 래퍼에 가린다 → 대상 엘리먼트에 직접 click 디스패치.
  // (기하/가시성은 navCubeData 단위테스트가 담당, 여기선 onClick 배선만 결정론 검증.)
  await page.getByTitle("FR").dispatchEvent("click");

  const cam = await readCam(page);
  expect(Math.abs(cam.azimuth)).toBeLessThan(1e-6); // 정면 = 방위 0
  expect(cam.polar).toBeCloseTo(Math.PI / 2, 5); // 수평
});

test("네비큐브 화살표 → 90° 스핀으로 방위각 변화", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  const before = await readCam(page);
  await page.getByTitle("right 90°").dispatchEvent("click");
  const after = await readCam(page);

  expect(after.azimuth - before.azimuth).toBeCloseTo(Math.PI / 2, 5);
});
