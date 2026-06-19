import { test, expect } from "@playwright/test";

/**
 * 구속 슬라이스 3 스모크 — 영구 구속 + 정점 드래그 라이브 재해 (Shapr3D 핵심).
 * 아래변에 수평 구속을 적용(영구 보관)한 뒤 공유 코너를 끌면, 아래변이 수평을 유지하며
 * 반대쪽 끝이 따라 올라온다. (도형/조작은 __alienStore 로 결정론 구동)
 */
test("수평 구속 적용 → 코너 드래그 → 아래변 수평 유지하며 따라옴", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  const out = await page.evaluate(() => {
    const store = (window as unknown as {
      __alienStore: {
        getState: () => {
          applySketchConstraint: (k: string) => void;
          dragSketchVertex: (v: number, t: { u: number; v: number }) => void;
          sketchStrokes: { u: number; v: number }[][];
          sketchConstraints: unknown[];
        };
        setState: (patch: Record<string, unknown>) => void;
      };
    }).__alienStore;
    // ㄴ자: 아래변 (0,0)→(10,1) 기움, 오른변 (10,1)→(10,9). 코너 = 전역 정점 1.
    store.setState({
      sketchActive: true,
      sketchStrokes: [
        [{ u: 0, v: 0 }, { u: 10, v: 1 }],
        [{ u: 10, v: 1 }, { u: 10, v: 9 }],
      ],
      sketchSelectedSeg: { s: 0, i: 0 },
      sketchConstraints: [],
    });
    store.getState().applySketchConstraint("auto"); // 아래변 수평 → 영구 보관
    const persisted = store.getState().sketchConstraints.length;
    store.getState().dragSketchVertex(1, { u: 14, v: 6 }); // 공유 코너를 끌어올림
    return { strokes: store.getState().sketchStrokes, persisted };
  });

  expect(out.persisted).toBe(1); // 구속이 영구 보관됨
  const bottom = out.strokes[0]!;
  const right = out.strokes[1]!;
  // 코너가 드래그 타깃으로
  expect(bottom[1]!.u).toBeCloseTo(14, 3);
  expect(bottom[1]!.v).toBeCloseTo(6, 3);
  // 아래변 수평 유지 → 반대쪽 끝도 v=6 으로 따라옴
  expect(bottom[0]!.v).toBeCloseTo(6, 3);
  // 오른변 시작점(공유 코너)도 동기화
  expect(right[0]!.u).toBeCloseTo(14, 3);
  expect(right[0]!.v).toBeCloseTo(6, 3);
});
