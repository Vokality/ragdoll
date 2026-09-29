import type { FacialMood, FacialAction, HeadPose } from "../types";

/**
 * State change events that can be emitted
 */
export type StateEvent =
  | { type: "moodChanged"; mood: FacialMood; previousMood: FacialMood }
  | {
      type: "actionTriggered";
      action: Exclude<FacialAction, "none">;
      duration?: number;
    }
  | { type: "actionCleared" }
  | { type: "headPoseChanged"; pose: HeadPose }
  | { type: "themeChanged"; themeId: string };

/**
 * Event bus subscriber callback
 */
export type EventSubscriber = (event: StateEvent) => void;

/**
 * Destination for state change events
 */
export interface StateEventEmitter {
  emit(event: StateEvent): void;
}
