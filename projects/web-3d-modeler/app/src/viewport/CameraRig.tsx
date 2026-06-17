/** 스토어의 구면 카메라 상태를 매 프레임 three 카메라에 적용 (원근·직교 모두). */
import { useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import { useAppStore } from "../store/useAppStore";
import { toCartesian, orthoZoom } from "./cameraMath";

export function CameraRig(): null {
  useFrame(({ camera, size }) => {
    const st = useAppStore.getState();
    const cam = st.camera;
    const [px, py, pz] = toCartesian(cam);
    camera.position.set(px, py, pz);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    // 직교 카메라는 거리(radius)로 가까워지지 않으므로 zoom 으로 줌을 흉내낸다.
    if (st.projection === "orthographic" && camera instanceof OrthographicCamera) {
      const z = orthoZoom(size.height, cam.radius);
      if (Math.abs(camera.zoom - z) > 1e-4) {
        camera.zoom = z;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}
