import { describe, it, expect, beforeEach } from "bun:test";
import { CharacterController } from "../../src/controllers/character-controller";
import type { StateEvent } from "../../src/state/types";

describe("CharacterController", () => {
  let controller: CharacterController;
  const defaultConfig = {
    themeId: "default",
    variantId: "human",
    onEventSubscriberError: () => undefined,
  };

  beforeEach(() => {
    controller = new CharacterController(defaultConfig);
  });

  describe("initialization", () => {
    it("should initialize with default theme and variant", () => {
      const state = controller.getState();
      expect(state).toBeDefined();
      expect(state.mood).toBe("neutral");
    });

    it("should initialize with custom theme", () => {
      const customController = new CharacterController({
        themeId: "robot",
        variantId: "human",
        onEventSubscriberError: () => undefined,
      });
      const state = customController.getState();
      expect(state).toBeDefined();
    });

    it("should initialize with custom theme and variant", () => {
      const customController = new CharacterController({
        themeId: "robot",
        variantId: "einstein",
        onEventSubscriberError: () => undefined,
      });
      const state = customController.getState();
      expect(state).toBeDefined();
    });
  });

  describe("mood coordination", () => {
    it("should set mood and update expression controller", () => {
      controller.setMood("smile");
      expect(controller.getState().mood).toBe("smile");
    });

    it("should update state manager when setting mood", () => {
      controller.setMood("sad");
      const state = controller.getState();
      expect(state.mood).toBe("sad");
    });

    it("should handle mood transitions", () => {
      controller.setMood("neutral");
      controller.setMood("smile");
      controller.setMood("sad");
      expect(controller.getState().mood).toBe("sad");
    });
  });

  describe("action coordination", () => {
    it("should trigger action and update state", () => {
      controller.triggerAction("wink", 0.5);
      const state = controller.getState();
      expect(state.action).toBe("wink");
    });

    it("should clear action and update state", () => {
      controller.triggerAction("wink", 0.5);
      controller.clearAction();
      const state = controller.getState();
      expect(state.action).toBeNull();
    });

    it("should coordinate action with expression controller", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.1);
      const state = controller.getState();
      expect(state.action).toBe("wink");
    });

    it("should advance an action exactly once per frame", () => {
      controller.triggerAction("wink", 1);
      controller.update(0.25);

      expect(controller.getState().animation.actionProgress).toBeCloseTo(
        0.25,
        5,
      );
    });
  });

  describe("head pose coordination", () => {
    it("should set head pose", () => {
      controller.setHeadPose({ yaw: 0.3 });
      const state = controller.getState();
      expect(state.headPose).toBeDefined();
    });

    it("should update head pose over time", () => {
      controller.setHeadPose({ yaw: 0.3 }, 0.5);
      controller.update(0.1);
      const state = controller.getState();
      expect(state.headPose.yaw).toBeDefined();
    });

    it("should nudge head pose", () => {
      controller.setHeadPose({ yaw: 0.3 });
      controller.nudgeHead({ yaw: 0.2 });
      controller.update(0.5);
      const state = controller.getState();
      expect(state.headPose.yaw).toBeDefined();
    });
  });

  describe("theme and variant application", () => {
    it("should get current theme", () => {
      const theme = controller.getTheme();
      expect(theme).toBeDefined();
      expect(theme.id).toBeDefined();
    });

    it("should get current variant", () => {
      // CharacterController doesn't expose getVariant, but we can check variant is set
      const geometry = controller.getGeometry();
      expect(geometry.variant).toBeDefined();
      expect(geometry.variant.id).toBeDefined();
    });

    it("should set theme", () => {
      controller.setTheme("robot");
      const theme = controller.getTheme();
      expect(theme.id).toBe("robot");
    });

    it("should set variant", () => {
      // CharacterController doesn't expose setVariant, variant is set in constructor
      const customController = new CharacterController({
        themeId: "default",
        variantId: "einstein",
        onEventSubscriberError: () => undefined,
      });
      const geometry = customController.getGeometry();
      expect(geometry.variant.id).toBe("einstein");
    });
  });

  describe("state synchronization", () => {
    it("should synchronize mood across controllers", () => {
      controller.setMood("smile");
      controller.update(0.1);
      const state = controller.getState();
      expect(state.mood).toBe("smile");
    });

    it("should synchronize action across controllers", () => {
      controller.triggerAction("wink", 0.5);
      controller.update(0.1);
      const state = controller.getState();
      expect(state.action).toBe("wink");
      expect(state.animation.action).toBe("wink");
    });

    it("should synchronize head pose", () => {
      controller.setHeadPose({ yaw: 0.3 });
      controller.update(0.5);
      const state = controller.getState();
      expect(state.headPose.yaw).toBeDefined();
    });
  });

  describe("event bus integration", () => {
    it("should emit mood change events", () => {
      const customController = new CharacterController(defaultConfig);
      const bus = customController.getEventBus();

      const events: StateEvent[] = [];
      bus.subscribe((event) => {
        events.push(event);
      });

      customController.setMood("smile");
      expect(events.length).toBeGreaterThan(0);
    });

    it("should emit action triggered events", () => {
      const customController = new CharacterController(defaultConfig);
      const bus = customController.getEventBus();

      const events: StateEvent[] = [];
      bus.subscribe((event) => {
        events.push(event);
      });

      customController.triggerAction("wink", 0.5);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("update loop", () => {
    it("should update all controllers", () => {
      controller.setMood("smile");
      controller.triggerAction("wink", 0.5);
      controller.setHeadPose({ yaw: 0.3 });
      controller.update(0.1);
      const state = controller.getState();
      expect(state).toBeDefined();
    });

    it("should update idle animations", () => {
      controller.update(1.0);
      const state = controller.getState();
      expect(state).toBeDefined();
    });

    it("should handle multiple update calls", () => {
      for (let i = 0; i < 10; i++) {
        controller.update(0.1);
        const state = controller.getState();
        expect(state).toBeDefined();
      }
    });
  });

  describe("executeCommand", () => {
    it("should execute setMood command", () => {
      controller.executeCommand({
        action: "setMood",
        params: { mood: "smile", duration: 0.3 },
      });
      expect(controller.getState().mood).toBe("smile");
    });

    it("should execute triggerAction command", () => {
      controller.executeCommand({
        action: "triggerAction",
        params: { action: "wink", duration: 0.5 },
      });
      expect(controller.getState().action).toBe("wink");
    });

    it("should execute clearAction command", () => {
      controller.triggerAction("wink", 0.5);
      controller.executeCommand({ action: "clearAction" });
      expect(controller.getState().action).toBeNull();
    });

    it("should execute setHeadPose command", () => {
      controller.executeCommand({
        action: "setHeadPose",
        params: { yaw: 0.2, pitch: 0.1, duration: 0.3 },
      });
      const state = controller.getState();
      expect(state.headPose).toBeDefined();
    });

    it("should execute setExpression and strip duration from the axis mask", () => {
      controller.executeCommand({
        action: "setExpression",
        params: { smile: 0.5, duration: 0.2 },
      });
      expect(controller.getAxisOverlay()).toEqual({ smile: 0.5 });
      expect(controller.getAxisOverlay()).not.toHaveProperty("duration");
    });
  });

  describe("setExpression", () => {
    it("forwards an axis patch without emitting a new state shape", () => {
      controller.setExpression({ smile: 0.4, gazeX: 1 }, 0);
      const state = controller.getState();
      expect(state.mood).toBe("neutral");
      expect(controller.getAxisOverlay()).toEqual({ smile: 0.4, gazeX: 1 });
      expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0.4);
      expect(controller.getExpression().mouth.cornerPull).toBe(0);
    });
  });

  describe("joint management", () => {
    it("should set joint rotation", () => {
      controller.setJointRotation({
        joint: "headPivot",
        angle: { x: 0, y: 0.3, z: 0 },
      });
      const rotation = controller.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });

    it("should get joint rotation", () => {
      const rotation = controller.getJointRotation("headPivot");
      expect(rotation).toBeDefined();
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = controller.getState();
      expect(state.mood).toBeDefined();
      expect(state.headPose).toBeDefined();
      expect(state.joints).toBeDefined();
      expect(state.animation).toBeDefined();
    });

    it("should return updated state after changes", () => {
      controller.setMood("smile");
      controller.triggerAction("wink", 0.5);
      const state = controller.getState();
      expect(state.mood).toBe("smile");
      expect(state.action).toBe("wink");
    });
  });

  describe("event emission", () => {
    const countEvents = (run: (c: CharacterController) => void) => {
      const counts: Partial<Record<StateEvent["type"], number>> = {};
      controller.getEventBus().subscribe((event) => {
        counts[event.type] = (counts[event.type] ?? 0) + 1;
      });
      run(controller);
      return counts;
    };

    it("announces an action once, not on every frame it stays active", () => {
      const counts = countEvents((c) => {
        c.triggerAction("wink", 0.6);
        for (let i = 0; i < 60; i++) c.update(1 / 60);
      });
      expect(counts.actionTriggered).toBe(1);
      expect(counts.actionCleared).toBe(1);
      expect(controller.getState().action).toBeNull();
    });

    it("stays silent about head pose while the head is at rest", () => {
      const counts = countEvents((c) => {
        for (let i = 0; i < 60; i++) c.update(1 / 60);
      });
      expect(counts.headPoseChanged).toBeUndefined();
    });

    it("stops emitting head pose changes once the head settles", () => {
      controller.setHeadPose({ yaw: 0.3 });
      for (let i = 0; i < 600; i++) controller.update(1 / 60);
      expect(controller.getState().headPose.yaw).toBe(0.3);
      const counts = countEvents((c) => {
        for (let i = 0; i < 60; i++) c.update(1 / 60);
      });
      expect(counts.headPoseChanged).toBeUndefined();
    });

    it("emits themeChanged only when the theme changes", () => {
      const counts = countEvents((c) => {
        c.setTheme("default");
        c.setTheme("robot");
        c.setTheme("robot");
      });
      expect(counts.themeChanged).toBe(1);
      expect(controller.getThemeId()).toBe("robot");
    });
  });

  describe("state snapshots", () => {
    it("does not change a snapshot after it was taken", () => {
      const snapshot = controller.getState();
      controller.triggerAction("talk", 1);
      controller.setHeadPose({ yaw: 0.3 });
      for (let i = 0; i < 30; i++) controller.update(1 / 60);
      expect(snapshot.animation).toEqual({
        action: null,
        actionProgress: 0,
        isTalking: false,
      });
      expect(snapshot.headPose).toEqual({ yaw: 0, pitch: 0 });
      expect(snapshot.joints.headPivot.y).toBe(0);
    });

    it("ignores mutation of a returned snapshot", () => {
      const snapshot = controller.getState();
      snapshot.animation.isTalking = true;
      snapshot.headPose.yaw = 1;
      const next = controller.getState();
      expect(next.animation.isTalking).toBe(false);
      expect(next.headPose.yaw).toBe(0);
    });
  });

  describe("joint commands", () => {
    it("keeps a commanded joint rotation through the update loop", () => {
      controller.setJointRotation({
        joint: "neck",
        angle: { x: 0, y: 0.2, z: 0 },
      });
      controller.setJointRotation({
        joint: "headPivot",
        angle: { x: 0, y: -0.3, z: 0 },
      });
      for (let i = 0; i < 600; i++) controller.update(1 / 60);
      expect(controller.getJointRotation("neck")).toBeCloseTo(0.2, 3);
      expect(controller.getJointRotation("headPivot")).toBeCloseTo(-0.3, 3);
    });
  });

  describe("invalid numeric input", () => {
    it("rejects non-finite values before they reach the animation state", () => {
      expect(() => controller.setMood("smile", NaN)).toThrow("finite");
      expect(() => controller.setExpression({ smile: 1 }, NaN)).toThrow(
        "finite",
      );
      expect(() => controller.triggerAction("shake", NaN)).toThrow("finite");
      expect(() => controller.setHeadPose({ yaw: NaN })).toThrow("finite");
      expect(() => controller.setHeadPose({ yaw: 0.1 }, Infinity)).toThrow(
        "finite",
      );
      expect(() => controller.nudgeHead({ pitch: NaN })).toThrow("finite");

      for (let i = 0; i < 30; i++) controller.update(1 / 60);
      const state = controller.getState();
      expect(state.mood).toBe("neutral");
      expect(state.action).toBeNull();
      expect(state.headPose).toEqual({ yaw: 0, pitch: 0 });
      expect(controller.getMixedExpression().mouth.cornerPull).toBe(0);
    });
  });

  describe("moving moods", () => {
    it("blinks when thinking shifts to its next pose", () => {
      // Push the natural blink past the window so only the pose change counts.
      const random = Math.random;
      Math.random = () => 0.99;
      try {
        const steady = new CharacterController(defaultConfig);
        steady.setMood("thinking", 0);
        let blinkedAt: number | null = null;
        for (let t = 0; t < 4 && blinkedAt === null; t += 1 / 60) {
          steady.update(1 / 60);
          if (steady.getIdleState().isBlinking) blinkedAt = t;
        }
        expect(blinkedAt).not.toBeNull();
        expect(blinkedAt ?? 0).toBeGreaterThan(2.3);
        expect(blinkedAt ?? 0).toBeLessThan(2.7);
        steady.destroy();
      } finally {
        Math.random = random;
      }
    });

    it("does not start a blink while idle animation is disabled", () => {
      controller.setIdleEnabled(false);
      controller.setMood("thinking", 0);
      for (let t = 0; t < 4; t += 1 / 60) controller.update(1 / 60);
      expect(controller.getIdleState().isBlinking).toBe(false);
      expect(controller.getIdleState().blinkAmount).toBe(0);
    });
  });
});
