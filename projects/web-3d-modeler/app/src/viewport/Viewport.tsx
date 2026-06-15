/**
 * 뷰포트 — r3f Canvas 를 감싸고, 카메라 입력 핸들러를 div 에 붙인다.
 * touch-action:none(전역 CSS)로 브라우저 기본 제스처를 우리가 가져온다.
 */
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";
import { useCameraInput } from "../input/useCameraInput";
import { useAppStore } from "../store/useAppStore";

export function Viewport(): JSX.Element {
  const input = useCameraInput();
  const clearSelection = useAppStore((s) => s.clearSelection);

  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }} {...input}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 5000, position: [8, 8, 8] }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => {
          // 빈 곳 탭 → 선택 해제 (스케치 중이면 무시)
          if (!useAppStore.getState().sketchActive) clearSelection();
        }}
      >
        <color attach="background" args={["#0b0e14"]} />
        <Scene />
      </Canvas>
    </div>
  );
}
