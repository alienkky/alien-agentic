/**
 * 면 Push/Pull 드래그 핸들 (Shapr3D 손맛): 평면 면 1개를 선택하면 면 법선 방향 핸들이 뜨고,
 * 끌면 실시간 미리보기로 면이 밀리거나(−) 당겨진다(+). 놓으면 커밋(OCCT=B-rep / FAST=메시).
 * 정밀 입력은 ContextBar→다이얼로그. 드래그 중 gizmoDragging 으로 카메라/픽킹을 막는다.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useAppStore, selectionFace } from "../store/useAppStore";
import type { TessellatedMesh } from "../kernel/types";
import { facePlane, isFacePlanar, meshFacePushPull } from "../kernel/facePushPull";

function PreviewSolid({ mesh }: { mesh: TessellatedMesh }): JSX.Element {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    return g;
  }, [mesh]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#5b9cff" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function FacePushPullDragLayer(): JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const shapes = useAppStore((s) => s.shapes);
  const transforms = useAppStore((s) => s.transforms);
  const drag = useAppStore((s) => s.facePushPullDrag);
  const sketchActive = useAppStore((s) => s.sketchActive);
  const pressing = useRef(false);

  const f = sketchActive ? null : selectionFace(selection);
  const mesh = f ? shapes.find((m) => m.shapeId === f.shapeId) : undefined;
  const plane = mesh && f ? facePlane(mesh, f.faceId) : null;
  const planar = !!(mesh && f && isFacePlanar(mesh, f.faceId));
  const active = !!(drag && f && drag.shapeId === f.shapeId && drag.faceId === f.faceId);
  const distance = active ? drag!.distance : 0;

  // 미리보기는 결정론 메시 변형(평면 면에 정확) — 백엔드와 무관하게 손맛만 보여준다.
  const preview = useMemo(() => {
    if (!mesh || !f || !active || Math.abs(distance) < 1e-6) return null;
    try {
      return meshFacePushPull(mesh, f.faceId, distance, "pp-preview");
    } catch {
      return null;
    }
  }, [mesh, f?.faceId, active, distance]);

  if (!mesh || !f || !plane || !planar) return null;

  const off = transforms[f.shapeId] ?? [0, 0, 0];
  const o: [number, number, number] = [plane.origin[0] + off[0], plane.origin[1] + off[1], plane.origin[2] + off[2]];
  const N = plane.normal;
  const sd = active ? distance : 1.5; // 비활성 시 핸들을 면 바깥 1.5mm 에 띄운다
  const hp: [number, number, number] = [o[0] + N[0] * sd, o[1] + N[1] * sd, o[2] + N[2] * sd];

  return (
    <group>
      {preview && (
        <group position={off}>
          <PreviewSolid mesh={preview} />
        </group>
      )}
      <Line points={[[o[0], o[1], o[2]], hp]} color="#4fd1c5" lineWidth={2} />
      <mesh
        position={hp}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pressing.current = true;
          if (!useAppStore.getState().facePushPullDrag) useAppStore.getState().startFacePushPullDrag();
        }}
        onPointerMove={(e) => {
          if (!pressing.current) return;
          const st = useAppStore.getState();
          if (!st.facePushPullDrag) return;
          e.stopPropagation();
          // 위로 끌면(movementY 음수) 당기기(+), 아래로 끌면 밀기(−).
          st.setFacePushPullDistance(st.facePushPullDrag.distance - e.nativeEvent.movementY * 0.05);
        }}
        onPointerUp={(e) => {
          if (!pressing.current) return;
          pressing.current = false;
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          e.stopPropagation();
          if (useAppStore.getState().facePushPullDrag) useAppStore.getState().commitFacePushPullDrag();
        }}
      >
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshBasicMaterial color={active ? "#5b9cff" : "#4fd1c5"} />
      </mesh>
      {active && Math.abs(distance) > 1e-6 && (
        <Html position={hp} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-1 ring-blue-300">
            {distance >= 0 ? "+" : ""}
            {distance.toFixed(1)} mm
          </div>
        </Html>
      )}
    </group>
  );
}
