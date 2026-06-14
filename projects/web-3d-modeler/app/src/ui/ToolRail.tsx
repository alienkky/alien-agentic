/**
 * 좌측 툴 레일 (Shapr3D 의 왼쪽 세로 툴바 대응).
 * Phase 1 도구: 프리미티브 생성. (스케치·돌출 등은 후속 페이즈에서 이 레일에 추가)
 */
import { IconButton } from "./IconButton";
import { BoxIcon, CylinderIcon, SphereIcon } from "./icons";
import { useAppStore } from "../store/useAppStore";

export function ToolRail(): JSX.Element {
  const addPrimitive = useAppStore((s) => s.addPrimitive);
  const busy = useAppStore((s) => s.busy);

  return (
    <div className="pointer-events-auto absolute left-3 top-1/2 z-10 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-aa-border bg-aa-surface/90 p-1.5 backdrop-blur">
        <IconButton label="박스 (Box)" onClick={() => void addPrimitive("box")} disabled={busy}>
          <BoxIcon />
        </IconButton>
        <IconButton label="실린더 (Cylinder)" onClick={() => void addPrimitive("cylinder")} disabled={busy}>
          <CylinderIcon />
        </IconButton>
        <IconButton label="구 (Sphere)" onClick={() => void addPrimitive("sphere")} disabled={busy}>
          <SphereIcon />
        </IconButton>
      </div>
    </div>
  );
}
