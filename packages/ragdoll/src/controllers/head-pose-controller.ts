import type { HeadPose } from "../types";
import { RagdollSkeleton } from "../models/ragdoll-skeleton";

const MAX_YAW = (35 * Math.PI) / 180;
const MAX_PITCH = (20 * Math.PI) / 180;

export class HeadPoseController {
  private skeleton: RagdollSkeleton;
  private currentPose: HeadPose = { yaw: 0, pitch: 0 };
  private targetPose: HeadPose = { yaw: 0, pitch: 0 };
  private velocity: HeadPose = { yaw: 0, pitch: 0 };
  private transitionDuration = 0.35;

  constructor(skeleton: RagdollSkeleton) {
    this.skeleton = skeleton;
  }

  public setTargetPose(pose: Partial<HeadPose>, duration: number = 0.35): void {
    this.targetPose = {
      yaw:
        pose.yaw !== undefined ? this.clampYaw(pose.yaw) : this.targetPose.yaw,
      pitch:
        pose.pitch !== undefined
          ? this.clampPitch(pose.pitch)
          : this.targetPose.pitch,
    };
    this.transitionDuration = Math.max(0.08, duration);
  }

  public nudge(delta: Partial<HeadPose>, duration: number = 0.25): void {
    this.setTargetPose(
      {
        yaw: this.targetPose.yaw + (delta.yaw ?? 0),
        pitch: this.targetPose.pitch + (delta.pitch ?? 0),
      },
      duration,
    );
  }

  public lookForward(duration: number = 0.25): void {
    this.setTargetPose({ yaw: 0, pitch: 0 }, duration);
  }

  public update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.05);
    const smoothTime = this.transitionDuration;

    const yawResult = this.criticallyDampedSpring(
      this.currentPose.yaw,
      this.targetPose.yaw,
      this.velocity.yaw,
      smoothTime,
      dt,
    );

    const pitchResult = this.criticallyDampedSpring(
      this.currentPose.pitch,
      this.targetPose.pitch,
      this.velocity.pitch,
      smoothTime,
      dt,
    );

    this.currentPose = { yaw: yawResult.value, pitch: pitchResult.value };
    this.velocity = { yaw: yawResult.velocity, pitch: pitchResult.velocity };

    this.applyPose(this.currentPose);
  }

  public getPose(): HeadPose {
    return { ...this.currentPose };
  }

  private applyPose(pose: HeadPose): void {
    this.skeleton.setJointRotation("headPivot", pose.yaw);
    this.skeleton.setJointRotation("neck", pose.pitch);
  }

  private clampYaw(value: number): number {
    return Math.max(-MAX_YAW, Math.min(MAX_YAW, value));
  }

  private clampPitch(value: number): number {
    return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, value));
  }

  private criticallyDampedSpring(
    current: number,
    target: number,
    velocity: number,
    smoothTime: number,
    deltaTime: number,
  ): { value: number; velocity: number } {
    const safeSmooth = Math.max(0.08, smoothTime);
    const omega = 2 / safeSmooth;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    const change = current - target;
    const temp = (velocity + omega * change) * deltaTime;
    const newVelocity = (velocity - omega * temp) * exp;
    const newValue = target + (change + temp) * exp;

    return { value: newValue, velocity: newVelocity };
  }
}
