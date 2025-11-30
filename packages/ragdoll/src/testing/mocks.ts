/**
 * Mock implementations for testing
 */

import type { HeadPose } from "../types";
import type { IHeadPoseController } from "../controllers/interfaces";

/**
 * Mock HeadPoseController for testing ActionController
 */
export class MockHeadPoseController implements IHeadPoseController {
  private pose: HeadPose = { yaw: 0, pitch: 0 };
  private targetPose: HeadPose = { yaw: 0, pitch: 0 };
  public setTargetPoseCalls: Array<{
    pose: Partial<HeadPose>;
    duration?: number;
  }> = [];
  public lookForwardCalls: Array<{ duration?: number }> = [];

  setTargetPose(pose: Partial<HeadPose>, duration?: number): void {
    this.setTargetPoseCalls.push({ pose, duration });
    this.targetPose = { ...this.targetPose, ...pose };
    this.pose = { ...this.pose, ...pose };
  }

  lookForward(duration?: number): void {
    this.lookForwardCalls.push({ duration });
    this.pose = { yaw: 0, pitch: 0 };
    this.targetPose = { yaw: 0, pitch: 0 };
  }

  getPose(): HeadPose {
    return { ...this.pose };
  }

  update(_deltaTime: number): void {
    // Mock implementation - no interpolation
  }

  reset(): void {
    this.pose = { yaw: 0, pitch: 0 };
    this.targetPose = { yaw: 0, pitch: 0 };
    this.setTargetPoseCalls = [];
    this.lookForwardCalls = [];
  }
}

/**
 * Spy EventBus that tracks all emitted events
 */
export class SpyEventBus {
  public emittedEvents: unknown[] = [];
  private subscribers = new Set<(event: unknown) => void>();

  subscribe(subscriber: (event: unknown) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  emit(event: unknown): void {
    this.emittedEvents.push(event);
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  getHistory(): readonly unknown[] {
    return [...this.emittedEvents];
  }

  clearHistory(): void {
    this.emittedEvents = [];
  }

  reset(): void {
    this.emittedEvents = [];
    this.subscribers.clear();
  }
}
