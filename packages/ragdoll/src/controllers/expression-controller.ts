import type {
  ExpressionAxes,
  ExpressionAxis,
  ExpressionPatch,
  FacialMood,
} from "../types";
import { RagdollGeometry } from "../models/ragdoll-geometry";
import {
  NO_HEAD_OFFSET,
  type ExpressionConfig,
  type HeadOffset,
  type MoodPose,
} from "../models/ragdoll-geometry";
import {
  applyAxes,
  AXIS_KEYS,
  clampAxis,
  cloneExpression,
  FACE_AXES_CLEARED_ON_SET_MOOD,
} from "../models/expression-axes";
import { ActionController } from "./action-controller";

// Slower than a mood change: a thought drifting, not a reaction.
const POSE_TRANSITION_SECONDS = 0.6;

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

export class ExpressionController {
  private geometry: RagdollGeometry;
  private currentMood: FacialMood = "neutral";
  private transitionStartExpression: ExpressionConfig;
  private targetExpression: ExpressionConfig;
  private currentExpression: ExpressionConfig;
  private transitionProgress = 1;
  private transitionDuration = 0.3;
  private overlayTarget: Partial<ExpressionAxes> = {};
  private overlayVisualStart: ExpressionConfig;
  private overlayProgress = 1;
  private overlayDuration = 0.35;
  private actionController: ActionController;
  // A mood that moves through poses, and where it currently is in them.
  private moodSequence: readonly MoodPose[] | null = null;
  private poseIndex = 0;
  private poseHeld = 0;
  private poseChanged = false;
  // Eased with the face, so the head arrives when the expression does.
  private headStart: HeadOffset = NO_HEAD_OFFSET;
  private headTarget: HeadOffset = NO_HEAD_OFFSET;
  private headOffset: HeadOffset = NO_HEAD_OFFSET;

  constructor(geometry: RagdollGeometry, actionController: ActionController) {
    this.geometry = geometry;
    this.actionController = actionController;
    this.currentExpression = geometry.getExpressionForMood("neutral");
    this.transitionStartExpression = this.currentExpression;
    this.targetExpression = geometry.getExpressionForMood("neutral");
    this.overlayVisualStart = cloneExpression(this.currentExpression);
    this.geometry.setExpression(this.currentExpression);
  }

  public setMood(mood: FacialMood, transitionDuration: number = 0.35): void {
    if (!Number.isFinite(transitionDuration)) {
      throw new Error("duration must be a finite number");
    }
    const mixedNow = this.getMixedExpression();
    const hadFaceOverlay = FACE_AXES_CLEARED_ON_SET_MOOD.some(
      (key) => this.overlayTarget[key] !== undefined,
    );
    if (
      mood === this.currentMood &&
      !hadFaceOverlay &&
      this.overlayProgress >= 1
    ) {
      return;
    }

    const gazeOverlay: Partial<ExpressionAxes> = {};
    if (this.overlayTarget.gazeX !== undefined) {
      gazeOverlay.gazeX = this.overlayTarget.gazeX;
    }
    if (this.overlayTarget.gazeY !== undefined) {
      gazeOverlay.gazeY = this.overlayTarget.gazeY;
    }
    this.overlayTarget = gazeOverlay;
    this.overlayProgress = 1;
    // Gaze stays overlay-only so applyAxes does not double-apply pupilOffset.
    this.transitionStartExpression = cloneExpression(mixedNow);
    this.transitionStartExpression.leftEye.pupilOffset = {
      ...this.currentExpression.leftEye.pupilOffset,
    };
    this.transitionStartExpression.rightEye.pupilOffset = {
      ...this.currentExpression.rightEye.pupilOffset,
    };
    this.currentExpression = this.transitionStartExpression;
    this.transitionProgress = 0;
    this.transitionDuration = Math.max(0.05, transitionDuration);
    this.currentMood = mood;
    this.targetExpression = this.geometry.getExpressionForMood(mood);
    this.moodSequence = this.geometry.getMoodSequence(mood);
    this.poseIndex = 0;
    this.poseHeld = 0;
    this.headStart = this.headOffset;
    this.headTarget = this.moodSequence?.[0].head ?? NO_HEAD_OFFSET;
  }

  public setExpression(patch: ExpressionPatch, duration: number = 0.35): void {
    if (!Number.isFinite(duration)) {
      throw new Error("duration must be a finite number");
    }
    const next: Partial<ExpressionAxes> = { ...this.overlayTarget };
    let wrote = false;
    for (const key of AXIS_KEYS) {
      const value = patch[key];
      if (value === undefined) continue;
      if (!Number.isFinite(value)) {
        throw new Error(`${key} must be a finite number`);
      }
      next[key] = clampAxis(key, value);
      wrote = true;
    }
    if (!wrote) return;
    this.overlayVisualStart = cloneExpression(this.getMixedExpression());
    this.overlayTarget = next;
    this.overlayDuration = duration;
    this.overlayProgress = duration <= 0 ? 1 : 0;
  }

