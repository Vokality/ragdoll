import { describe, it, expect } from "bun:test";
import { CharacterStateBuilder, HeadPoseBuilder } from "../../src/testing/builders";

describe("CharacterStateBuilder", () => {
  describe("default state", () => {
    it("should build default state", () => {
      const state = new CharacterStateBuilder().build();
      expect(state.mood).toBe("neutral");
      expect(state.action).toBeNull();
      expect(state.headPose.yaw).toBe(0);
      expect(state.headPose.pitch).toBe(0);
    });
  });

  describe("withMood", () => {
    it("should set mood", () => {
      const state = new CharacterStateBuilder().withMood("smile").build();
      expect(state.mood).toBe("smile");
    });

    it("should support all moods", () => {
      const moods = ["neutral", "smile", "sad", "angry", "laugh", "surprise", "confusion", "thinking", "frown"] as const;
      moods.forEach((mood) => {
        const state = new CharacterStateBuilder().withMood(mood).build();
        expect(state.mood).toBe(mood);
      });
    });
  });

  describe("withAction", () => {
    it("should set action", () => {
      const state = new CharacterStateBuilder().withAction("wink").build();
      expect(state.action).toBe("wink");
      expect(state.animation.action).toBe("wink");
    });

    it("should set action with progress", () => {
      const state = new CharacterStateBuilder().withAction("wink", 0.5).build();
      expect(state.action).toBe("wink");
      expect(state.animation.actionProgress).toBe(0.5);
    });

    it("should clear action", () => {
      const state = new CharacterStateBuilder().withAction(null).build();
      expect(state.action).toBeNull();
      expect(state.animation.action).toBeNull();
    });
  });

  describe("withHeadPose", () => {
    it("should set head pose", () => {
      const state = new CharacterStateBuilder()
        .withHeadPose({ yaw: 0.3, pitch: 0.2 })
        .build();
      expect(state.headPose.yaw).toBe(0.3);
      expect(state.headPose.pitch).toBe(0.2);
    });

    it("should set partial head pose", () => {
      const state = new CharacterStateBuilder()
        .withHeadPose({ yaw: 0.3 })
        .build();
      expect(state.headPose.yaw).toBe(0.3);
      expect(state.headPose.pitch).toBe(0);
    });
  });

  describe("withTalking", () => {
    it("should set talking flag", () => {
      const state = new CharacterStateBuilder().withTalking(true).build();
      expect(state.animation.isTalking).toBe(true);
    });

    it("should clear talking flag", () => {
      const state = new CharacterStateBuilder().withTalking(false).build();
      expect(state.animation.isTalking).toBe(false);
    });
  });

  describe("builder chaining", () => {
    it("should chain multiple methods", () => {
      const state = new CharacterStateBuilder()
        .withMood("smile")
        .withAction("wink", 0.5)
        .withTalking(true)
        .build();
      expect(state.mood).toBe("smile");
      expect(state.action).toBe("wink");
      expect(state.animation.isTalking).toBe(true);
    });
  });

  describe("build returns copy", () => {
    it("should return independent copies", () => {
      const builder = new CharacterStateBuilder().withMood("smile");
      const state1 = builder.build();
      const state2 = builder.build();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});

describe("HeadPoseBuilder", () => {
  describe("default pose", () => {
    it("should build default pose", () => {
      const pose = new HeadPoseBuilder().build();
      expect(pose.yaw).toBe(0);
      expect(pose.pitch).toBe(0);
    });
  });

  describe("withYaw/withPitch", () => {
    it("should set yaw in radians", () => {
      const pose = new HeadPoseBuilder().withYaw(Math.PI / 4).build();
      expect(pose.yaw).toBe(Math.PI / 4);
    });

    it("should set pitch in radians", () => {
      const pose = new HeadPoseBuilder().withPitch(Math.PI / 6).build();
      expect(pose.pitch).toBe(Math.PI / 6);
    });
  });

  describe("lookingLeft/Right", () => {
    it("should set yaw in degrees (converted to radians)", () => {
      const pose = new HeadPoseBuilder().lookingLeft(20).build();
      expect(pose.yaw).toBeCloseTo((20 * Math.PI) / 180, 5);
    });

    it("should set negative yaw for right", () => {
      const pose = new HeadPoseBuilder().lookingRight(20).build();
      expect(pose.yaw).toBeCloseTo((-20 * Math.PI) / 180, 5);
    });
  });

  describe("lookingUp/Down", () => {
    it("should set pitch in degrees (converted to radians)", () => {
      const pose = new HeadPoseBuilder().lookingUp(10).build();
      expect(pose.pitch).toBeCloseTo((10 * Math.PI) / 180, 5);
    });

    it("should set negative pitch for down", () => {
      const pose = new HeadPoseBuilder().lookingDown(10).build();
      expect(pose.pitch).toBeCloseTo((-10 * Math.PI) / 180, 5);
    });
  });

  describe("builder chaining", () => {
    it("should chain multiple methods", () => {
      const pose = new HeadPoseBuilder()
        .lookingLeft(20)
        .lookingUp(10)
        .build();
      expect(pose.yaw).toBeCloseTo((20 * Math.PI) / 180, 5);
      expect(pose.pitch).toBeCloseTo((10 * Math.PI) / 180, 5);
    });
  });
});


