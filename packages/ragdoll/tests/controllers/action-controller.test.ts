import { describe, it, expect, beforeEach } from "bun:test";
import { ActionController } from "../../src/controllers/action-controller";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import { MockHeadPoseController } from "../../src/testing/mocks";
import type { FacialMood } from "../../src/types";
import {
  einsteinVariant,
  getDefaultVariant,
  humanVariant,
} from "../../src/variants";

const MOODS: readonly FacialMood[] = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
  "confusion",
  "thinking",
];

describe("ActionController", () => {
  let mockHeadPose: MockHeadPoseController;
  let controller: ActionController;

  beforeEach(() => {
    mockHeadPose = new MockHeadPoseController();
    controller = new ActionController(mockHeadPose);
  });

  describe("triggerAction", () => {
    it("should trigger wink action with default duration", () => {
      controller.triggerAction("wink");
      expect(controller.getActiveAction()).toBe("wink");
      expect(controller.getActionProgress()).toBe(0);
    });

    it("should trigger talk action with custom duration", () => {
      controller.triggerAction("talk", 1.0);
      expect(controller.getActiveAction()).toBe("talk");
    });

    it("should trigger shake action with custom duration", () => {
      controller.triggerAction("shake", 0.8);
      expect(controller.getActiveAction()).toBe("shake");
    });

    it("should enforce minimum duration of 0.2 seconds", () => {
      controller.triggerAction("wink", 0.1);
      // Should still work but with minimum duration
      expect(controller.getActiveAction()).toBe("wink");
    });
  });

  describe("action completion", () => {
    it("should complete action after duration expires", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.6); // Exceed duration
      expect(controller.getActiveAction()).toBeNull();
    });

    it("should return head to center after shake completes", () => {
      controller.triggerAction("shake", 0.6);
      controller.update(0.7);
      expect(controller.getActiveAction()).toBeNull();
      expect(mockHeadPose.lookForwardCalls.length).toBe(1);
    });

    it("should not return head to center for non-shake actions", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.6);
      expect(mockHeadPose.lookForwardCalls.length).toBe(0);
    });
  });

  describe("shake head pose updates", () => {
    it("should update head pose during shake", () => {
      controller.triggerAction("shake", 0.6);
      controller.update(0.1);
      expect(mockHeadPose.setTargetPoseCalls.length).toBeGreaterThan(0);
    });

    it("should oscillate head left-right during shake", () => {
      controller.triggerAction("shake", 0.6);
      const initialCalls = mockHeadPose.setTargetPoseCalls.length;
      controller.update(0.1);
      controller.update(0.1);
      expect(mockHeadPose.setTargetPoseCalls.length).toBeGreaterThan(
        initialCalls,
      );
    });

    it("should apply easing to shake animation", () => {
      controller.triggerAction("shake", 0.6);
      controller.update(0.1);
      const call = mockHeadPose.setTargetPoseCalls[0];
      expect(call).toBeDefined();
      expect(call.pose.yaw).toBeDefined();
    });

    it("should ease the shake amplitude in and out", () => {
      controller.triggerAction("shake", 1);
      controller.update(0.01);
      const startYaw = Math.abs(
        mockHeadPose.setTargetPoseCalls.at(-1)?.pose.yaw ?? 0,
      );
      controller.update(0.24);
      const middleYaw = Math.abs(
        mockHeadPose.setTargetPoseCalls.at(-1)?.pose.yaw ?? 0,
      );
      controller.update(0.74);
      const endYaw = Math.abs(
        mockHeadPose.setTargetPoseCalls.at(-1)?.pose.yaw ?? 0,
      );

      expect(middleYaw).toBeGreaterThan(startYaw);
      expect(middleYaw).toBeGreaterThan(endYaw);
    });
  });

  describe("multiple rapid action triggers", () => {
    it("should replace previous action when triggering new one", () => {
      controller.triggerAction("wink", 0.5);
      expect(controller.getActiveAction()).toBe("wink");
      controller.triggerAction("talk", 0.5);
      expect(controller.getActiveAction()).toBe("talk");
    });

    it("should reset elapsed time when replacing action", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.2);
      expect(controller.getActionElapsed()).toBeCloseTo(0.2, 2);
      controller.triggerAction("talk", 0.5);
      expect(controller.getActionElapsed()).toBe(0);
    });

    it("should release an interrupted expression without a visual jump", () => {
      const expression = new RagdollGeometry(
        getDefaultVariant(),
      ).getExpressionForMood("neutral");
      controller.triggerAction("wink", 0.5);
      controller.update(0.15);
      const beforeReplacement =
        controller.getExpressionOverlay(expression).rightEye?.openness;

      controller.triggerAction("talk", 0.5);
      const afterReplacement =
        controller.getExpressionOverlay(expression).rightEye?.openness;

      expect(beforeReplacement).toBeDefined();
      expect(afterReplacement).toBe(beforeReplacement);

      controller.update(0.06);
      const releasingOpenness =
        controller.getExpressionOverlay(expression).rightEye?.openness;
      expect(releasingOpenness).toBeGreaterThan(beforeReplacement ?? 0);
      expect(releasingOpenness).toBeLessThan(expression.rightEye.openness);

      controller.update(0.06);
      expect(
        controller.getExpressionOverlay(expression).rightEye,
      ).toBeUndefined();
    });

    it("should smoothly return an interrupted shake to center", () => {
      controller.triggerAction("shake", 0.6);
      controller.update(0.1);
      controller.triggerAction("talk", 0.6);

      expect(mockHeadPose.lookForwardCalls.length).toBe(1);
    });
  });

  describe("action cancellation", () => {
    it("should clear active action", () => {
      controller.triggerAction("wink", 0.5);
      controller.clearAction();
      expect(controller.getActiveAction()).toBeNull();
    });

    it("should return head to center when clearing shake", () => {
      controller.triggerAction("shake", 0.6);
      controller.clearAction();
      expect(mockHeadPose.lookForwardCalls.length).toBe(1);
    });

    it("should not change head pose when clearing a facial action", () => {
      controller.triggerAction("wink", 0.6);
      controller.clearAction();

      expect(mockHeadPose.lookForwardCalls.length).toBe(0);
    });

    it("should release a cancelled facial action without a visual jump", () => {
      const expression = new RagdollGeometry(
        getDefaultVariant(),
      ).getExpressionForMood("neutral");
      controller.triggerAction("talk", 1);
      controller.update(0.2);
      const beforeClear = controller.getExpressionOverlay(expression).mouth;

      controller.clearAction();
      const afterClear = controller.getExpressionOverlay(expression).mouth;

      expect(afterClear).toEqual(beforeClear);

      controller.update(0.06);
      const releasingMouth = controller.getExpressionOverlay(expression).mouth;
      expect(releasingMouth?.lowerLipTop).toBeLessThan(
        beforeClear?.lowerLipTop ?? 0,
      );
      expect(releasingMouth?.lowerLipTop).toBeGreaterThan(
        expression.mouth.lowerLipTop,
      );

      controller.update(0.06);
      expect(controller.getExpressionOverlay(expression).mouth).toBeUndefined();
    });
  });

  describe("progress tracking", () => {
    it("should track action progress from 0 to 1", () => {
      controller.triggerAction("wink", 1.0);
      expect(controller.getActionProgress()).toBe(0);
      controller.update(0.5);
      expect(controller.getActionProgress()).toBeCloseTo(0.5, 2);
      controller.update(0.5);
      // After duration expires, action is cleared so progress is 0
      expect(controller.getActiveAction()).toBeNull();
    });

    it("should cap progress at 1.0", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.4);
      expect(controller.getActionProgress()).toBeLessThanOrEqual(1.0);
      // After duration expires, action is cleared
      controller.update(0.2);
      expect(controller.getActiveAction()).toBeNull();
    });

    it("should track elapsed time", () => {
      controller.triggerAction("wink", 1.0);
      controller.update(0.3);
      expect(controller.getActionElapsed()).toBeCloseTo(0.3, 2);
      controller.update(0.2);
      expect(controller.getActionElapsed()).toBeCloseTo(0.5, 2);
    });
  });

  describe("isTalking", () => {
    it("should return true when talk action is active", () => {
      controller.triggerAction("talk", 0.5);
      expect(controller.isTalking()).toBe(true);
    });

    it("should return false for non-talk actions", () => {
      controller.triggerAction("wink", 0.5);
      expect(controller.isTalking()).toBe(false);
    });

    it("should return false when no action is active", () => {
      expect(controller.isTalking()).toBe(false);
    });
  });

  describe("expression overlay", () => {
    const expression = new RagdollGeometry(
      getDefaultVariant(),
    ).getExpressionForMood("neutral");

    it("should return empty overlay when no action is active", () => {
      const overlay = controller.getExpressionOverlay(expression);
      expect(overlay).toEqual({});
    });

    it("should return wink overlay for wink action", () => {
      controller.triggerAction("wink", 0.5);
      const overlay = controller.getExpressionOverlay(expression);
      expect(overlay.rightEye).toBeDefined();
      expect(overlay.cheekPuff).toBeDefined();
    });

    it("should preserve the base cheek shape while winking", () => {
      const smile = new RagdollGeometry(
        getDefaultVariant(),
      ).getExpressionForMood("smile");
      controller.triggerAction("wink", 1);
      expect(controller.getExpressionOverlay(smile).cheekPuff).toBe(
        smile.cheekPuff,
      );

      controller.update(0.3);
      expect(controller.getExpressionOverlay(smile).cheekPuff).toBeGreaterThan(
        smile.cheekPuff,
      );
    });

    it("should close and reopen a wink without overshoot at any duration", () => {
      controller.triggerAction("wink", 1);
      expect(
        controller.getExpressionOverlay(expression).rightEye?.openness,
      ).toBe(expression.rightEye.openness);

      controller.update(0.3);
      expect(
        controller.getExpressionOverlay(expression).rightEye?.openness,
      ).toBeCloseTo(0, 5);

      controller.update(0.699);
      const endingOpenness =
        controller.getExpressionOverlay(expression).rightEye?.openness;
      expect(endingOpenness).toBeGreaterThanOrEqual(0);
      expect(endingOpenness).toBeLessThanOrEqual(expression.rightEye.openness);
      expect(endingOpenness).toBeCloseTo(expression.rightEye.openness, 4);
    });

    it("should return talk overlay for talk action", () => {
      controller.triggerAction("talk", 0.5);
      controller.update(0.1);
      const overlay = controller.getExpressionOverlay(expression);
      expect(overlay.mouth).toBeDefined();
    });

    it("should return the mouth to its base shape at both action boundaries", () => {
      controller.triggerAction("talk", 1);
      expect(controller.getExpressionOverlay(expression).mouth).toEqual(
        expression.mouth,
      );

      controller.update(0.999);
      const endingMouth = controller.getExpressionOverlay(expression).mouth;
      expect(endingMouth?.lowerLipTop).toBeCloseTo(
        expression.mouth.lowerLipTop,
        3,
      );
      expect(endingMouth?.width).toBeCloseTo(expression.mouth.width, 4);
    });

    it("should keep all built-in mood and action combinations geometrically valid", () => {
      for (const variant of [humanVariant, einsteinVariant]) {
        const geometry = new RagdollGeometry(variant);

        for (const mood of MOODS) {
          const base = geometry.getExpressionForMood(mood);

          for (const action of ["wink", "talk"] as const) {
            for (const duration of [0.2, 2]) {
              for (const progress of [0, 0.1, 0.3, 0.5, 0.9, 0.999]) {
                const actionController = new ActionController(
                  new MockHeadPoseController(),
                );
                actionController.triggerAction(action, duration);
                actionController.update(duration * progress);
                const overlay = actionController.getExpressionOverlay(base);
                const leftEye = geometry.getEyePath(
                  true,
                  overlay.leftEye ?? base.leftEye,
                );
                const rightEye = geometry.getEyePath(
                  false,
                  overlay.rightEye ?? base.rightEye,
                );
                const mouthState = overlay.mouth ?? base.mouth;
                const mouth = geometry.getMouthPath(mouthState);
                const faceBottom =
                  geometry.dimensions.headHeight * 0.25 +
                  geometry.dimensions.chinHeight;
                const mouthBottom =
                  geometry.dimensions.mouthY +
                  mouthState.lowerLipBottom +
                  Math.max(0, mouthState.lowerLipCurve * 4);

                for (const path of [
                  leftEye.sclera,
                  rightEye.sclera,
                  mouth.upperLip,
                  mouth.lowerLip,
                  mouth.opening,
                ]) {
                  expect(path).not.toMatch(/NaN|Infinity/);
                }
                expect(leftEye.aperture.height).toBeGreaterThanOrEqual(0);
                expect(rightEye.aperture.height).toBeGreaterThanOrEqual(0);
                expect(mouth.openingHeight).toBeGreaterThanOrEqual(0);
                expect(mouthBottom).toBeLessThanOrEqual(faceBottom);
              }
            }
          }
        }
      }
    });
  });
});
