/**
 * 한 셰이프(TessellatedMesh)를 렌더 + 면 픽킹.
 *
 * 핵심: r3f 가 주는 교차 삼각형 인덱스(faceIndex)를 triFaceId 로 역추적해
 * '어느 면을 가리켰는지' 안다. 이게 메타데이터 포맷이 살아있다는 증명이다(WORKFLOW §4).
 * 가리킨 면은 오버레이로 하이라이트한다.
 */
import { useMemo } from "react";
import * as THREE from "three";
import type { TessellatedMesh } from "../kernel/types";
import { useAppStore, type FaceRef } from "../store/useAppStore";

function buildGeometry(mesh: TessellatedMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geo;
}

/** 특정 face 의 삼각형만 모은 오버레이 지오메트리. */
function buildFaceGeometry(mesh: TessellatedMesh, faceId: number): THREE.BufferGeometry | null {
  const range = mesh.faceRanges.find((r) => r.faceId === faceId);
  if (!range) return null;
  const positions = new Float32Array(range.count * 3);
  for (let k = 0; k < range.count; k++) {
    const vi = mesh.indices[range.start + k]! * 3;
    positions[k * 3] = mesh.positions[vi]!;
    positions[k * 3 + 1] = mesh.positions[vi + 1]!;
    positions[k * 3 + 2] = mesh.positions[vi + 2]!;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function ShapeMesh({ mesh }: { mesh: TessellatedMesh }): JSX.Element {
  const setHovered = useAppStore((s) => s.setHovered);
  const setSelected = useAppStore((s) => s.setSelected);
  const hovered = useAppStore((s) => s.hovered);
  const selected = useAppStore((s) => s.selected);

  const geometry = useMemo(() => buildGeometry(mesh), [mesh]);

  const highlightFace: FaceRef | null =
    selected?.shapeId === mesh.shapeId
      ? selected
      : hovered?.shapeId === mesh.shapeId
        ? hovered
        : null;

  const highlightGeo = useMemo(
    () => (highlightFace ? buildFaceGeometry(mesh, highlightFace.faceId) : null),
    [mesh, highlightFace],
  );

  const faceIdFromEvent = (e: { faceIndex?: number | null }): number | null => {
    if (e.faceIndex === undefined || e.faceIndex === null) return null;
    const id = mesh.triFaceId[e.faceIndex];
    return id === undefined ? null : id;
  };

  return (
    <group>
      <mesh
        geometry={geometry}
        onPointerMove={(e) => {
          e.stopPropagation();
          const faceId = faceIdFromEvent(e);
          if (faceId !== null) setHovered({ shapeId: mesh.shapeId, faceId });
        }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          const faceId = faceIdFromEvent(e);
          if (faceId !== null) setSelected({ shapeId: mesh.shapeId, faceId });
        }}
      >
        <meshStandardMaterial color="#9aa7bd" metalness={0.1} roughness={0.6} flatShading />
      </mesh>

      {highlightGeo && (
        <mesh geometry={highlightGeo} renderOrder={2}>
          <meshBasicMaterial
            color={selected?.shapeId === mesh.shapeId ? "#4fd1c5" : "#2c8a82"}
            transparent
            opacity={0.45}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
