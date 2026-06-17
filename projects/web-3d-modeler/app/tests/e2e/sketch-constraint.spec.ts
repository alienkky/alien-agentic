import { test, expect } from "@playwright/test";

/**
 * 스케치 구속 슬라이스 2 스모크: 선택 세그먼트에 수평/수직 구속 적용 (자체 솔버).
 * 기운 ㄴ자(아래변+오른변, 코너 공유)에서 아래변 선택 → "수평/수직" → 아래변 수평,
 * 공유 코너가 오른변에도 동기화되는지 결정론 검증. (도형 주입은 __alienStore)
 */
test("선택 세그먼트 수평 구속 → 코너 공유 동반 이동", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  const after = await page.evaluate(() => {
    const store = (window as unknown as {
      __alienStore: {
        getState: () => { applySketchConstraint: (k: string) => void; sketchStrokes: { u: number; v: number }[][] };
        setState: (patch: Record<string, unknown>) => void;
      };
    }).__alienStore;
    // ㄴ자: 아래변 (0,0)→(10,1) 기움, 오른변 (10,1)→(10,9) 코너 공유
    store.setState({
      sketchActive: true,
      sketchStrokes: [
        [{ u: 0, v: 0 }, { u: 10, v: 1 }],
        [{ u: 10, v: 1 }, { u: 10, v: 9 }],
      ],
      sketchSelectedSeg: { s: 0, i: 0 },
    });
    store.getState().applySketchConstraint("auto");
    return store.getState().sketchStrokes;
  });

  // 아래변 수평 → 끝점 v≈0, 앵커 유지
  expect(after[0]![0]!.v).toBeCloseTo(0, 3);
  expect(after[0]![1]!.v).toBeCloseTo(0, 3);
  // 공유 코너가 오른변 시작점에도 반영
  expect(after[1]![0]!.v).toBeCloseTo(0, 3);
});
