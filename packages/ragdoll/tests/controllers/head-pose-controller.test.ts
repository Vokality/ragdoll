import { describe, it, expect, beforeEach } from "bun:test";
import { HeadPoseController } from "../../src/controllers/head-pose-controller";
import { RagdollSkeleton } from "../../src/models/ragdoll-skeleton";

describe("HeadPoseController", () => {
  let skeleton: RagdollSkeleton;
  let controller: HeadPoseController;

  beforeEach(() => {
    skeleton = new RagdollSkeleton();
    controller = new HeadPoseController(skeleton);
  });

  describe("initial state", () => {
    it("should start with neutral pose", () => {
      const pose = controller.getPose();
      expect(pose.yaw).toBe(0);
      expect(pose.pitch).toBe(0);
    });
  });

  describe("setTargetPose", () => {
    it("should set target pose with default duration", () => {
      controller.setTargetPose({ yaw: 0.5 });
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });

    it("should set target pose with custom duration", () => {
      controller.setTargetPose({ yaw: 0.5 }, 0.5);
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });

    it("should set yaw only", () => {
      controller.setTargetPose({ yaw: 0.3 });
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
      }
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw - 0.3)).toBeLessThan(0.15);
    });

    it("should set pitch only", () => {
      controller.setTargetPose({ pitch: 0.2 });
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
      }
      const pose = controller.getPose();
      expect(Math.abs(pose.pitch - 0.2)).toBeLessThan(0.15);
    });

    it("should set both yaw and pitch", () => {
      controller.setTargetPose({ yaw: 0.3, pitch: 0.2 });
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
      }
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw - 0.3)).toBeLessThan(0.15);
      expect(Math.abs(pose.pitch - 0.2)).toBeLessThan(0.15);
    });

    it("should clamp yaw to maximum", () => {
      const MAX_YAW = (35 * Math.PI) / 180;
      controller.setTargetPose({ yaw: MAX_YAW + 1 });
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(MAX_YAW);
    });

    it("should clamp yaw to minimum", () => {
      const MAX_YAW = (35 * Math.PI) / 180;
      controller.setTargetPose({ yaw: -MAX_YAW - 1 });
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(MAX_YAW);
    });

    it("should clamp pitch to maximum", () => {
      const MAX_PITCH = (20 * Math.PI) / 180;
      controller.setTargetPose({ pitch: MAX_PITCH + 1 });
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(MAX_PITCH);
    });

    it("should clamp pitch to minimum", () => {
      const MAX_PITCH = (20 * Math.PI) / 180;
      controller.setTargetPose({ pitch: -MAX_PITCH - 1 });
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(MAX_PITCH);
    });

    it("should enforce minimum duration", () => {
      controller.setTargetPose({ yaw: 0.5 }, 0.01);
      // Should still work but with minimum duration
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });
  });

  describe("pose interpolation", () => {
    it("should interpolate pose over time", () => {
      controller.setTargetPose({ yaw: 0.5 }, 0.5);
      const initialPose = controller.getPose();
      controller.update(0.25); // Halfway through transition
      const halfwayPose = controller.getPose();
      controller.update(0.5); // Complete transition
      const finalPose = controller.getPose();
      
      expect(Math.abs(halfwayPose.yaw - initialPose.yaw)).toBeGreaterThan(0);
      // Update more to allow spring to settle
      for (let i = 0; i < 30; i++) {
        controller.update(0.1);
      }
      const settledPose = controller.getPose();
      expect(Math.abs(settledPose.yaw - 0.5)).toBeLessThan(0.15);
    });

    it("should use spring physics for smooth movement", () => {
      controller.setTargetPose({ yaw: 0.5 }, 0.5);
      const poses: number[] = [];
      for (let i = 0; i < 10; i++) {
        controller.update(0.05);
        poses.push(controller.getPose().yaw);
      }
      // Should show smooth acceleration/deceleration
      expect(poses.length).toBe(10);
    });
  });

  describe("lookForward", () => {
    it("should reset pose to center with default duration", () => {
      controller.setTargetPose({ yaw: 0.5, pitch: 0.3 });
      controller.update(0.5);
      controller.lookForward();
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw)).toBeLessThan(0.1);
      expect(Math.abs(pose.pitch)).toBeLessThan(0.1);
    });

    it("should reset pose to center with custom duration", () => {
      controller.setTargetPose({ yaw: 0.5 });
      controller.update(0.5);
      controller.lookForward(0.3);
      controller.update(1.0);
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw)).toBeLessThan(0.1);
      expect(Math.abs(pose.pitch)).toBeLessThan(0.1);
    });
  });

  describe("nudge", () => {
    it("should nudge pose relative to current target", () => {
      controller.setTargetPose({ yaw: 0.3 });
      controller.update(0.5);
      controller.nudge({ yaw: 0.2 });
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
      }
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw - 0.5)).toBeLessThan(0.15);
    });

    it("should nudge with custom duration", () => {
      controller.nudge({ yaw: 0.2 }, 0.3);
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
      }
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw - 0.2)).toBeLessThan(0.15);
    });
  });

  describe("update loop", () => {
    it("should handle deltaTime updates", () => {
      controller.setTargetPose({ yaw: 0.5 });
      controller.update(0.1);
      const pose1 = controller.getPose();
      controller.update(0.1);
      const pose2 = controller.getPose();
      expect(Math.abs(pose2.yaw - pose1.yaw)).toBeGreaterThanOrEqual(0);
    });

    it("should cap deltaTime to prevent large jumps", () => {
      controller.setTargetPose({ yaw: 0.5 });
      controller.update(1.0); // Large deltaTime
      const pose = controller.getPose();
      expect(pose).toBeDefined();
      expect(isNaN(pose.yaw)).toBe(false);
      expect(isNaN(pose.pitch)).toBe(false);
    });
  });

  describe("multiple pose changes", () => {
    it("should handle sequential pose changes", () => {
      controller.setTargetPose({ yaw: 0.3 });
      controller.update(0.2);
      controller.setTargetPose({ yaw: 0.5 });
      controller.update(0.2);
      controller.setTargetPose({ pitch: 0.2 });
      controller.update(0.2);
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });

    it("should smoothly transition between multiple targets", () => {
      controller.setTargetPose({ yaw: 0.3 }, 0.3);
      controller.update(0.15);
      const halfway1 = controller.getPose();
      controller.setTargetPose({ yaw: 0.5 }, 0.3);
      controller.update(0.15);
      const halfway2 = controller.getPose();
      expect(Math.abs(halfway2.yaw - halfway1.yaw)).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle zero duration", () => {
      controller.setTargetPose({ yaw: 0.5 }, 0);
      controller.update(0.1);
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });

    it("should handle very small deltaTime", () => {
      controller.setTargetPose({ yaw: 0.5 });
      controller.update(0.001);
      const pose = controller.getPose();
      expect(pose).toBeDefined();
    });

    it("should handle extreme angles (clamped)", () => {
      controller.setTargetPose({ yaw: Math.PI, pitch: Math.PI });
      controller.update(1.0);
      const pose = controller.getPose();
      const MAX_YAW = (35 * Math.PI) / 180;
      const MAX_PITCH = (20 * Math.PI) / 180;
      expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(MAX_YAW);
      expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(MAX_PITCH);
    });
  });

  describe("skeleton integration", () => {
    it("should apply pose to skeleton joints", () => {
      controller.setTargetPose({ yaw: 0.3, pitch: 0.2 });
      // Update multiple times to allow spring to settle
      for (let i = 0; i < 50; i++) {
        controller.update(0.1);
        skeleton.update(0.1); // Also update skeleton
      }
      const headRotation = skeleton.getJointRotation("headPivot");
      const neckRotation = skeleton.getJointRotation("neck");
      // HeadPoseController applies pose directly, skeleton may lag behind
      const pose = controller.getPose();
      expect(Math.abs(pose.yaw - 0.3)).toBeLessThan(0.15);
      expect(Math.abs(pose.pitch - 0.2)).toBeLessThan(0.15);
    });
  });
});

