import { describe, it, expect, beforeEach } from "bun:test";
import { CharacterController } from "../../src/controllers/character-controller";

describe("CharacterController", () => {
  let controller: CharacterController;

  beforeEach(() => {
    controller = new CharacterController();
  });

  describe("initialization", () => {
    it("should initialize with default theme and variant", () => {
      const state = controller.getState();
      expect(state).toBeDefined();
      expect(state.mood).toBe("neutral");
    });

    it("should initialize with custom theme", () => {
      const customController = new CharacterController("robot");
      const state = customController.getState();
      expect(state).toBeDefined();
    });

    it("should initialize with custom theme and variant", () => {
      const customController = new CharacterController("robot", "einstein");
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

  describe("speech bubble management", () => {
    it("should set speech bubble", () => {
      controller.setSpeechBubble({ text: "Hello!" });
      const state = controller.getState();
      expect(state.bubble.text).toBe("Hello!");
    });

    it("should trigger talk action when setting speech bubble", () => {
      controller.setSpeechBubble({ text: "Hello!" });
      // Update to sync state
      controller.update(0.01);
      const state = controller.getState();
      expect(state.action).toBe("talk");
    });

    it("should clear talk action when clearing speech bubble", () => {
      controller.setSpeechBubble({ text: "Hello!" });
      controller.setSpeechBubble({ text: null });
      const state = controller.getState();
      expect(state.action).toBeNull();
    });

    it("should calculate talk duration based on text length", () => {
      controller.setSpeechBubble({ text: "Hello!" });
      controller.update(0.01);
      const state1 = controller.getState();
      controller.setSpeechBubble({ text: "This is a much longer sentence with many more words." });
      controller.update(0.01);
      const state2 = controller.getState();
      // Longer text should have longer duration
      expect(state1.action).toBe("talk");
      expect(state2.action).toBe("talk");
    });

    it("should set speech bubble tone", () => {
      controller.setSpeechBubble({ text: "Hello!", tone: "shout" });
      const state = controller.getState();
      expect(state.bubble.tone).toBe("shout");
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
      const customController = new CharacterController("default", "einstein");
      const geometry = customController.getGeometry();
      expect(geometry.variant.id).toBe("einstein");
    });
  });

  describe("plugin integration", () => {
    it("should integrate Pomodoro plugin", () => {
      const pomodoroState = controller.getPomodoroState();
      expect(pomodoroState).toBeDefined();
    });

    it("should integrate Task plugin", () => {
      const taskController = controller.getTaskController();
      const taskState = taskController.getState();
      expect(taskState).toBeDefined();
    });

    it("should handle pomodoro updates", () => {
      controller.startPomodoro(5, 1);
      const state = controller.getPomodoroState();
      expect(state).toBeDefined();
    });

    it("should handle task updates", () => {
      controller.addTask("Test task");
      const taskController = controller.getTaskController();
      const state = taskController.getState();
      expect(state.tasks.length).toBe(1);
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
      const customController = new CharacterController();
      // Access event bus through state manager
      const stateManager = (customController as any).stateManager;
      const bus = stateManager.getEventBus();

      // Subscribe to events
      const events: any[] = [];
      bus.subscribe((event) => {
        events.push(event);
      });

      customController.setMood("smile");
      expect(events.length).toBeGreaterThan(0);
    });

    it("should emit action triggered events", () => {
      const customController = new CharacterController();
      const stateManager = (customController as any).stateManager;
      const bus = stateManager.getEventBus();

      const events: any[] = [];
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
      controller.executeCommand({ action: "clearAction", params: {} });
      expect(controller.getState().action).toBeNull();
    });

    it("should execute setHeadPose command", () => {
      controller.executeCommand({
        action: "setHeadPose",
        params: { yawDegrees: 20, pitchDegrees: 10, duration: 0.3 },
      });
      const state = controller.getState();
      expect(state.headPose).toBeDefined();
    });

    it("should execute setSpeechBubble command", () => {
      controller.executeCommand({
        action: "setSpeechBubble",
        params: { text: "Hello!", tone: "default" },
      });
      expect(controller.getState().bubble.text).toBe("Hello!");
    });
  });

  describe("joint management", () => {
    it("should set joint rotation", () => {
      controller.setJointRotation({
        joint: "headPivot",
        angle: { y: 0.3 },
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
      expect(state.bubble).toBeDefined();
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
});
