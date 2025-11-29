import type { HeadPose } from '../types';
import { RagdollSkeleton } from '../models/ragdoll-skeleton';

const MAX_YAW = (35 * Math.PI) / 180;
const MAX_PITCH = (20 * Math.PI) / 180;

export class HeadPoseController {
  private skeleton: RagdollSkeleton;
  private currentPose: HeadPose = { yaw: 0, pitch: 0 };
  private startPose: HeadPose = { yaw: 0, pitch: 0 };
  private targetPose: HeadPose = { yaw: 0, pitch: 0 };
  private transitionDuration = 0.35;
  private elapsed = 0;

  constructor(skeleton: RagdollSkeleton) {
    this.skeleton = skeleton;
  }

  public setTargetPose(pose: Partial<HeadPose>, duration: number = 0.35): void {
    this.startPose = { ...this.currentPose };
    this.targetPose = {
      yaw: pose.yaw !== undefined ? this.clampYaw(pose.yaw) : this.targetPose.yaw,
      pitch: pose.pitch !== undefined ? this.clampPitch(pose.pitch) : this.targetPose.pitch,
    };
    this.transitionDuration = Math.max(0.05, duration);
    this.elapsed = 0;
  }

  public nudge(delta: Partial<HeadPose>, duration: number = 0.25): void {
    this.setTargetPose(
      {
        yaw: this.targetPose.yaw + (delta.yaw ?? 0),
        pitch: this.targetPose.pitch + (delta.pitch ?? 0),
      },
      duration
    );
  }

  public lookForward(duration: number = 0.25): void {
    this.setTargetPose({ yaw: 0, pitch: 0 }, duration);
  }

  public update(deltaTime: number): void {
    if (this.elapsed < this.transitionDuration) {
      this.elapsed += deltaTime;
    }
    const t =
      this.transitionDuration === 0 ? 1 : Math.min(1, this.elapsed / this.transitionDuration);
    const eased = this.easeOutQuad(t);

    this.currentPose = {
      yaw: this.lerp(this.startPose.yaw, this.targetPose.yaw, eased),
      pitch: this.lerp(this.startPose.pitch, this.targetPose.pitch, eased),
    };

    this.applyPose(this.currentPose);
  }

  public getPose(): HeadPose {
    return { ...this.currentPose };
  }

  private applyPose(pose: HeadPose): void {
    this.skeleton.setJointRotation('headPivot', pose.yaw);
    this.skeleton.setJointRotation('neck', pose.pitch);
  }

  private clampYaw(value: number): number {
    return Math.max(-MAX_YAW, Math.min(MAX_YAW, value));
  }

  private clampPitch(value: number): number {
    return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, value));
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}