  /**
   * Hand axes back to the current mood. Omit `axes` to release all of them,
   * including the otherwise sticky gaze.
   */
  public resetExpression(
    axes: readonly ExpressionAxis[] = AXIS_KEYS,
    duration: number = 0.35,
  ): void {
    if (!Number.isFinite(duration)) {
      throw new Error("duration must be a finite number");
    }
    const owned = axes.filter((key) => this.overlayTarget[key] !== undefined);
    if (owned.length === 0) return;
    this.overlayVisualStart = cloneExpression(this.getMixedExpression());
    const next = { ...this.overlayTarget };
    for (const key of owned) delete next[key];
    this.overlayTarget = next;
    this.overlayDuration = duration;
    this.overlayProgress = duration <= 0 ? 1 : 0;
  }

  public getActionController(): ActionController {
    return this.actionController;
  }

  public update(deltaTime: number): void {
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(
        1,
        this.transitionProgress + deltaTime / this.transitionDuration,
      );
      const t = this.easeInOutCubic(this.transitionProgress);
      this.interpolateExpression(t);
      // Land exactly on the target; a lerp at t=1 can miss it by a rounding.
      this.headOffset =
        this.transitionProgress >= 1
          ? this.headTarget
          : {
              yaw: lerp(this.headStart.yaw, this.headTarget.yaw, t),
              pitch: lerp(this.headStart.pitch, this.headTarget.pitch, t),
              roll: lerp(this.headStart.roll, this.headTarget.roll, t),
            };
    } else if (this.moodSequence) {
      this.advancePose(deltaTime);
    }

    if (this.overlayProgress < 1) {
      this.overlayProgress = Math.min(
        1,
        this.overlayProgress + deltaTime / Math.max(this.overlayDuration, 1e-6),
      );
    }

    this.geometry.setExpression(this.currentExpression);
  }

  /** Head movement the current mood adds on top of the commanded pose. */
  public getHeadOffset(): Readonly<HeadOffset> {
    return this.headOffset;
  }

  /** True once after the mood moved to its next pose; lets the eyes blink. */
  public consumePoseChange(): boolean {
    const changed = this.poseChanged;
    this.poseChanged = false;
    return changed;
  }

  private advancePose(deltaTime: number): void {
    const poses = this.moodSequence;
    if (!poses || poses.length < 2) return;
    this.poseHeld += deltaTime;
    if (this.poseHeld < poses[this.poseIndex].hold) return;
    this.poseIndex = (this.poseIndex + 1) % poses.length;
    this.poseHeld = 0;
    this.poseChanged = true;
    this.transitionStartExpression = this.currentExpression;
    this.targetExpression = poses[this.poseIndex].expression;
    this.headStart = this.headOffset;
    this.headTarget = poses[this.poseIndex].head;
    this.transitionProgress = 0;
    this.transitionDuration = POSE_TRANSITION_SECONDS;
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

  public getAxisOverlay(): Readonly<Partial<ExpressionAxes>> {
    return { ...this.overlayTarget };
  }

  public getMixedExpression(): ExpressionConfig {
    const settled = applyAxes(this.currentExpression, this.overlayTarget);
    if (this.overlayProgress >= 1) return settled;
    return RagdollGeometry.interpolateExpression(
      this.overlayVisualStart,
      settled,
      this.easeInOutCubic(this.overlayProgress),
    );
  }

  public getExpressionWithAction(): ExpressionConfig {
    const mixed = this.getMixedExpression();
    const overlay = this.actionController.getExpressionOverlay(mixed);
    return this.mergeExpressionOverlay(mixed, overlay);
  }

  /**
   * Apply a blink to the current expression (for idle animation)
   */
  public applyBlink(blinkAmount: number): ExpressionConfig {
    const expr = this.getExpressionWithAction();

    if (blinkAmount <= 0) return expr;
    const blink = Math.min(1, blinkAmount);

    return {
      ...expr,
      leftEye: {
        ...expr.leftEye,
        openness: expr.leftEye.openness * (1 - blink),
      },
      rightEye: {
        ...expr.rightEye,
        openness: expr.rightEye.openness * (1 - blink),
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
    this.currentExpression = RagdollGeometry.interpolateExpression(
      this.transitionStartExpression,
      this.targetExpression,
      t,
    );
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
