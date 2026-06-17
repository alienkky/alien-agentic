/**
 * 한 셰이프 렌더 + 통합 선택(면·모서리·바디).
 *  - 면 탭 → 그 면 선택(하이라이트)
 *  - 모서리 탭 → 그 모서리 선택
 *  - 바디 선택(아이템 패널/더블탭)은 전체 틴트
 *
 * 메타데이터(triFaceId/faceRanges/edges)로 삼각형↔면, 폴리라인↔모서리를 역추적한다.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
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

function edgePoints(positions: Float32Array): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < positions.length; i += 3) {
    out.push([positions[i]!, positions[i + 1]!, positions[i + 2]!]);
  }
  return out;
}

export function ShapeMesh({ mesh }: { mesh: TessellatedMesh }): JSX.Element {
  const setHovered = useAppStore((s) => s.setHovered);
  const selectEntity = useAppStore((s) => s.selectEntity);
  const addMeasurePoint = useAppStore((s) => s.addMeasurePoint);
  const hovered = useAppStore((s) => s.hovered);
  const selection = useAppStore((s) => s.selection);
  const sketchActive = useAppStore((s) => s.sketchActive);
  const displayMode = useAppStore((s) => s.displayMode);
  const showEdges = useAppStore((s) => s.showEdges);
  const sectionActive = useAppStore((s) => s.sectionActive);
  const sectionPlane = useAppStore((s) => s.sectionPlane);

  const clip = useMemo(() => {
    if (!sectionActive || !sectionPlane) return [];
    const n = new THREE.Vector3(...sectionPlane.normal).normalize();
    const p = new THREE.Vector3(...sectionPlane.point);
    return [new THREE.Plane().setFromNormalAndCoplanarPoint(n, p)];
  }, [sectionActive, sectionPlane]);

  const geometry = useMemo(() => buildGeometry(mesh), [mesh]);
  const edges = useMemo(
    () => mesh.edges.map((e) => ({ edgeId: e.edgeId, pts: edgePoints(e.positions) })),
    [mesh],
  );

  const bodySelected = selection.some((it) => it.kind === "body" && it.shapeId === mesh.shapeId);
  const selFaceIds = selection.filter((it) => it.kind === "face" && it.shapeId === mesh.shapeId).map((it) => it.index);
  const selEdgeIds = new Set(
    selection.filter((it) => it.kind === "edge" && it.shapeId === mesh.shapeId).map((it) => it.index),
  );

  const hoverGeo = useMemo(
    () => (hovered?.shapeId === mesh.shapeId ? buildFaceGeometry(mesh, hovered.faceId) : null),
    [mesh, hovered],
  );
  const selFaceGeos = useMemo(
    () => selFaceIds.map((id) => ({ id, geo: buildFaceGeometry(mesh, id) })),
    [mesh, selFaceIds.join(",")],
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
        onPointerMove={
          sketchActive
            ? undefined
            : (e) => {
                e.stopPropagation();
                const faceId = faceIdFromEvent(e);
                if (faceId !== null) setHovered({ shapeId: mesh.shapeId, faceId });
              }
        }
        onPointerOut={sketchActive ? undefined : () => setHovered(null)}
        onClick={
          sketchActive
            ? undefined
            : (e) => {
                e.stopPropagation();
                if (useAppStore.getState().measureActive) {
                  addMeasurePoint([e.point.x, e.point.y, e.point.z]);
                  return;
                }
                const faceId = faceIdFromEvent(e);
                if (faceId !== null) selectEntity({ kind: "face", shapeId: mesh.shapeId, index: faceId });
              }
        }
        onDoubleClick={
          sketchActive
            ? undefined
            : (e) => {
                e.stopPropagation();
                // Shapr3D: 면 더블탭 → 바디 전체 선택. (앞선 단일탭 2회가 면 토글을 상쇄)
                if (useAppStore.getState().measureActive) return;
                selectEntity({ kind: "body", shapeId: mesh.shapeId, index: -1 });
              }
        }
      >
        <meshStandardMaterial
          color={bodySelected ? "#4fd1c5" : "#9aa7bd"}
          emissive={bodySelected ? "#173f3b" : "#000000"}
          metalness={0.1}
          roughness={0.6}
          flatShading
          side={THREE.DoubleSide}
          clippingPlanes={clip}
          wireframe={displayMode === "wireframe"}
          transparent={displayMode === "xray"}
          opacity={displayMode === "xray" ? 0.32 : 1}
          depthWrite={displayMode !== "xray"}
        />
      </mesh>

      {/* 모서리 — 개별 선택 가능 (에지 표시 토글) */}
      {showEdges && edges.map((e) => (
        <Line
          key={e.edgeId}
          points={e.pts}
          color={selEdgeIds.has(e.edgeId) ? "#4fd1c5" : "#0b0e14"}
          lineWidth={selEdgeIds.has(e.edgeId) ? 4 : 2}
          transparent
          opacity={selEdgeIds.has(e.edgeId) ? 1 : 0.55}
          onClick={
            sketchActive
              ? undefined
              : (e2) => {
                  e2.stopPropagation();
                  selectEntity({ kind: "edge", shapeId: mesh.shapeId, index: e.edgeId });
                }
          }
        />
      ))}

      {/* 호버 면 */}
      {hoverGeo && (
        <mesh geometry={hoverGeo} renderOrder={2}>
          <meshBasicMaterial color="#4fd1c5" transparent opacity={0.22} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 선택된 면 */}
      {selFaceGeos.map(
        ({ id, geo }) =>
          geo && (
            <mesh key={id} geometry={geo} renderOrder={3}>
              <meshBasicMaterial color="#4fd1c5" transparent opacity={0.45} depthTest={false} side={THREE.DoubleSide} />
            </mesh>
          ),
      )}
    </group>
  );
}
