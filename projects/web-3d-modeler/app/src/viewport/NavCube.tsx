/**
 * 네비큐브 위젯 (Shapr3D "View Orientation Cube").
 * - 면/꼭짓점 클릭 → 표준·아이소 시점으로 스냅
 * - 큐브를 드래그 → 카메라 궤도(orbit), 마치 Space Mouse 처럼
 * - 더블클릭 → 기본(아이소) 뷰
 * - 둘레 화살표 → 90° 단위 스핀
 * 큐브는 현재 카메라 방향을 거울처럼 반영한다(cubeTransform).
 */
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { CUBE_FACES, CUBE_CORNERS, cubeTransform, cornerTransform } from "./navCubeData";
import type { SpinDir } from "./cameraMath";

const DRAG_THRESHOLD_PX = 4;

export function NavCube(): JSX.Element {
  const orbit = useAppStore((s) => s.orbit);
  const setViewDir = useAppStore((s) => s.setViewDir);
  const setView = useAppStore((s) => s.setView);
  const spin = useAppStore((s) => s.spinView);
  const azimuth = useAppStore((s) => s.camera.azimuth);
  const polar = useAppStore((s) => s.camera.polar);

  // 드래그 추적 — 임계값을 넘으면 클릭(면 선택)을 삼킨다.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    orbit(dx, dy);
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };
  // 드래그였다면 면/꼭짓점 클릭을 무시.
  const swallowedByDrag = () => drag.current?.moved ?? false;

  const Arrow = ({ dir, cls, glyph }: { dir: SpinDir; cls: string; glyph: string }): JSX.Element => (
    <button
      type="button"
      title={`${dir} 90°`}
      onClick={() => spin(dir)}
      className={[
        "absolute flex h-5 w-5 items-center justify-center rounded-full border border-aa-border",
        "bg-aa-surface/90 text-xs text-aa-text-dim aa-hoverable backdrop-blur",
        cls,
      ].join(" ")}
    >
      {glyph}
    </button>
  );

  return (
    <div className="pointer-events-auto absolute right-6 top-24 z-20 select-none" style={{ width: 116, height: 116 }}>
      <Arrow dir="up" glyph="▲" cls="left-1/2 top-0 -translate-x-1/2" />
      <Arrow dir="down" glyph="▼" cls="bottom-0 left-1/2 -translate-x-1/2" />
      <Arrow dir="left" glyph="◀" cls="left-0 top-1/2 -translate-y-1/2" />
      <Arrow dir="right" glyph="▶" cls="right-0 top-1/2 -translate-y-1/2" />

      <div
        title="드래그=회전 · 클릭=면 시점 · 더블클릭=기본 뷰"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setView("iso")}
        className="absolute inset-0 m-auto cursor-grab active:cursor-grabbing"
        style={{ width: 80, height: 80, perspective: 320 }}
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", transform: cubeTransform(azimuth, polar) }}
        >
          {CUBE_FACES.map((f) => (
            <button
              key={f.id}
              type="button"
              title={f.label}
              onClick={() => { if (!swallowedByDrag()) setViewDir(f.dir); }}
              className="absolute flex items-center justify-center border border-aa-accent/40 bg-aa-surface/70 text-[10px] font-semibold tracking-wider text-aa-text-dim backdrop-blur-sm aa-hoverable"
              style={{ width: 72, height: 72, left: 4, top: 4, transform: f.transform, backfaceVisibility: "hidden" }}
            >
              {f.label}
            </button>
          ))}
          {CUBE_CORNERS.map((c) => (
            <button
              key={c.id}
              type="button"
              title="아이소 뷰"
              onClick={() => { if (!swallowedByDrag()) setViewDir(c.dir); }}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aa-accent/60 bg-aa-accent/30 hover:bg-aa-accent"
              style={{ left: 40, top: 40, transform: cornerTransform(c.dir) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
