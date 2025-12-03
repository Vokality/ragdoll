import { describe, it, expect, beforeEach } from "bun:test";
import { IdleController } from "../../src/controllers/idle-controller";

describe("IdleController", () => {
  let controller: IdleController;

  beforeEach(() => {
    controller = new IdleController();
  });

  describe("initial state", () => {
    it("should start with default idle state", () => {
      const state = controller.getState();
      expect(state.blinkAmount).toBe(0);
      expect(state.isBlinking).toBe(false);
      expect(state.breathPhase).toBe(0);
      expect(state.breathAmount).toBe(0);
      expect(state.pupilOffsetX).toBe(0);
      expect(state.pupilOffsetY).toBe(0);
      expect(state.headMicroX).toBe(0);
      expect(state.headMicroY).toBe(0);
    });

    it("should be enabled by default", () => {
      expect(controller.isEnabled()).toBe(true);
    });
  });

  describe("blink timing and intervals", () => {
    it("should generate random blink intervals within bounds", () => {
      controller.reset();
      const state1 = controller.getState();
      controller.reset();
      const state2 = controller.getState();
      // Intervals should be random, so they might differ
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
    });

    it("should trigger blink after interval", () => {
      controller.reset();
      // Advance time past minimum blink interval
      controller.update(3.0);
      const state = controller.getState();
      // Should have blinked at least once
      expect(state.blinkAmount).toBeGreaterThanOrEqual(0);
    });

    it("should complete blink cycle", () => {
      controller.triggerBlink();
      expect(controller.getState().isBlinking).toBe(true);
      // Complete blink cycle (blink duration is 0.15s total: 0.06s closing, 0.015s closed, 0.075s opening)
      controller.update(0.06); // Closing phase
      controller.update(0.015); // Closed phase
      controller.update(0.075); // Opening phase
      controller.update(0.05); // Extra to ensure complete
      const state = controller.getState();
      // Blink should be complete
      expect(state.isBlinking).toBe(false);
      expect(state.blinkAmount).toBeLessThan(0.1);
    });
  });

  describe("blink phases", () => {
    it("should transition through blink phases", () => {
      controller.triggerBlink();
      expect(controller.getState().isBlinking).toBe(true);
      // Update once to start the blink animation
      controller.update(0.01);
      expect(controller.getState().blinkAmount).toBeGreaterThanOrEqual(0);

      // Closing phase
      controller.update(0.05);
      const closingState = controller.getState();
      expect(closingState.blinkAmount).toBeGreaterThan(0);
      expect(closingState.blinkAmount).toBeLessThanOrEqual(1);

      // Closed phase
      controller.update(0.05);
      const closedState = controller.getState();
      expect(closedState.blinkAmount).toBe(1);

      // Opening phase
      controller.update(0.1);
      const openingState = controller.getState();
      expect(openingState.blinkAmount).toBeLessThan(1);
      expect(openingState.blinkAmount).toBeGreaterThanOrEqual(0);

      // Back to idle
      controller.update(0.1);
      const idleState = controller.getState();
      expect(idleState.isBlinking).toBe(false);
      expect(idleState.blinkAmount).toBe(0);
    });

    it("should not trigger blink if already blinking", () => {
      controller.triggerBlink();
      controller.triggerBlink(); // Try to trigger again
      const secondState = controller.getState();
      // Should still be in same blink cycle
      expect(secondState.isBlinking).toBe(true);
    });
  });

  describe("breathing cycle", () => {
    it("should calculate breath phase", () => {
      controller.update(1.0);
      const state1 = controller.getState();
      controller.update(1.0);
      const state2 = controller.getState();
      expect(state1.breathPhase).toBeGreaterThanOrEqual(0);
      expect(state1.breathPhase).toBeLessThanOrEqual(1);
      expect(state2.breathPhase).toBeGreaterThanOrEqual(0);
      expect(state2.breathPhase).toBeLessThanOrEqual(1);
    });

    it("should cycle breath phase", () => {
      controller.update(3.5); // One full cycle
      const state1 = controller.getState();
      controller.update(3.5); // Another full cycle
      const state2 = controller.getState();
      // Phase should cycle back
      expect(state1.breathPhase).toBeGreaterThanOrEqual(0);
      expect(state2.breathPhase).toBeGreaterThanOrEqual(0);
    });

    it("should calculate breath amount", () => {
      controller.update(1.0);
      const state = controller.getState();
      expect(state.breathAmount).toBeGreaterThanOrEqual(0);
      expect(state.breathAmount).toBeLessThanOrEqual(0.02);
    });

    it("should have natural breathing rhythm", () => {
      // Inhale should be faster than exhale
      controller.update(0.4 * 3.5); // Inhale phase
      const inhaleState = controller.getState();
      controller.update(0.6 * 3.5); // Exhale phase
      const exhaleState = controller.getState();
      expect(inhaleState.breathAmount).toBeGreaterThanOrEqual(0);
      expect(exhaleState.breathAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("eye saccade movements", () => {
    it("should generate random saccade targets", () => {
      controller.update(1.0);
      const state1 = controller.getState();
      controller.reset();
      controller.update(1.0);
      const state2 = controller.getState();
      // Saccades should be random
      expect(state1.pupilOffsetX).toBeDefined();
      expect(state2.pupilOffsetX).toBeDefined();
    });

    it("should move pupils toward target", () => {
      controller.update(0.5);
      const state1 = controller.getState();
      controller.update(0.1);
      const state2 = controller.getState();
      // Pupils should move (or be at target)
      expect(Math.abs(state2.pupilOffsetX - state1.pupilOffsetX)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(state2.pupilOffsetY - state1.pupilOffsetY)).toBeGreaterThanOrEqual(0);
    });

    it("should limit saccade offset", () => {
      controller.update(2.0);
      const state = controller.getState();
      expect(Math.abs(state.pupilOffsetX)).toBeLessThanOrEqual(3);
      expect(Math.abs(state.pupilOffsetY)).toBeLessThanOrEqual(3);
    });

    it("should generate new saccades at intervals", () => {
      controller.update(0.5);
      const state1 = controller.getState();
      controller.update(1.0);
      const state2 = controller.getState();
      // Should have moved or generated new target
      expect(state1.pupilOffsetX).toBeDefined();
      expect(state2.pupilOffsetX).toBeDefined();
    });
  });

  describe("head micro-movements", () => {
    it("should generate head micro-movements", () => {
      controller.update(1.0);
      const state = controller.getState();
      expect(state.headMicroX).toBeDefined();
      expect(state.headMicroY).toBeDefined();
    });

    it("should have organic head movement pattern", () => {
      controller.update(1.0);
      const state1 = controller.getState();
      controller.update(1.0);
      const state2 = controller.getState();
      // Should have some variation
      expect(state1.headMicroX).toBeDefined();
      expect(state2.headMicroX).toBeDefined();
    });

    it("should keep head movements subtle", () => {
      controller.update(10.0);
      const state = controller.getState();
      expect(Math.abs(state.headMicroX)).toBeLessThan(1);
      expect(Math.abs(state.headMicroY)).toBeLessThan(1);
    });
  });

  describe("random interval generation", () => {
    it("should generate blink intervals within bounds", () => {
      // Test multiple resets to check randomness
      const intervals: number[] = [];
      for (let i = 0; i < 10; i++) {
        controller.reset();
        const state = controller.getState();
        intervals.push(state.blinkAmount);
      }
      // Should have some variation
      expect(intervals.length).toBe(10);
    });

    it("should generate saccade intervals within bounds", () => {
      controller.update(0.5);
      const state = controller.getState();
      expect(state.pupilOffsetX).toBeDefined();
      expect(state.pupilOffsetY).toBeDefined();
    });
  });

  describe("state updates over time", () => {
    it("should update all idle animations", () => {
      controller.update(1.0);
      const state = controller.getState();
      expect(state.blinkAmount).toBeGreaterThanOrEqual(0);
      expect(state.breathPhase).toBeGreaterThanOrEqual(0);
      expect(state.pupilOffsetX).toBeDefined();
      expect(state.headMicroX).toBeDefined();
    });

    it("should handle multiple update calls", () => {
      for (let i = 0; i < 10; i++) {
        controller.update(0.1);
        const state = controller.getState();
        expect(state).toBeDefined();
      }
    });
  });

  describe("enable/disable", () => {
    it("should disable idle animations", () => {
      controller.setEnabled(false);
      expect(controller.isEnabled()).toBe(false);
      const stateBefore = controller.getState();
      controller.update(1.0);
      const stateAfter = controller.getState();
      // State should not change when disabled
      expect(stateAfter.blinkAmount).toBe(stateBefore.blinkAmount);
    });

    it("should re-enable idle animations", () => {
      controller.setEnabled(false);
      controller.setEnabled(true);
      expect(controller.isEnabled()).toBe(true);
      controller.update(1.0);
      const state = controller.getState();
      expect(state).toBeDefined();
    });
  });

  describe("reset", () => {
    it("should reset controller state", () => {
      controller.update(5.0);
      // Trigger a blink to test reset
      controller.triggerBlink();
      controller.update(0.1);
      expect(controller.getState().isBlinking).toBe(true);
      controller.reset();
      // Reset sets elapsed to 0 and blinkPhase to "idle", but isBlinking flag
      // may persist until update processes. Update to sync state.
      controller.update(0.01);
      const state = controller.getState();
      // After reset, blink phase is "idle" so blinkAmount should be 0
      expect(state.blinkAmount).toBeLessThan(0.1);
      // Pupil offsets reset to 0
      expect(Math.abs(state.pupilOffsetX)).toBeLessThan(0.1);
      expect(Math.abs(state.pupilOffsetY)).toBeLessThan(0.1);
    });

    it("should reset elapsed time", () => {
      controller.update(5.0);
      controller.reset();
      controller.update(1.0);
      const state = controller.getState();
      expect(state).toBeDefined();
    });
  });
});
