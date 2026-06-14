/**
 * 폴더블 화면 인지 (§2.5 폴더블 대응).
 *
 * Z Fold 6 같은 기기: 펼침/접힘 상태(posture)와 힌지로 갈린 화면 세그먼트를 읽는다.
 * 표준 API:
 *  - Device Posture API: navigator.devicePosture.type ("folded" | "continuous")
 *  - Viewport Segments API: window.viewport.segments (힌지로 나뉜 사각형들)
 * 미지원 브라우저(현재 대다수)는 단일 연속 화면으로 폴백한다.
 *
 * 이 함수들은 window-like 객체를 주입받아 단위테스트 가능하다.
 */

export type Posture = "continuous" | "folded";

export interface Segment {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenLayout {
  posture: Posture;
  /** 가로로 나뉜 세그먼트 수 (1 = 분할 없음) */
  horizontalSegments: number;
  segments: Segment[];
  width: number;
  height: number;
}

interface DevicePostureLike {
  type?: string;
}
interface ViewportLike {
  segments?: ReadonlyArray<Segment>;
}
export interface WindowLike {
  innerWidth: number;
  innerHeight: number;
  navigator?: { devicePosture?: DevicePostureLike };
  viewport?: ViewportLike;
}

export function readScreenLayout(win: WindowLike): ScreenLayout {
  const width = win.innerWidth;
  const height = win.innerHeight;

  const postureType = win.navigator?.devicePosture?.type;
  const posture: Posture = postureType === "folded" ? "folded" : "continuous";

  const rawSegments = win.viewport?.segments;
  const segments: Segment[] =
    rawSegments && rawSegments.length > 0
      ? rawSegments.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }))
      : [{ x: 0, y: 0, width, height }];

  // 가로 세그먼트 수: 같은 y 행에 놓인 세그먼트가 2개 이상이면 좌우 분할로 본다.
  const horizontalSegments = countHorizontalSegments(segments);

  return { posture, horizontalSegments, segments, width, height };
}

function countHorizontalSegments(segments: Segment[]): number {
  if (segments.length <= 1) return 1;
  const firstRowY = segments[0]!.y;
  const sameRow = segments.filter((s) => s.y === firstRowY);
  return Math.max(1, sameRow.length);
}

/** 펼친 폴더블에서 화면을 좌우로 쪼갤 수 있는가 (뷰포트↔툴 분할 UX 가능 여부). */
export function canSplitHorizontally(layout: ScreenLayout): boolean {
  return layout.horizontalSegments >= 2;
}
