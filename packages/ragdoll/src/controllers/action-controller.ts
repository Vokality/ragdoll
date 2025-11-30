import type { FacialAction, HeadPose } from "../types";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import type { IHeadPoseController } from "./interfaces";

interface ActionState {
  name: Exclude<FacialAction, "none">;
  elapsed: number;
  duration: number;
}

export interface ActionOverlay {
  expression?: Partial<ExpressionConfig>;
  headPose?: Partial<HeadPose>;
}

/**
 * Unified action controller handling wink, talk, shake, and future actions
 */
export class ActionController {
  private actionState: ActionState | null = null;
  private headPoseController: IHeadPoseController;

  constructor(headPoseController: IHeadPoseController) {
    this.headPoseController = headPoseController;
  }


  /**
   * Trigger an action
   */
  public triggerAction(
    action: Exclude<FacialAction, "none">,
    duration?: number,
  ): void {
    const resolvedDuration = duration ?? (action === "shake" ? 0.6 : 0.6);
    this.actionState = {
      name: action,
      elapsed: 0,
      duration: Math.max(0.2, resolvedDuration),
    };
  }

  /**
   * Clear the active action
   */
  public clearAction(): void {
    this.actionState = null;
    // Return head to center when clearing shake
    if (this.headPoseController) {
      this.headPoseController.lookForward(0.2);
    }
  }

  /**
   * Update action state
   */
  public update(deltaTime: number): void {
    if (!this.actionState) {
      return;
    }

    this.actionState.elapsed += deltaTime;

    // Handle shake animation (affects head pose)
    if (this.actionState.name === "shake" && this.headPoseController) {
      if (this.actionState.elapsed >= this.actionState.duration) {
        // Shake complete, return to center
        this.actionState = null;
        this.headPoseController.lookForward(0.2);
      } else {
        // Oscillate head left-right during shake
        const progress = this.actionState.elapsed / this.actionState.duration;
        const frequency = 3; // Number of shakes per duration
        const amplitude = 0.4; // How far to shake (40% of max yaw)
        const MAX_YAW_RAD = (35 * Math.PI) / 180;
        const yaw =
          Math.sin(progress * frequency * Math.PI * 2) *
          amplitude *
          MAX_YAW_RAD;
        // Apply easing to slow down at the end
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const finalYaw = yaw * easeOut;
        this.headPoseController.setTargetPose({ yaw: finalYaw }, 0.15);
      }
    } else if (this.actionState.elapsed >= this.actionState.duration) {
      // Other actions complete naturally
      this.actionState = null;
    }
  }

  /**
   * Get the active action
   */
  public getActiveAction(): FacialAction | null {
    return this.actionState?.name ?? null;
  }

  /**
   * Check if currently talking
   */
  public isTalking(): boolean {
    return this.actionState?.name === "talk";
  }

  /**
   * Get action progress (0 to 1)
   */
  public getActionProgress(): number {
    if (!this.actionState) {
      return 0;
    }
    return Math.min(1, this.actionState.elapsed / this.actionState.duration);
  }

  /**
   * Get elapsed time for current action
   */
  public getActionElapsed(): number {
    return this.actionState?.elapsed ?? 0;
  }

  /**
   * Get expression overlay for current action
   */
  public getExpressionOverlay(
    currentExpression: ExpressionConfig,
  ): Partial<ExpressionConfig> {
    if (!this.actionState) {
      return {};
    }

    const action = this.actionState.name;
    const elapsed = this.actionState.elapsed;

    if (action === "wink") {
      // Wink affects only the right eye (character's left from viewer)
      const progress = Math.min(1, elapsed / 0.4);
      // Quick close, slower open
      const winkCurve =
        progress < 0.3
          ? Math.sin(((progress / 0.3) * Math.PI) / 2)
          : Math.cos((((progress - 0.3) / 0.7) * Math.PI) / 2);

      return {
        rightEye: {
          ...currentExpression.rightEye,
          openness: 1 - winkCurve * 0.95,
        },
        // Slight cheek raise on winking side
        cheekPuff: winkCurve * 0.2,
      };
    }

    if (action === "talk") {
      // Organic talking animation with varied mouth shapes
      const baseFreq = 6;
      const variation = Math.sin(elapsed * 1.7) * 0.3;
      const cycle = Math.sin(elapsed * baseFreq + variation);
      const cycle2 = Math.sin(elapsed * baseFreq * 1.3);

      const openAmount = Math.abs(cycle) * 0.7 + Math.abs(cycle2) * 0.3;

      return {
        mouth: {
          ...currentExpression.mouth,
          upperLipBottom:
            currentExpression.mouth.upperLipBottom + openAmount * 4,
          lowerLipTop: currentExpression.mouth.lowerLipTop + openAmount * 10,
          lowerLipBottom:
            currentExpression.mouth.lowerLipBottom + openAmount * 6,
          width:
            currentExpression.mouth.width * (1 + Math.sin(elapsed * 4) * 0.08),
        },
      };
    }

    // Shake doesn't affect expression
    return {};
  }
}

