/**
 * 스케치 모드 레이어 — 지면(XZ, Y=0)을 탭해 점을 찍고, 진행 중 프로파일을 미리 보여준다.
 * 큰 투명 평면이 레이캐스트를 받아 탭 위치를 지면 좌표로 변환한다.
 */
import { Line } from "@react-three/drei";
import { useAppStore } from "../store/useAppStore";

export function SketchLayer(): JSX.Element | null {
  const active = useAppStore((s) => s.sketchActive);
  const points = useAppStore((s) => s.sketchPoints);
  const addSketchPoint = useAppStore((s) => s.addSketchPoint);

  if (!active) return null;

  const pts3: [number, number, number][] = points.map((p) => [p.x, 0.02, p.z]);
  // 닫힌 루프 미리보기: 점 3개 이상이면 첫 점으로 되돌아오는 선
  const linePts: [number, number, number][] =
    pts3.length >= 2 ? (pts3.length >= 3 ? [...pts3, pts3[0]!] : pts3) : [];

  return (
    <group>
      {/* 레이캐스트용 지면 평면 (거의 투명) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          addSketchPoint({ x: e.point.x, z: e.point.z });
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#4fd1c5" transparent opacity={0.05} />
      </mesh>

      {/* 점 마커 */}
      {pts3.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#4fd1c5" />
        </mesh>
      ))}

      {/* 프로파일 선 */}
      {linePts.length >= 2 && <Line points={linePts} color="#4fd1c5" lineWidth={2} />}
    </group>
  );
}
