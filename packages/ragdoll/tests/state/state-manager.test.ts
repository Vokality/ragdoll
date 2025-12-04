import { describe, it, expect, beforeEach } from "bun:test";
import { StateManager } from "../../src/state/state-manager";
import { EventBus } from "../../src/state/event-bus";
import { SpyEventBus } from "../../src/testing/mocks";
import { CharacterStateBuilder } from "../../src/testing/builders";

describe("StateManager", () => {
  let initialState: ReturnType<CharacterStateBuilder["build"]>;
  let stateManager: StateManager;

  beforeEach(() => {
    initialState = new CharacterStateBuilder().build();
    stateManager = new StateManager(initialState);
  });

  describe("state getter", () => {
    it("should return copy of state", () => {
      const state1 = stateManager.getState();
      const state2 = stateManager.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it("should return current state", () => {
      const state = stateManager.getState();
      expect(state.mood).toBe("neutral");
      expect(state.action).toBeNull();
    });
  });

  describe("mood updates", () => {
    it("should update mood", () => {
      stateManager.setMood("smile", "neutral");
      const state = stateManager.getState();
      expect(state.mood).toBe("smile");
    });

    it("should emit mood change event", () => {
      const spyBus = new SpyEventBus();
      const customManager = new StateManager(initialState, spyBus as unknown as EventBus);
      customManager.setMood("smile", "neutral");
      expect(spyBus.emittedEvents.length).toBe(1);
      expect(spyBus.emittedEvents[0]).toMatchObject({
        type: "moodChanged",
        mood: "smile",
        previousMood: "neutral",
      });
    });
  });

  describe("action updates", () => {
    it("should update action", () => {
      stateManager.setAction("wink", 0.5);
      const state = stateManager.getState();
      expect(state.action).toBe("wink");
      expect(state.animation.action).toBe("wink");
    });

    it("should clear action", () => {
      stateManager.setAction("wink", 0.5);
      stateManager.setAction(null);
      const state = stateManager.getState();
      expect(state.action).toBeNull();
      expect(state.animation.action).toBeNull();
    });

    it("should emit action triggered event", () => {
      const spyBus = new SpyEventBus();
      const customManager = new StateManager(initialState, spyBus as unknown as EventBus);
      customManager.setAction("wink", 0.5);
      expect(spyBus.emittedEvents.length).toBe(1);
      expect(spyBus.emittedEvents[0]).toMatchObject({
        type: "actionTriggered",
        action: "wink",
        duration: 0.5,
      });
    });

    it("should emit action cleared event", () => {
      const spyBus = new SpyEventBus();
      const customManager = new StateManager(initialState, spyBus as unknown as EventBus);
      customManager.setAction("wink", 0.5);
      customManager.setAction(null);
      expect(spyBus.emittedEvents.length).toBe(2);
      expect(spyBus.emittedEvents[1]).toMatchObject({
        type: "actionCleared",
      });
    });

    it("should not emit event when setting none action", () => {
      const spyBus = new SpyEventBus();
      const customManager = new StateManager(initialState, spyBus as unknown as EventBus);
      customManager.setAction("none");
      expect(spyBus.emittedEvents.length).toBe(0);
    });
  });

  describe("head pose updates", () => {
    it("should update head pose", () => {
      stateManager.setHeadPose({ yaw: 0.3, pitch: 0.2 });
      const state = stateManager.getState();
      expect(state.headPose.yaw).toBe(0.3);
      expect(state.headPose.pitch).toBe(0.2);
    });

    it("should emit head pose changed event", () => {
      const spyBus = new SpyEventBus();
      const customManager = new StateManager(initialState, spyBus as unknown as EventBus);
      customManager.setHeadPose({ yaw: 0.3, pitch: 0.2 });
      expect(spyBus.emittedEvents.length).toBe(1);
      expect(spyBus.emittedEvents[0]).toMatchObject({
        type: "headPoseChanged",
        pose: { yaw: 0.3, pitch: 0.2 },
      });
    });
  });

  describe("action progress", () => {
    it("should update action progress", () => {
      stateManager.setActionProgress(0.5);
      const state = stateManager.getState();
      expect(state.animation.actionProgress).toBe(0.5);
    });

    it("should update action progress to 1.0", () => {
      stateManager.setActionProgress(1.0);
      const state = stateManager.getState();
      expect(state.animation.actionProgress).toBe(1.0);
    });
  });

  describe("isTalking flag", () => {
    it("should update isTalking flag", () => {
      stateManager.setIsTalking(true);
      const state = stateManager.getState();
      expect(state.animation.isTalking).toBe(true);
    });

    it("should clear isTalking flag", () => {
      stateManager.setIsTalking(true);
      stateManager.setIsTalking(false);
      const state = stateManager.getState();
      expect(state.animation.isTalking).toBe(false);
    });
  });

  describe("joints", () => {
    it("should update joints", () => {
      const newJoints = {
        headPivot: { x: 1, y: 2, z: 3 },
        neck: { x: 4, y: 5, z: 6 },
      };
      stateManager.setJoints(newJoints);
      const state = stateManager.getState();
      expect(state.joints.headPivot.x).toBe(1);
      expect(state.joints.neck.z).toBe(6);
    });
  });

  describe("batch updates", () => {
    it("should update multiple state properties", () => {
      stateManager.updateState({
        mood: "smile",
        action: "wink",
      });
      const state = stateManager.getState();
      expect(state.mood).toBe("smile");
      expect(state.action).toBe("wink");
    });

    it("should preserve other properties during batch update", () => {
      const initialMood = stateManager.getState().mood;
      stateManager.updateState({
        action: "wink",
      });
      const state = stateManager.getState();
      expect(state.mood).toBe(initialMood);
      expect(state.action).toBe("wink");
    });
  });

  describe("event bus integration", () => {
    it("should create default event bus if not provided", () => {
      const manager = new StateManager(initialState);
      const bus = manager.getEventBus();
      expect(bus).toBeDefined();
    });

    it("should use provided event bus", () => {
      const customBus = new EventBus();
      const manager = new StateManager(initialState, customBus);
      const bus = manager.getEventBus();
      expect(bus).toBe(customBus);
    });

    it("should get event bus", () => {
      const bus = stateManager.getEventBus();
      expect(bus).toBeDefined();
      expect(bus.subscribe).toBeDefined();
      expect(bus.emit).toBeDefined();
    });
  });
});

