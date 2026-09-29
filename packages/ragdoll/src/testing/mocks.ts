/**
 * Mock implementations for testing
 */

import type { HeadPose } from "../types";
import type { IHeadPoseController } from "../controllers/interfaces";
import type {
  EventSubscriber,
  StateEvent,
  StateEventEmitter,
} from "../state/types";

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
export class SpyEventBus implements StateEventEmitter {
  public emittedEvents: StateEvent[] = [];
  private subscribers = new Set<EventSubscriber>();

  subscribe(subscriber: EventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  emit(event: StateEvent): void {
    this.emittedEvents.push(event);
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  reset(): void {
    this.emittedEvents = [];
    this.subscribers.clear();
  }
}
