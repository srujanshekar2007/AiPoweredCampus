'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Grid } from '@react-three/drei';
import { useTwinStore } from '@/store/useTwinStore';
import { CAMERA_FOV, getCampusBounds } from '@/lib/twin/layout';
import { CameraController } from './CameraController';
import { ProceduralBuilding } from './ProceduralBuilding';

interface CampusSceneProps {
  className?: string;
}

/** Lights, ground and every building. Lives inside the <Canvas>. */
function SceneContents() {
  const buildings = useTwinStore((s) => s.data.buildings);
  const bounds = useMemo(() => getCampusBounds(buildings), [buildings]);

  const [cx, , cz] = bounds.center;
  const extent = bounds.radius * 1.8;
  const groundSize = Math.max(400, bounds.radius * 12);

  return (
    <>
      <color attach="background" args={['#e6edf3']} />
      <fog attach="fog" args={['#e6edf3', bounds.radius * 5, bounds.radius * 14]} />

      {/* Lighting */}
      <hemisphereLight args={['#ffffff', '#b8c4d0', 0.75]} />
      <directionalLight
        position={[cx + bounds.radius * 1.2, bounds.radius * 2.2, cz + bounds.radius * 0.8]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={bounds.radius * 8}
        target-position={[cx, 0, cz]}
      />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#dfe7ec" roughness={1} />
      </mesh>
      <Grid
        position={[cx, 0, cz]}
        args={[groundSize, groundSize]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#c3cfd8"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#a9b8c4"
        fadeDistance={bounds.radius * 6}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Buildings: geometry is driven entirely by the database rows. */}
      {buildings.map((building) => (
        <ProceduralBuilding key={building.id} building={building} />
      ))}

      <CameraController />
    </>
  );
}

/** The main R3F canvas for the EcoTwin digital twin. */
export function CampusScene({ className }: CampusSceneProps) {
  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 800, position: [45, 38, 45] }}
      >
        <AdaptiveDpr pixelated />
        <Suspense fallback={null}>
          <SceneContents />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default CampusScene;
