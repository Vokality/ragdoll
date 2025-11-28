import { useRef, useCallback, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { RagdollCharacter } from '../../character/components/ragdoll-character';
import { CharacterController } from '../../character/controllers/character-controller';
import * as THREE from 'three';

interface SceneProps {
  onControllerReady: (controller: CharacterController) => void;
}

interface HeadTrackerProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  controller: CharacterController | null;
}

function HeadTracker({ controlsRef, controller }: HeadTrackerProps) {
  const targetRef = useRef(new THREE.Vector3(0, 1.6, 0));

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !controller) return;

    const desired = controller.getHeadWorldPosition();
    desired.y += 0.05;
    targetRef.current.lerp(desired, 0.15);

    controls.target.copy(targetRef.current);
    controls.update();
  });

  return null;
}

export function Scene({ onControllerReady }: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [controller, setController] = useState<CharacterController | null>(null);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    onControllerReady(ctrl);
  }, [onControllerReady]);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.3, 3], fov: 40 }}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      <color attach="background" args={['#0b0c12']} />

      <ambientLight intensity={0.6} color="#fef9e7" />
      <directionalLight
        position={[2, 3, 2]}
        intensity={1.2}
        color="#ffe6d9"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-2, 2, -2]} intensity={0.6} color="#6ac8ff" />
      <pointLight position={[1.5, 1, -1.5]} intensity={0.4} color="#ff9fb2" />
      <spotLight position={[0, 4, 2]} intensity={0.35} angle={0.45} penumbra={0.5} />

      <Environment preset="sunset" />

      <RagdollCharacter onControllerReady={handleControllerReady} />
      <HeadTracker controlsRef={controlsRef} controller={controller} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 1.6, 0]}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(2 * Math.PI) / 3}
      />
    </Canvas>
  );
}
