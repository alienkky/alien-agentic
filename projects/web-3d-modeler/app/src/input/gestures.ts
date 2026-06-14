/**
 * 제스처 해석기 — 펜·손가락·마우스를 카메라 명령으로 (§2.5 입력 설계 2원칙).
 *
 * 역할 분리:
 *  - 펜/마우스(좌버튼)/손가락 1개 드래그 → 궤도(orbit)
 *  - 마우스(우/중버튼) → 팬(pan)
 *  - 손가락 2개 → 핀치 줌 + 팬
 *  - 휠 → 줌
 *
 * (Phase 2 스케치 모드 진입 시, 펜은 궤도가 아니라 '그리기'로 전환된다.
 *  그 분기 지점을 위해 입력 종류를 명령에 싣지 않고 여기서 흡수한다.)
 *
 * 이 클래스는 DOM 에 직접 붙지 않는다(순수 로직) — 단위테스트 가능.
 */
import { inputKindFromPointerType, type InputKind } from "./pickTolerance";

export interface OrbitCommand {
  type: "orbit";
  dxPx: number;
  dyPx: number;
}
export interface PanCommand {
  type: "pan";
  dxPx: number;
  dyPx: number;
}
export interface ZoomCommand {
  type: "zoom";
  /** >1 이면 확대(가까이), <1 이면 축소 */
  factor: number;
  centerX: number;
  centerY: number;
}
export type CameraCommand = OrbitCommand | PanCommand | ZoomCommand;

export interface PointerSample {
  pointerId: number;
  x: number;
  y: number;
  pointerType: string;
  /** PointerEvent.buttons 비트마스크 (1=좌, 2=우, 4=중) */
  buttons: number;
}

interface TrackedPointer {
  x: number;
  y: number;
  kind: InputKind;
  buttons: number;
}

export class GestureResolver {
  private readonly pointers = new Map<number, TrackedPointer>();
  /** 직전 2손가락 거리 (핀치 줌 계산용) */
  private lastPinchDist = 0;
  /** 직전 2손가락 중점 (팬 계산용) */
  private lastMidX = 0;
  private lastMidY = 0;

  get activeCount(): number {
    return this.pointers.size;
  }

  down(s: PointerSample): void {
    this.pointers.set(s.pointerId, {
      x: s.x,
      y: s.y,
      kind: inputKindFromPointerType(s.pointerType),
      buttons: s.buttons,
    });
    if (this.pointers.size === 2) {
      this.recomputePinchBaseline();
    }
  }

  /** 포인터 이동 → 0개 이상의 카메라 명령. 호출 측에서 적용. */
  move(s: PointerSample): CameraCommand[] {
    const prev = this.pointers.get(s.pointerId);
    if (!prev) return [];

    const dx = s.x - prev.x;
    const dy = s.y - prev.y;
    prev.x = s.x;
    prev.y = s.y;
    prev.buttons = s.buttons;

    if (this.pointers.size >= 2) {
      return this.resolveTwoFinger();
    }

    // 단일 포인터
    if (prev.kind === "mouse" && (s.buttons & 0b110) !== 0) {
      // 마우스 우/중 버튼 → 팬
      return [{ type: "pan", dxPx: dx, dyPx: dy }];
    }
    // 펜/마우스좌/손가락 → 궤도
    return [{ type: "orbit", dxPx: dx, dyPx: dy }];
  }

  up(pointerId: number): void {
    this.pointers.delete(pointerId);
    if (this.pointers.size === 2) {
      this.recomputePinchBaseline();
    }
  }

  cancel(pointerId: number): void {
    this.up(pointerId);
  }

  wheel(deltaY: number, centerX: number, centerY: number): ZoomCommand {
    // 위로 굴림(deltaY<0) → 확대
    const factor = Math.exp(-deltaY * 0.0015);
    return { type: "zoom", factor, centerX, centerY };
  }

  private resolveTwoFinger(): CameraCommand[] {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return [];

    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    const commands: CameraCommand[] = [];

    if (this.lastPinchDist > 0 && dist > 0) {
      const factor = dist / this.lastPinchDist;
      if (factor !== 1) {
        commands.push({ type: "zoom", factor, centerX: midX, centerY: midY });
      }
    }
    const panDx = midX - this.lastMidX;
    const panDy = midY - this.lastMidY;
    if (panDx !== 0 || panDy !== 0) {
      commands.push({ type: "pan", dxPx: panDx, dyPx: panDy });
    }

    this.lastPinchDist = dist;
    this.lastMidX = midX;
    this.lastMidY = midY;
    return commands;
  }

  private recomputePinchBaseline(): void {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) {
      this.lastPinchDist = 0;
      return;
    }
    this.lastPinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    this.lastMidX = (a.x + b.x) / 2;
    this.lastMidY = (a.y + b.y) / 2;
  }
}
