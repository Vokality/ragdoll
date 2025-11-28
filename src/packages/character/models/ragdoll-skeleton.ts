import * as THREE from 'three';
import type { Joint, JointName, Skeleton } from '../types';
import type { SpringConfig } from '../../animation';
import { getSpringPreset, criticallyDampedSpringVec3 } from '../../animation';

/**
 * Joint animation state for smooth interpolation
 */
interface JointAnimationState {
  current: THREE.Vector3;
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  springConfig: SpringConfig;
}

export class RagdollSkeleton {
  public skeleton: Skeleton;
  public skinnedMesh: THREE.SkinnedMesh | null = null;

  /** Animation states for smooth joint interpolation */
  private jointAnimationStates: Map<JointName, JointAnimationState> = new Map();

  constructor() {
    this.skeleton = this.createSkeleton();
    this.initializeAnimationStates();
  }

  /**
   * Initialize spring animation states for all joints
   */
  private initializeAnimationStates(): void {
    this.skeleton.joints.forEach((_joint, name) => {
      const springConfig = getSpringPreset(name);

      this.jointAnimationStates.set(name, {
        current: new THREE.Vector3(),
        target: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        springConfig: {
          // Increase stiffness for more responsive feel while keeping smoothness
          stiffness: springConfig.stiffness * 8,
          damping: springConfig.damping * 4,
          mass: springConfig.mass,
        },
      });
    });
  }

  private createSkeleton(): Skeleton {
    const root = new THREE.Bone();
    root.position.set(0, 0, 0);
    root.name = 'root';

    const headPivot = new THREE.Bone();
    headPivot.position.set(0, 0.4, 0);
    headPivot.name = 'headPivot';
    root.add(headPivot);

    const neck = new THREE.Bone();
    neck.position.set(0, 0.08, 0);
    neck.name = 'neck';
    headPivot.add(neck);

    const head = new THREE.Bone();
    head.position.set(0, 0.18, 0);
    head.name = 'head';
    neck.add(head);

    const joints = new Map<JointName, Joint>([
      ['headPivot', this.createJoint('headPivot', headPivot)],
      ['neck', this.createJoint('neck', neck)],
    ]);

    return {
      root,
      joints,
      ikChains: [],
    };
  }

  private createJoint(name: JointName, bone: THREE.Bone): Joint {
    return {
      name,
      bone,
      minAngle: new THREE.Vector3(-Math.PI, -Math.PI, -Math.PI),
      maxAngle: new THREE.Vector3(Math.PI, Math.PI, Math.PI),
      currentAngle: new THREE.Vector3(0, 0, 0),
    };
  }

  /**
   * Set target rotation for a joint (will smoothly interpolate)
   */
  public setJointRotation(jointName: JointName, rotation: THREE.Vector3): void {
    const animState = this.jointAnimationStates.get(jointName);
    if (!animState) return;

    // Set target - actual rotation happens in update()
    animState.target.copy(rotation);
  }

  /**
   * Set joint rotation immediately without interpolation
   * Use sparingly - mainly for initial setup or snapping
   */
  public setJointRotationImmediate(
    jointName: JointName,
    rotation: THREE.Vector3
  ): void {
    const joint = this.skeleton.joints.get(jointName);
    const animState = this.jointAnimationStates.get(jointName);
    if (!joint || !animState) return;

    // Set both current and target to skip interpolation
    animState.current.copy(rotation);
    animState.target.copy(rotation);
    animState.velocity.set(0, 0, 0);

    joint.bone.rotation.setFromVector3(rotation);
    joint.currentAngle.copy(rotation);
  }

  /**
   * Update all joint animations - call this every frame
   */
  public update(deltaTime: number): void {
    this.jointAnimationStates.forEach((animState, jointName) => {
      const joint = this.skeleton.joints.get(jointName);
      if (!joint) return;

      // Calculate smooth time based on spring config
      // Lower stiffness = longer smooth time = more lag
      const smoothTime = 0.1 / animState.springConfig.stiffness;

      // Apply critically damped spring for smooth, non-oscillating motion
      const result = criticallyDampedSpringVec3(
        animState.current,
        animState.target,
        animState.velocity,
        smoothTime,
        deltaTime
      );

      animState.current.copy(result.value);
      animState.velocity.copy(result.velocity);

      // Apply to bone
      joint.bone.rotation.setFromVector3(animState.current);
      joint.currentAngle.copy(animState.current);
    });
  }

  public getJointRotation(jointName: JointName): THREE.Vector3 | null {
    const animState = this.jointAnimationStates.get(jointName);
    return animState ? animState.current.clone() : null;
  }

  /**
   * Get the target rotation (what we're animating towards)
   */
  public getJointTargetRotation(jointName: JointName): THREE.Vector3 | null {
    const animState = this.jointAnimationStates.get(jointName);
    return animState ? animState.target.clone() : null;
  }

  public getBones(): THREE.Bone[] {
    const bones: THREE.Bone[] = [];
    this.skeleton.root.traverse((bone) => {
      if (bone instanceof THREE.Bone) {
        bones.push(bone);
      }
    });
    return bones;
  }

  /**
   * Check if joints are still animating (haven't reached targets)
   */
  public isAnimating(): boolean {
    for (const [, animState] of this.jointAnimationStates) {
      const distance = animState.current.distanceTo(animState.target);
      if (distance > 0.001) return true;
    }
    return false;
  }
}
