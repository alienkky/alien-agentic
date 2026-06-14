/** 스토어의 구면 카메라 상태를 매 프레임 three 카메라에 적용. */
import { useFrame } from "@react-three/fiber";
import { useAppStore } from "../store/useAppStore";
import { toCartesian } from "./cameraMath";

export function CameraRig(): null {
  useFrame(({ camera }) => {
    const cam = useAppStore.getState().camera;
    const [px, py, pz] = toCartesian(cam);
    camera.position.set(px, py, pz);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
  });
  return null;
}
