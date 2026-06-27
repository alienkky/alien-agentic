/**
 * Pointer Events → 카메라 제어 훅 (§2.5 입력 토대).
 *
 * 클릭 vs 드래그 구분: 포인터가 임계값 이상 움직여야 '드래그(궤도)'로 보고 capture 한다.
 * 그 전(탭)은 capture 하지 않아 r3f(3D 객체) 가 클릭/선택을 그대로 받는다.
 * → 탭=선택, 드래그=카메라. (이전엔 down 즉시 capture 해서 클릭 선택이 막혔다.)
 */
import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { GestureResolver, type CameraCommand, type PointerSample } from "./gestures";
import { useAppStore } from "../store/useAppStore";

const DRAG_THRESHOLD_PX = 5;

export interface CameraInputHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onWheel: (e: ReactWheelEvent) => void;
}

interface PendingPointer {
  startX: number;
  startY: number;
  dragging: boolean;
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
  const pending = useRef<Map<number, PendingPointer>>(new Map());
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
        resolver.current.down(sampleOf(e));
        pending.current.set(e.pointerId, { startX: e.clientX, startY: e.clientY, dragging: false });
        // capture 하지 않는다 — 탭이면 r3f 가 클릭을 받아 선택이 되도록.
      },
      onPointerMove: (e) => {
        const st = useAppStore.getState();
        // 이동 기즈모 드래그 중엔 카메라를 멈춘다.
        if (st.gizmoDragging) return;
        // 스케치 중엔 한 손가락 드래그는 '그리기'다 — 카메라 궤도/팬을 막는다(두 손가락 줌은 허용).
        if (st.sketchActive && resolver.current.activeCount < 2) return;
        // 두 손가락 이상: 항상 제스처(핀치/팬)
        if (resolver.current.activeCount >= 2) {
          apply(resolver.current.move(sampleOf(e)));
          return;
        }
        const p = pending.current.get(e.pointerId);
        if (!p) return;
        if (!p.dragging) {
          const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
          if (dist < DRAG_THRESHOLD_PX) return; // 아직 탭 후보 — 카메라 안 움직임
          p.dragging = true;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }
        apply(resolver.current.move(sampleOf(e)));
      },
      onPointerUp: (e) => {
        const p = pending.current.get(e.pointerId);
        if (p?.dragging) (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
        resolver.current.up(e.pointerId);
        pending.current.delete(e.pointerId);
      },
      onPointerCancel: (e) => {
        resolver.current.cancel(e.pointerId);
        pending.current.delete(e.pointerId);
      },
      onWheel: (e) => {
        const rect = (e.currentTarget as Element).getBoundingClientRect();
        apply([resolver.current.wheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top)]);
      },
    };
  }, [orbit, pan, zoom]);
}
