import { test, expect } from "@playwright/test";

/**
 * 구속 슬라이스 4 스모크:
 *  #2 다중 구속 — 두 선분 선택 → 평행 → 둘째 선분이 첫째에 평행 (앵커 고정)
 *  #1 정점 포인터-그랩 — 근접 정점 픽킹 + 드래그 상태 토글
 * 도형/조작은 __alienStore 로 결정론 구동.
 */
type Store = {
  getState: () => {
    selectSketchSegment: (s: number, i: number) => void;
    applyMultiConstraint: (k: string) => void;
    pickSketchVertex: (at: { u: number; v: number }, tol: number) => number | null;
    beginVertexDrag: (v: number) => void;
    endVertexDrag: () => void;
    sketchStrokes: { u: number; v: number }[][];
    sketchDraggingVertex: number | null;
  };
  setState: (patch: Record<string, unknown>) => void;
};

test("다중 구속 — 두 선분 평행", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  const strokes = await page.evaluate(() => {
    const store = (window as unknown as { __alienStore: Store }).__alienStore;
    store.setState({
      sketchActive: true,
      sketchStrokes: [
        [{ u: 0, v: 0 }, { u: 10, v: 0 }], // 선A 수평 (앵커)
        [{ u: 0, v: 5 }, { u: 8, v: 9 }], // 선B 기움
      ],
      sketchConstraints: [],
      sketchSegPair: [],
    });
    store.getState().selectSketchSegment(0, 0);
    store.getState().selectSketchSegment(1, 0);
    store.getState().applyMultiConstraint("parallel");
    return store.getState().sketchStrokes;
  });

  // 선A 불변
  expect(strokes[0]![0]).toEqual({ u: 0, v: 0 });
  expect(strokes[0]![1]).toEqual({ u: 10, v: 0 });
  // 선B 가 수평(=선A 에 평행)으로 → 두 끝 v 동일
  expect(strokes[1]![1]!.v).toBeCloseTo(strokes[1]![0]!.v, 3);
});

test("정점 포인터-그랩 — 근접 픽킹 + 드래그 상태 토글", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/커널 준비됨/)).toBeVisible({ timeout: 30_000 });

  const r = await page.evaluate(() => {
    const store = (window as unknown as { __alienStore: Store }).__alienStore;
    store.setState({
      sketchActive: true,
      sketchStrokes: [
        [{ u: 0, v: 0 }, { u: 10, v: 0 }],
        [{ u: 10, v: 0 }, { u: 10, v: 8 }], // 코너 (10,0) 공유 = 전역 정점 1
      ],
    });
    const st = store.getState();
    const near = st.pickSketchVertex({ u: 10.2, v: 0.1 }, 0.5); // 코너 근처
    const far = st.pickSketchVertex({ u: 50, v: 50 }, 0.5); // 멀리
    st.beginVertexDrag(near!);
    const dragging = store.getState().sketchDraggingVertex;
    store.getState().endVertexDrag();
    const cleared = store.getState().sketchDraggingVertex;
    return { near, far, dragging, cleared };
  });

  expect(r.near).toBe(1); // 공유 코너 전역 인덱스
  expect(r.far).toBeNull();
  expect(r.dragging).toBe(1);
  expect(r.cleared).toBeNull();
});
