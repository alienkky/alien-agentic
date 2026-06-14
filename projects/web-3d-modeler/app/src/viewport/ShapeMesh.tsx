/**
 * 한 셰이프(TessellatedMesh)를 렌더 + 면 호버 + 셰이프 선택 + 모서리 표시.
 *
 * 핵심: r3f 교차 삼각형 인덱스(faceIndex)를 triFaceId 로 역추적해 '어느 면인지' 안다
 * (메타데이터 포맷이 살아있다는 증명, WORKFLOW §4). 클릭하면 셰이프를 불리언 선택에 토글.
 */
import { useMemo } from "react";
import * as THREE from "three";
import type { TessellatedMesh } from "../kernel/types";
import { useAppStore } from "../store/useAppStore";

function buildGeometry(mesh: TessellatedMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geo;
}

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

/** 모서리 폴리라인들을 하나의 LineSegments 지오메트리로. */
function buildEdgesGeometry(mesh: TessellatedMesh): THREE.BufferGeometry | null {
  const segs: number[] = [];
  for (const edge of mesh.edges) {
    const p = edge.positions;
    const pointCount = p.length / 3;
    for (let i = 0; i < pointCount - 1; i++) {
      const a = i * 3;
      const b = (i + 1) * 3;
      segs.push(p[a]!, p[a + 1]!, p[a + 2]!, p[b]!, p[b + 1]!, p[b + 2]!);
    }
  }
  if (segs.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
  return geo;
}

export function ShapeMesh({ mesh }: { mesh: TessellatedMesh }): JSX.Element {
  const setHovered = useAppStore((s) => s.setHovered);
  const toggleShapeSelection = useAppStore((s) => s.toggleShapeSelection);
  const hovered = useAppStore((s) => s.hovered);
  const isSelected = useAppStore((s) => s.selectedShapeIds.includes(mesh.shapeId));

  const geometry = useMemo(() => buildGeometry(mesh), [mesh]);
  const edgesGeometry = useMemo(() => buildEdgesGeometry(mesh), [mesh]);

  const hoverGeo = useMemo(
    () => (hovered?.shapeId === mesh.shapeId ? buildFaceGeometry(mesh, hovered.faceId) : null),
    [mesh, hovered],
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
          toggleShapeSelection(mesh.shapeId);
        }}
      >
        <meshStandardMaterial
          color={isSelected ? "#4fd1c5" : "#9aa7bd"}
          emissive={isSelected ? "#173f3b" : "#000000"}
          metalness={0.1}
          roughness={0.6}
          flatShading
        />
      </mesh>

      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color="#0b0e14" transparent opacity={0.55} />
        </lineSegments>
      )}

      {hoverGeo && (
        <mesh geometry={hoverGeo} renderOrder={2}>
          <meshBasicMaterial
            color="#4fd1c5"
            transparent
            opacity={0.35}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
