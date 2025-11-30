import type { FacialMood } from "../types";
import { RagdollGeometry } from "../models/ragdoll-geometry";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import { ActionController } from "./action-controller";

export class ExpressionController {
  private geometry: RagdollGeometry;
  private currentMood: FacialMood = "neutral";
  private previousMood: FacialMood = "neutral";
  private targetExpression: ExpressionConfig;
  private currentExpression: ExpressionConfig;
  private transitionProgress = 1;
  private transitionDuration = 0.3;
  private actionController: ActionController;

  constructor(geometry: RagdollGeometry, actionController: ActionController) {
    this.geometry = geometry;
    this.actionController = actionController;
    this.currentExpression = geometry.getExpressionForMood("neutral");
    this.targetExpression = geometry.getExpressionForMood("neutral");
    this.geometry.setExpression(this.currentExpression);
  }

  public setMood(mood: FacialMood, transitionDuration: number = 0.35): void {
    if (mood === this.currentMood) return;

    this.previousMood = this.currentMood;
    this.currentMood = mood;
    this.targetExpression = this.geometry.getExpressionForMood(mood);
    this.transitionDuration = Math.max(0.05, transitionDuration);
    this.transitionProgress = 0;
  }

  public getActionController(): ActionController {
    return this.actionController;
  }

  public update(deltaTime: number): void {
    // Interpolate mood transition
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(
        1,
        this.transitionProgress + deltaTime / this.transitionDuration,
      );
      const t = this.easeInOutCubic(this.transitionProgress);
      this.interpolateExpression(t);
    }

    // Update action controller (handles action state)
    this.actionController.update(deltaTime);

    this.geometry.setExpression(this.currentExpression);
  }

  public getCurrentMood(): FacialMood {
    return this.currentMood;
  }

  public getActiveAction() {
    return this.actionController.getActiveAction();
  }

  public isTalking(): boolean {
    return this.actionController.isTalking();
  }

  public getActionProgress(): number {
    return this.actionController.getActionProgress();
  }

  public getActionElapsed(): number {
    return this.actionController.getActionElapsed();
  }

  public getExpression(): ExpressionConfig {
    return this.currentExpression;
  }

  /**
   * Get the current expression with action overlay applied
   */
  public getExpressionWithAction(): ExpressionConfig {
    const overlay = this.actionController.getExpressionOverlay(
      this.currentExpression,
    );

    return this.mergeExpressionOverlay(this.currentExpression, overlay);
  }

  /**
   * Apply a blink to the current expression (for idle animation)
   */
  public applyBlink(blinkAmount: number): ExpressionConfig {
    const expr = this.getExpressionWithAction();

    if (blinkAmount <= 0) return expr;

    return {
      ...expr,
      leftEye: {
        ...expr.leftEye,
        openness: expr.leftEye.openness * (1 - blinkAmount),
      },
      rightEye: {
        ...expr.rightEye,
        openness: expr.rightEye.openness * (1 - blinkAmount),
      },
    };
  }

  /**
   * Apply micro-movements to pupils (for idle animation)
   */
  public applyPupilOffset(offsetX: number, offsetY: number): void {
    this.currentExpression = {
      ...this.currentExpression,
      leftEye: {
        ...this.currentExpression.leftEye,
        pupilOffset: {
          x: this.currentExpression.leftEye.pupilOffset.x + offsetX,
          y: this.currentExpression.leftEye.pupilOffset.y + offsetY,
        },
      },
      rightEye: {
        ...this.currentExpression.rightEye,
        pupilOffset: {
          x: this.currentExpression.rightEye.pupilOffset.x + offsetX,
          y: this.currentExpression.rightEye.pupilOffset.y + offsetY,
        },
      },
    };
  }

  private mergeExpressionOverlay(
    base: ExpressionConfig,
    overlay: Partial<ExpressionConfig>,
  ): ExpressionConfig {
    return {
      leftEye: overlay.leftEye ?? base.leftEye,
      rightEye: overlay.rightEye ?? base.rightEye,
      leftEyebrow: overlay.leftEyebrow ?? base.leftEyebrow,
      rightEyebrow: overlay.rightEyebrow ?? base.rightEyebrow,
      mouth: overlay.mouth ?? base.mouth,
      cheekPuff: overlay.cheekPuff ?? base.cheekPuff,
      noseScrunch: overlay.noseScrunch ?? base.noseScrunch,
    };
  }

  private interpolateExpression(t: number): void {
    const prevExpression = this.geometry.getExpressionForMood(
      this.previousMood,
    );
    this.currentExpression = RagdollGeometry.interpolateExpression(
      prevExpression,
      this.targetExpression,
      t,
    );
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
