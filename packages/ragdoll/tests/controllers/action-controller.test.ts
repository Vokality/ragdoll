import { describe, it, expect, beforeEach } from "bun:test";
import { ActionController } from "../../src/controllers/action-controller";
import { MockHeadPoseController } from "../../src/testing/mocks";

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
      expect(mockHeadPose.setTargetPoseCalls.length).toBeGreaterThan(initialCalls);
    });

    it("should apply easing to shake animation", () => {
      controller.triggerAction("shake", 0.6);
      controller.update(0.1);
      const call = mockHeadPose.setTargetPoseCalls[0];
      expect(call).toBeDefined();
      expect(call.pose.yaw).toBeDefined();
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
    it("should return empty overlay when no action is active", () => {
      const baseExpression = {
        leftEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        rightEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        mouth: { upperLipBottom: 0, lowerLipTop: 0, lowerLipBottom: 0, width: 1 },
        leftEyebrow: { raise: 0 },
        rightEyebrow: { raise: 0 },
        cheekPuff: 0,
        noseScrunch: 0,
      };
      const overlay = controller.getExpressionOverlay(baseExpression);
      expect(overlay).toEqual({});
    });

    it("should return wink overlay for wink action", () => {
      controller.triggerAction("wink", 0.5);
      const baseExpression = {
        leftEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        rightEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        mouth: { upperLipBottom: 0, lowerLipTop: 0, lowerLipBottom: 0, width: 1 },
        leftEyebrow: { raise: 0 },
        rightEyebrow: { raise: 0 },
        cheekPuff: 0,
        noseScrunch: 0,
      };
      const overlay = controller.getExpressionOverlay(baseExpression);
      expect(overlay.rightEye).toBeDefined();
      expect(overlay.cheekPuff).toBeDefined();
    });

    it("should return talk overlay for talk action", () => {
      controller.triggerAction("talk", 0.5);
      controller.update(0.1);
      const baseExpression = {
        leftEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        rightEye: { openness: 1, pupilOffset: { x: 0, y: 0 } },
        mouth: { upperLipBottom: 0, lowerLipTop: 0, lowerLipBottom: 0, width: 1 },
        leftEyebrow: { raise: 0 },
        rightEyebrow: { raise: 0 },
        cheekPuff: 0,
        noseScrunch: 0,
      };
      const overlay = controller.getExpressionOverlay(baseExpression);
      expect(overlay.mouth).toBeDefined();
    });
  });
});

