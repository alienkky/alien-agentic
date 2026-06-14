/**
 * Pointer Events → 카메라 제어 훅 (§2.5 입력 토대).
 * 캔버스를 감싸는 div 에 spread 할 핸들러를 돌려준다. 마우스·손가락·펜을 하나의
 * 코드 경로로 처리하고, GestureResolver 가 궤도/팬/줌으로 해석한다.
 */
import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { GestureResolver, type CameraCommand, type PointerSample } from "./gestures";
import { useAppStore } from "../store/useAppStore";

export interface CameraInputHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onWheel: (e: ReactWheelEvent) => void;
}

function sampleOf(e: ReactPointerEvent): PointerSample {
  return {
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    pointerType: e.pointerType,
    buttons: e.buttons,
  };
}

export function useCameraInput(): CameraInputHandlers {
  const resolver = useRef<GestureResolver>(new GestureResolver());
  const orbit = useAppStore((s) => s.orbit);
  const pan = useAppStore((s) => s.pan);
  const zoom = useAppStore((s) => s.zoom);

  return useMemo<CameraInputHandlers>(() => {
    const apply = (commands: CameraCommand[]) => {
      for (const cmd of commands) {
        if (cmd.type === "orbit") orbit(cmd.dxPx, cmd.dyPx);
        else if (cmd.type === "pan") pan(cmd.dxPx, cmd.dyPx);
        else zoom(cmd.factor);
      }
    };

    return {
      onPointerDown: (e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        resolver.current.down(sampleOf(e));
      },
      onPointerMove: (e) => {
        if (resolver.current.activeCount === 0) return;
        apply(resolver.current.move(sampleOf(e)));
      },
      onPointerUp: (e) => {
        (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
        resolver.current.up(e.pointerId);
      },
      onPointerCancel: (e) => {
        resolver.current.cancel(e.pointerId);
      },
      onWheel: (e) => {
        const rect = (e.currentTarget as Element).getBoundingClientRect();
        apply([resolver.current.wheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top)]);
      },
    };
  }, [orbit, pan, zoom]);
}
