import * as THREE from 'three';
import type { HeadPose } from '../types';
import { RagdollSkeleton } from '../models/ragdoll-skeleton';

const MAX_YAW = THREE.MathUtils.degToRad(35);
const MAX_PITCH = THREE.MathUtils.degToRad(20);

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
    const t = this.transitionDuration === 0 ? 1 : Math.min(1, this.elapsed / this.transitionDuration);
    const eased = this.easeOutQuad(t);

    this.currentPose = {
      yaw: THREE.MathUtils.lerp(this.startPose.yaw, this.targetPose.yaw, eased),
      pitch: THREE.MathUtils.lerp(this.startPose.pitch, this.targetPose.pitch, eased),
    };

    this.applyPose(this.currentPose);
  }

  public getPose(): HeadPose {
    return { ...this.currentPose };
  }

  private applyPose(pose: HeadPose): void {
    this.skeleton.setJointRotation('headPivot', new THREE.Vector3(0, pose.yaw, 0));
    this.skeleton.setJointRotation('neck', new THREE.Vector3(pose.pitch, 0, 0));
  }

  private clampYaw(value: number): number {
    return THREE.MathUtils.clamp(value, -MAX_YAW, MAX_YAW);
  }

  private clampPitch(value: number): number {
    return THREE.MathUtils.clamp(value, -MAX_PITCH, MAX_PITCH);
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}
