import type { JointName } from "../types";

/**
 * Spring state for one joint's rotation
 */
interface JointSpring {
  current: number; // rotation in radians
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;
}

const SPRING_CONFIG: Record<JointName, { stiffness: number; damping: number }> =
  {
    headPivot: { stiffness: 0.85, damping: 0.6 },
    neck: { stiffness: 0.55, damping: 0.45 },
  };

function createSpring(joint: JointName): JointSpring {
  return { current: 0, target: 0, velocity: 0, ...SPRING_CONFIG[joint] };
}

/**
 * Skeleton for head-pose joint animation
 */
export class RagdollSkeleton {
  private readonly joints: Record<JointName, JointSpring> = {
    headPivot: createSpring("headPivot"),
    neck: createSpring("neck"),
  };

  /**
   * Set target rotation for a joint (will smoothly interpolate)
   */
  public setJointRotation(jointName: JointName, rotation: number): void {
    this.joints[jointName].target = rotation;
  }

  /**
   * Update all joint animations - call this every frame
   */
  public update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.05);
    for (const spring of Object.values(this.joints)) {
      const stiffness = Math.max(0.05, spring.stiffness);
      const smoothTime = (0.12 / stiffness) * (1 + spring.damping);
      const result = criticallyDampedSpring(
        spring.current,
        spring.target,
        spring.velocity,
        smoothTime,
        dt,
      );
      spring.current = result.value;
      spring.velocity = result.velocity;
    }
  }

  public getJointRotation(jointName: JointName): number {
    return this.joints[jointName].current;
  }
}

/**
 * Critically damped spring for scalar values
 */
function criticallyDampedSpring(
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
