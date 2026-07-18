import type { FacialAction } from "../types";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import type { IHeadPoseController } from "./interfaces";

type ExpressionAction = Extract<FacialAction, "wink" | "talk">;

interface ActionState {
  name: Exclude<FacialAction, "none">;
  elapsed: number;
  duration: number;
}

interface ReleasingActionState extends ActionState {
  name: ExpressionAction;
  releaseElapsed: number;
  releaseDuration: number;
}

/**
 * Unified action controller handling wink, talk, shake, and future actions
 */
export class ActionController {
  private actionState: ActionState | null = null;
  private releasingActions: ReleasingActionState[] = [];
  private readonly headPoseController: IHeadPoseController;

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
    this.releaseActiveExpressionAction();
    if (this.actionState?.name === "shake" && action !== "shake") {
      this.headPoseController.lookForward(0.2);
    }

    this.actionState = {
      name: action,
      elapsed: 0,
      duration: Math.max(0.2, duration ?? 0.6),
    };
  }

  /**
   * Clear the active action
   */
  public clearAction(): void {
    if (!this.actionState) {
      return;
    }

    this.releaseActiveExpressionAction();
    if (this.actionState.name === "shake") {
      this.headPoseController.lookForward(0.2);
    }
    this.actionState = null;
  }

  /**
   * Update action state
   */
  public update(deltaTime: number): void {
    this.releasingActions = this.releasingActions
      .map((state) => ({
        ...state,
        releaseElapsed: state.releaseElapsed + deltaTime,
      }))
      .filter((state) => state.releaseElapsed < state.releaseDuration);

    if (!this.actionState) {
      return;
    }

    this.actionState.elapsed += deltaTime;

    // Handle shake animation (affects head pose)
    if (this.actionState.name === "shake") {
      if (this.actionState.elapsed >= this.actionState.duration) {
        // Shake complete, return to center
        this.actionState = null;
        this.headPoseController.lookForward(0.2);
      } else {
        // Oscillate with a zero-amplitude envelope at both ends so the head
        // never snaps into or out of a shake.
        const progress = this.actionState.elapsed / this.actionState.duration;
        const frequency = 3; // Number of shakes per duration
        const amplitude = 0.4; // How far to shake (40% of max yaw)
        const MAX_YAW_RAD = (35 * Math.PI) / 180;
        const envelope = Math.sin(Math.PI * progress);
        const yaw =
          Math.sin(progress * frequency * Math.PI * 2) *
          amplitude *
          MAX_YAW_RAD *
          envelope;
        this.headPoseController.setTargetPose({ yaw }, 0.15);
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
    const expressionStates: Array<{
      state: ActionState & { name: ExpressionAction };
      weight: number;
    }> = this.releasingActions.map((state) => ({
      state,
      weight: 1 - this.smoothstep(state.releaseElapsed / state.releaseDuration),
    }));

    const activeAction = this.actionState;
    if (activeAction && this.isExpressionAction(activeAction.name)) {
      expressionStates.push({
        state: { ...activeAction, name: activeAction.name },
        weight: 1,
      });
    }

    if (expressionStates.length === 0) {
      return {};
    }

    let winkAmount = 0;
    let hasWink = false;
    let talkShape: {
      openAmount: number;
      widthDelta: number;
    } | null = null;

    for (const { state, weight } of expressionStates) {
      const progress = Math.min(1, state.elapsed / state.duration);

      if (state.name === "wink") {
        hasWink = true;
        const curve =
          progress < 0.3
            ? this.easeOutCubic(progress / 0.3)
            : 1 - this.easeInOutCubic((progress - 0.3) / 0.7);
        winkAmount = Math.max(winkAmount, curve * weight);
        continue;
      }

      const baseFreq = 6;
      const variation = Math.sin(state.elapsed * 1.7) * 0.3;
      const cycle = Math.sin(state.elapsed * baseFreq + variation);
      const cycle2 = Math.sin(state.elapsed * baseFreq * 1.3);
      const envelope = Math.min(
        1,
        this.smoothstep(progress / 0.12),
        this.smoothstep((1 - progress) / 0.15),
      );
      const openAmount =
        (Math.abs(cycle) * 0.7 + Math.abs(cycle2) * 0.3) * envelope * weight;
      const widthDelta = Math.sin(state.elapsed * 4) * 0.08 * envelope * weight;

      if (!talkShape || openAmount > talkShape.openAmount) {
        talkShape = { openAmount, widthDelta };
      }
    }

    const overlay: Partial<ExpressionConfig> = {};
    if (hasWink) {
      overlay.rightEye = {
        ...currentExpression.rightEye,
        openness: currentExpression.rightEye.openness * (1 - winkAmount),
      };
      overlay.cheekPuff = Math.min(
        1,
        currentExpression.cheekPuff + winkAmount * 0.2,
      );
    }

    if (talkShape) {
      overlay.mouth = {
        ...currentExpression.mouth,
        upperLipBottom:
          currentExpression.mouth.upperLipBottom + talkShape.openAmount * 1.5,
        lowerLipTop:
          currentExpression.mouth.lowerLipTop + talkShape.openAmount * 6,
        lowerLipBottom:
          currentExpression.mouth.lowerLipBottom + talkShape.openAmount * 6,
        width: currentExpression.mouth.width * (1 + talkShape.widthDelta),
      };
    }

    return overlay;
  }

  private releaseActiveExpressionAction(): void {
    if (!this.actionState || !this.isExpressionAction(this.actionState.name)) {
      return;
    }

    this.releasingActions.push({
      ...this.actionState,
      name: this.actionState.name,
      releaseElapsed: 0,
      releaseDuration: 0.12,
    });
  }

  private isExpressionAction(action: FacialAction): action is ExpressionAction {
    return action === "wink" || action === "talk";
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  }

  private easeInOutCubic(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }

  private smoothstep(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
  }
}
