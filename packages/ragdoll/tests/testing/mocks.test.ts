import { describe, it, expect, beforeEach } from "bun:test";
import { MockHeadPoseController, SpyEventBus } from "../../src/testing/mocks";

describe("MockHeadPoseController", () => {
  let mock: MockHeadPoseController;

  beforeEach(() => {
    mock = new MockHeadPoseController();
  });

  describe("call tracking", () => {
    it("should track setTargetPose calls", () => {
      mock.setTargetPose({ yaw: 0.3 });
      expect(mock.setTargetPoseCalls.length).toBe(1);
      expect(mock.setTargetPoseCalls[0].pose.yaw).toBe(0.3);
    });

    it("should track setTargetPose calls with duration", () => {
      mock.setTargetPose({ yaw: 0.3 }, 0.5);
      expect(mock.setTargetPoseCalls[0].duration).toBe(0.5);
    });

    it("should track lookForward calls", () => {
      mock.lookForward();
      expect(mock.lookForwardCalls.length).toBe(1);
    });

    it("should track lookForward calls with duration", () => {
      mock.lookForward(0.3);
      expect(mock.lookForwardCalls[0].duration).toBe(0.3);
    });
  });

  describe("pose management", () => {
    it("should update pose immediately", () => {
      mock.setTargetPose({ yaw: 0.3 });
      const pose = mock.getPose();
      expect(pose.yaw).toBe(0.3);
    });

    it("should update pose with partial values", () => {
      mock.setTargetPose({ yaw: 0.3 });
      mock.setTargetPose({ pitch: 0.2 });
      const pose = mock.getPose();
      expect(pose.yaw).toBe(0.3);
      expect(pose.pitch).toBe(0.2);
    });

    it("should reset pose on lookForward", () => {
      mock.setTargetPose({ yaw: 0.3, pitch: 0.2 });
      mock.lookForward();
      const pose = mock.getPose();
      expect(pose.yaw).toBe(0);
      expect(pose.pitch).toBe(0);
    });
  });

  describe("update", () => {
    it("should handle update calls", () => {
      expect(() => mock.update(0.1)).not.toThrow();
    });
  });

  describe("reset", () => {
    it("should reset pose to center", () => {
      mock.setTargetPose({ yaw: 0.3, pitch: 0.2 });
      mock.reset();
      const pose = mock.getPose();
      expect(pose.yaw).toBe(0);
      expect(pose.pitch).toBe(0);
    });

    it("should clear call history", () => {
      mock.setTargetPose({ yaw: 0.3 });
      mock.lookForward();
      mock.reset();
      expect(mock.setTargetPoseCalls.length).toBe(0);
      expect(mock.lookForwardCalls.length).toBe(0);
    });
  });
});

describe("SpyEventBus", () => {
  let spy: SpyEventBus;

  beforeEach(() => {
    spy = new SpyEventBus();
  });

  describe("event tracking", () => {
    it("should track emitted events", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(spy.emittedEvents.length).toBe(1);
      expect(spy.emittedEvents[0]).toMatchObject({
        type: "moodChanged",
        mood: "smile",
        previousMood: "neutral",
      });
    });

    it("should track multiple events", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      spy.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      expect(spy.emittedEvents.length).toBe(2);
    });
  });

  describe("subscribe/unsubscribe", () => {
    it("should subscribe to events", () => {
      let called = false;
      const unsubscribe = spy.subscribe(() => {
        called = true;
      });
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(called).toBe(true);
      unsubscribe();
    });

    it("should unsubscribe from events", () => {
      let called = false;
      const unsubscribe = spy.subscribe(() => {
        called = true;
      });
      unsubscribe();
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(called).toBe(false);
    });

    it("should notify all subscribers", () => {
      let callCount = 0;
      spy.subscribe(() => {
        callCount++;
      });
      spy.subscribe(() => {
        callCount++;
      });
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(callCount).toBe(2);
    });
  });

  describe("getHistory", () => {
    it("should return event history", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      const history = spy.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        type: "moodChanged",
        mood: "smile",
        previousMood: "neutral",
      });
    });

    it("should return copy of history", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      const history1 = spy.getHistory();
      const history2 = spy.getHistory();
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe("clearHistory", () => {
    it("should clear event history", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      spy.clearHistory();
      expect(spy.emittedEvents.length).toBe(0);
    });

    it("should continue tracking after clearing", () => {
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      spy.clearHistory();
      spy.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      expect(spy.emittedEvents.length).toBe(1);
    });
  });

  describe("reset", () => {
    it("should clear events and subscribers", () => {
      let called = false;
      spy.subscribe(() => {
        called = true;
      });
      spy.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(called).toBe(true);
      spy.reset();
      expect(spy.emittedEvents.length).toBe(0);
      called = false;
      spy.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      // After reset, subscribers should be cleared
      expect(called).toBe(false);
    });
  });
});

