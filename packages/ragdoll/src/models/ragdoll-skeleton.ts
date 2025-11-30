import type { JointName } from "../types";

/**
 * Joint animation state for smooth interpolation
 */
interface JointAnimationState {
  current: number; // rotation in radians
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;
  mass: number;
}

export interface Skeleton {
  joints: Map<JointName, JointAnimationState>;
}

/**
 * Skeleton that works with SVG transforms
 */
export class RagdollSkeleton {
  public skeleton: Skeleton;
  private jointAnimationStates: Map<JointName, JointAnimationState> = new Map();

  constructor() {
    this.skeleton = this.createSkeleton();
    this.initializeAnimationStates();
  }

  private createSkeleton(): Skeleton {
    return {
      joints: new Map(),
    };
  }

  /**
   * Initialize spring animation states for all joints
   */
  private initializeAnimationStates(): void {
    const joints: JointName[] = ["headPivot", "neck"];

    joints.forEach((name) => {
      const config = this.getSpringConfig(name);
      const animState: JointAnimationState = {
        current: 0,
        target: 0,
        velocity: 0,
        stiffness: config.stiffness,
        damping: config.damping,
        mass: config.mass,
      };

      // Keep a shared reference in both maps so state stays in sync
      this.jointAnimationStates.set(name, animState);
      this.skeleton.joints.set(name, animState);
    });
  }

  private getSpringConfig(jointName: JointName): {
    stiffness: number;
    damping: number;
    mass: number;
  } {
    // Simplified spring configs for 2D
    if (jointName === "headPivot") {
      return { stiffness: 0.85, damping: 0.6, mass: 0.9 };
    }
    if (jointName === "neck") {
      return { stiffness: 0.55, damping: 0.45, mass: 0.5 };
    }
    return { stiffness: 0.65, damping: 0.6, mass: 1.0 };
  }

  /**
   * Set target rotation for a joint (will smoothly interpolate)
   */
  public setJointRotation(jointName: JointName, rotation: number): void {
    const animState = this.jointAnimationStates.get(jointName);
    if (!animState) return;
    animState.target = rotation;
  }

  /**
   * Set joint rotation immediately without interpolation
   */
  public setJointRotationImmediate(
    jointName: JointName,
    rotation: number,
  ): void {
    const animState = this.jointAnimationStates.get(jointName);
    if (!animState) return;

    animState.current = rotation;
    animState.target = rotation;
    animState.velocity = 0;
  }

  /**
   * Update all joint animations - call this every frame
   */
  public update(deltaTime: number): void {
    this.jointAnimationStates.forEach((animState) => {
      const dt = Math.min(deltaTime, 0.05);
      const stiffness = Math.max(0.05, animState.stiffness);
      const dampingFactor = 1 + animState.damping;
      const smoothTime = (0.12 / stiffness) * dampingFactor;

      // Critically damped spring for 2D
      const result = this.criticallyDampedSpring(
        animState.current,
        animState.target,
        animState.velocity,
        smoothTime,
        dt,
      );

      animState.current = result.value;
      animState.velocity = result.velocity;
    });
  }

  public getJointRotation(jointName: JointName): number | null {
    const animState = this.jointAnimationStates.get(jointName);
    return animState ? animState.current : null;
  }

  public getJointTargetRotation(jointName: JointName): number | null {
    const animState = this.jointAnimationStates.get(jointName);
    return animState ? animState.target : null;
  }

  /**
   * Check if joints are still animating
   */
  public isAnimating(): boolean {
    for (const [, animState] of this.jointAnimationStates) {
      const distance = Math.abs(animState.current - animState.target);
      if (distance > 0.001) return true;
    }
    return false;
  }

  /**
   * Critically damped spring for scalar values
   */
  private criticallyDampedSpring(
    current: number,
    target: number,
    velocity: number,
    smoothTime: number,
    deltaTime: number,
  ): { value: number; velocity: number } {
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    const change = current - target;
    const temp = (velocity + omega * change) * deltaTime;

    const newVelocity = (velocity - omega * temp) * exp;
    const newValue = target + (change + temp) * exp;

    return { value: newValue, velocity: newVelocity };
  }
}
