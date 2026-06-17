/**
 * 방향 큐브(Nav Cube) — Shapr3D 식 우상단 뷰 큐브.
 * 현재 카메라 방위/고도에 맞춰 CSS 3D 큐브가 회전하고, 면을 클릭하면 그 표준 뷰로,
 * 큐브를 더블클릭하면 기본 등각(iso) 뷰로 전환한다.
 *  (3D 회전은 시각용 — 면 클릭→뷰 매핑이 기능의 핵심이라 항상 정확하다.)
 */
import { useAppStore } from "../store/useAppStore";
import type { ViewPreset } from "../viewport/cameraMath";

const SIZE = 64;
const H = SIZE / 2;

const FACES: { view: ViewPreset; label: string; transform: string }[] = [
  { view: "front", label: "앞", transform: `translateZ(${H}px)` },
  { view: "back", label: "뒤", transform: `rotateY(180deg) translateZ(${H}px)` },
  { view: "right", label: "우", transform: `rotateY(90deg) translateZ(${H}px)` },
  { view: "left", label: "좌", transform: `rotateY(-90deg) translateZ(${H}px)` },
  { view: "top", label: "위", transform: `rotateX(90deg) translateZ(${H}px)` },
  { view: "bottom", label: "아래", transform: `rotateX(-90deg) translateZ(${H}px)` },
];

export function NavCube(): JSX.Element {
  const azimuth = useAppStore((s) => s.camera.azimuth);
  const polar = useAppStore((s) => s.camera.polar);
  const setView = useAppStore((s) => s.setView);

  const pitch = (polar * 180) / Math.PI - 90;
  const yaw = -(azimuth * 180) / Math.PI;

  return (
    <div className="pointer-events-auto absolute right-4 top-16 z-20 select-none" style={{ width: SIZE, height: SIZE, perspective: 260 }}>
      <div
        onDoubleClick={() => setView("iso")}
        title="더블클릭 = 기본(등각) 뷰"
        style={{
          width: SIZE,
          height: SIZE,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
          transition: "transform 0.18s ease-out",
        }}
      >
        {FACES.map((f) => (
          <button
            key={f.view}
            type="button"
            onClick={(e) => { e.stopPropagation(); setView(f.view); }}
            style={{ position: "absolute", width: SIZE, height: SIZE, transform: f.transform }}
            className="flex items-center justify-center border border-aa-accent/60 bg-aa-surface/80 text-xs font-semibold text-aa-text backdrop-blur transition-colors hover:bg-aa-accent hover:text-aa-bg"
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
