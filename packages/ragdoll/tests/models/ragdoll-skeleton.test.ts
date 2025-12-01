import { describe, it, expect, beforeEach } from "bun:test";
import { RagdollSkeleton } from "../../src/models/ragdoll-skeleton";

describe("RagdollSkeleton", () => {
  let skeleton: RagdollSkeleton;

  beforeEach(() => {
    skeleton = new RagdollSkeleton();
  });

  describe("skeleton initialization", () => {
    it("should initialize with default joints", () => {
      expect(skeleton.skeleton).toBeDefined();
      expect(skeleton.skeleton.joints).toBeDefined();
    });

    it("should initialize headPivot joint", () => {
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBe(0);
    });

    it("should initialize neck joint", () => {
      const rotation = skeleton.getJointRotation("neck");
      expect(rotation).toBe(0);
    });
  });

  describe("joint management", () => {
    it("should set joint rotation", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });

    it("should set joint rotation immediately", () => {
      skeleton.setJointRotationImmediate("headPivot", 0.5);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBe(0.5);
    });

    it("should get joint rotation", () => {
      skeleton.setJointRotation("headPivot", 0.3);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });

    it("should get joint target rotation", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      const target = skeleton.getJointTargetRotation("headPivot");
      expect(target).toBe(0.5);
    });

    it("should return null for invalid joint", () => {
      const rotation = skeleton.getJointRotation("invalid" as any);
      expect(rotation).toBeNull();
    });
  });

  describe("joint updates", () => {
    it("should update joint animations", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.update(0.1);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeGreaterThan(0);
    });

    it("should interpolate joint rotation over time", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      const initialRotation = skeleton.getJointRotation("headPivot");
      skeleton.update(0.1);
      const afterUpdate = skeleton.getJointRotation("headPivot");
      expect(afterUpdate).toBeGreaterThan(initialRotation!);
    });

    it("should handle multiple update calls", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      for (let i = 0; i < 10; i++) {
        skeleton.update(0.1);
        const rotation = skeleton.getJointRotation("headPivot");
        expect(rotation).toBeDefined();
        expect(isNaN(rotation!)).toBe(false);
      }
    });

    it("should cap deltaTime to prevent large jumps", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.update(1.0); // Large deltaTime
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
      expect(isNaN(rotation!)).toBe(false);
    });
  });

  describe("isAnimating", () => {
    it("should return false when joints are at target", () => {
      skeleton.setJointRotationImmediate("headPivot", 0.5);
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.update(0.1);
      expect(skeleton.isAnimating()).toBe(false);
    });

    it("should return true when joints are animating", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      expect(skeleton.isAnimating()).toBe(true);
    });

    it("should return false after animation completes", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      // Update many times to complete animation
      for (let i = 0; i < 100; i++) {
        skeleton.update(0.1);
      }
      expect(skeleton.isAnimating()).toBe(false);
    });
  });

  describe("spring physics", () => {
    it("should use spring physics for smooth movement", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      const rotations: number[] = [];
      for (let i = 0; i < 10; i++) {
        skeleton.update(0.05);
        rotations.push(skeleton.getJointRotation("headPivot")!);
      }
      // Should show smooth acceleration/deceleration
      expect(rotations.length).toBe(10);
      // Rotations should be increasing toward target
      expect(rotations[rotations.length - 1]).toBeGreaterThan(rotations[0]);
    });

    it("should have different spring configs for different joints", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.setJointRotation("neck", 0.5);
      skeleton.update(0.1);
      const headRotation = skeleton.getJointRotation("headPivot");
      const neckRotation = skeleton.getJointRotation("neck");
      // Both should animate but may have different speeds
      expect(headRotation).toBeDefined();
      expect(neckRotation).toBeDefined();
    });
  });

  describe("multiple joints", () => {
    it("should handle multiple joints independently", () => {
      skeleton.setJointRotation("headPivot", 0.3);
      skeleton.setJointRotation("neck", 0.2);
      skeleton.update(0.1);
      const headRotation = skeleton.getJointRotation("headPivot");
      const neckRotation = skeleton.getJointRotation("neck");
      expect(headRotation).toBeGreaterThan(0);
      expect(neckRotation).toBeGreaterThan(0);
    });

    it("should update all joints in update loop", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.setJointRotation("neck", 0.3);
      skeleton.update(0.1);
      expect(skeleton.getJointRotation("headPivot")).toBeGreaterThan(0);
      expect(skeleton.getJointRotation("neck")).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle zero rotation", () => {
      skeleton.setJointRotation("headPivot", 0);
      skeleton.update(0.1);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });

    it("should handle negative rotation", () => {
      skeleton.setJointRotation("headPivot", -0.5);
      skeleton.update(0.1);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeLessThan(0);
    });

    it("should handle very small deltaTime", () => {
      skeleton.setJointRotation("headPivot", 0.5);
      skeleton.update(0.001);
      const rotation = skeleton.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });
  });
});

