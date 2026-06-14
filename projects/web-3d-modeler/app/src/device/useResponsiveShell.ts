/**
 * 반응형 셸 훅 — 폴더블 resize·posture·세그먼트 변화에 반응.
 * Z Fold 6 접고 펼 때 레이아웃이 깨지지 않게 ScreenLayout 을 실시간 제공한다.
 */
import { useEffect, useState } from "react";
import { readScreenLayout, type ScreenLayout, type WindowLike } from "./posture";

function currentLayout(): ScreenLayout {
  const win = window as unknown as WindowLike;
  return readScreenLayout(win);
}

export function useResponsiveShell(): ScreenLayout {
  const [layout, setLayout] = useState<ScreenLayout>(() =>
    typeof window === "undefined"
      ? { posture: "continuous", horizontalSegments: 1, segments: [], width: 0, height: 0 }
      : currentLayout(),
  );

  useEffect(() => {
    const update = () => setLayout(currentLayout());
    update();

    window.addEventListener("resize", update);

    // Device Posture API 변화 (지원 시)
    const posture = (navigator as unknown as { devicePosture?: EventTarget }).devicePosture;
    posture?.addEventListener?.("change", update);

    // Viewport Segments 변화 (지원 시)
    const viewport = (window as unknown as { viewport?: EventTarget }).viewport;
    viewport?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("resize", update);
      posture?.removeEventListener?.("change", update);
      viewport?.removeEventListener?.("change", update);
    };
  }, []);

  return layout;
}
