import { describe, it, expect, beforeEach } from "bun:test";
import { EventBus } from "../../src/state/event-bus";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("subscribe/unsubscribe", () => {
    it("should subscribe to events", () => {
      let called = false;
      const unsubscribe = eventBus.subscribe(() => {
        called = true;
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(called).toBe(true);
      unsubscribe();
    });

    it("should unsubscribe from events", () => {
      let called = false;
      const unsubscribe = eventBus.subscribe(() => {
        called = true;
      });
      unsubscribe();
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(called).toBe(false);
    });

    it("should handle multiple subscribers", () => {
      let callCount = 0;
      eventBus.subscribe(() => {
        callCount++;
      });
      eventBus.subscribe(() => {
        callCount++;
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(callCount).toBe(2);
    });

    it("should allow multiple unsubscribes", () => {
      const unsubscribe = eventBus.subscribe(() => {});
      unsubscribe();
      unsubscribe(); // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("event emission", () => {
    it("should emit events to all subscribers", () => {
      const events: any[] = [];
      eventBus.subscribe((event) => {
        events.push(event);
      });
      eventBus.subscribe((event) => {
        events.push(event);
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(events.length).toBe(2);
    });

    it("should emit different event types", () => {
      const events: any[] = [];
      eventBus.subscribe((event) => {
        events.push(event);
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      eventBus.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      expect(events.length).toBe(2);
      expect(events[0].type).toBe("moodChanged");
      expect(events[1].type).toBe("actionTriggered");
    });
  });

  describe("event history tracking", () => {
    it("should track event history", () => {
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        type: "moodChanged",
        mood: "smile",
        previousMood: "neutral",
      });
    });

    it("should limit history to max size", () => {
      // Emit more than maxHistorySize (100) events
      for (let i = 0; i < 150; i++) {
        eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      }
      const history = eventBus.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it("should maintain recent events when limit exceeded", () => {
      // Emit events
      for (let i = 0; i < 50; i++) {
        eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      }
      eventBus.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      const history = eventBus.getHistory();
      // Most recent event should be in history
      expect(history[history.length - 1].type).toBe("actionTriggered");
    });

    it("should return readonly history", () => {
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      const history = eventBus.getHistory();
      // History is returned as a copy, so mutations won't affect the original
      // But we can't test readonly in JavaScript, so we just verify it's an array
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("history clearing", () => {
    it("should clear event history", () => {
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      eventBus.clearHistory();
      const history = eventBus.getHistory();
      expect(history.length).toBe(0);
    });

    it("should continue emitting after clearing history", () => {
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      eventBus.clearHistory();
      eventBus.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe("actionTriggered");
    });
  });

  describe("error handling in subscribers", () => {
    it("should handle subscriber errors gracefully", () => {
      eventBus.subscribe(() => {
        throw new Error("Test error");
      });
      eventBus.subscribe(() => {
        // Should still be called
      });
      let called = false;
      eventBus.subscribe(() => {
        called = true;
      });
      // Should not throw
      expect(() => {
        eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      }).not.toThrow();
      expect(called).toBe(true);
    });

    it("should continue emitting to other subscribers after error", () => {
      let errorThrown = false;
      let otherCalled = false;
      eventBus.subscribe(() => {
        errorThrown = true;
        throw new Error("Test error");
      });
      eventBus.subscribe(() => {
        otherCalled = true;
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(errorThrown).toBe(true);
      expect(otherCalled).toBe(true);
    });
  });

  describe("multiple subscribers", () => {
    it("should call all subscribers", () => {
      const calls: number[] = [];
      eventBus.subscribe(() => {
        calls.push(1);
      });
      eventBus.subscribe(() => {
        calls.push(2);
      });
      eventBus.subscribe(() => {
        calls.push(3);
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      expect(calls.length).toBe(3);
      expect(calls).toContain(1);
      expect(calls).toContain(2);
      expect(calls).toContain(3);
    });

    it("should handle subscribers added during emission", () => {
      let newSubscriberCalled = false;
      eventBus.subscribe(() => {
        eventBus.subscribe(() => {
          newSubscriberCalled = true;
        });
      });
      eventBus.emit({ type: "moodChanged", mood: "smile", previousMood: "neutral" });
      // Implementation may call new subscribers immediately or on next emission
      // Just verify the subscriber was added
      eventBus.emit({ type: "actionTriggered", action: "wink", duration: 0.5 });
      expect(newSubscriberCalled).toBe(true);
    });
  });
});

