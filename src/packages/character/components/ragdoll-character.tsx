import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CharacterController } from '../controllers/character-controller';
import * as THREE from 'three';

interface RagdollCharacterProps {
  onControllerReady?: (controller: CharacterController) => void;
}

export function RagdollCharacter({ onControllerReady }: RagdollCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const characterController = useRef<CharacterController>(new CharacterController());
  const lastTime = useRef<number>(Date.now());

  useEffect(() => {
    // Notify parent that controller is ready
    if (onControllerReady) {
      onControllerReady(characterController.current);
    }

    // Add character group to scene
    if (groupRef.current) {
      const characterGroup = characterController.current.getGroup();
      characterGroup.position.set(0, 0.4, 0);
      characterGroup.scale.set(4, 4, 4);
      groupRef.current.add(characterGroup);
    }

    return () => {
      // Cleanup
      if (groupRef.current && characterController.current) {
        const characterGroup = characterController.current.getGroup();
        groupRef.current.remove(characterGroup);
      }
    };
  }, [onControllerReady]);

  useFrame(() => {
    const now = Date.now();
    const deltaTime = (now - lastTime.current) / 1000;
    lastTime.current = now;

    characterController.current.update(deltaTime);
  });

  return <group ref={groupRef} />;
}
