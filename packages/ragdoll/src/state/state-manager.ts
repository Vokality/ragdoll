import type {
  CharacterState,
  FacialMood,
  FacialAction,
  HeadPose,
} from "../types";
import { EventBus } from "./event-bus";

/**
 * Central state manager for character state
 * Provides single source of truth and event notifications
 */
export class StateManager {
  private currentState: CharacterState;
  private eventBus: EventBus;

  constructor(initialState: CharacterState, eventBus?: EventBus) {
    this.currentState = { ...initialState };
    this.eventBus = eventBus ?? new EventBus();
  }

  /**
   * Get current state snapshot
   */
  public getState(): CharacterState {
    return { ...this.currentState };
  }

  /**
   * Get the event bus for subscribing to state changes
   */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Update mood and emit event
   */
  public setMood(mood: FacialMood, previousMood: FacialMood): void {
    this.currentState.mood = mood;
    this.eventBus.emit({ type: "moodChanged", mood, previousMood });
  }

  /**
   * Update action and emit event
   */
  public setAction(action: FacialAction | null, duration?: number): void {
    const previousAction = this.currentState.action;
    this.currentState.action = action;
    this.currentState.animation.action = action;

    if (action && action !== "none") {
      this.eventBus.emit({
        type: "actionTriggered",
        action: action as Exclude<FacialAction, "none">,
        duration,
      });
    } else if (previousAction && previousAction !== "none") {
      this.eventBus.emit({ type: "actionCleared" });
    }
  }

  /**
   * Update head pose and emit event
   */
  public setHeadPose(pose: HeadPose): void {
    this.currentState.headPose = { ...pose };
    this.eventBus.emit({ type: "headPoseChanged", pose: { ...pose } });
  }

  /**
   * Update action progress
   */
  public setActionProgress(progress: number): void {
    this.currentState.animation.actionProgress = progress;
  }

  /**
   * Update isTalking flag
   */
  public setIsTalking(isTalking: boolean): void {
    this.currentState.animation.isTalking = isTalking;
  }

  /**
   * Update joints (internal use)
   */
  public setJoints(joints: CharacterState["joints"]): void {
    this.currentState.joints = { ...joints };
  }

  /**
   * Batch update multiple state properties
   */
  public updateState(updates: Partial<CharacterState>): void {
    this.currentState = { ...this.currentState, ...updates };
  }
}
