import { describe, it, expect } from "bun:test";
import {
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeOutElastic,
  easeInElastic,
  easeInOutElastic,
  easeOutBounce,
  easeInBounce,
  smoothStep,
  smootherStep,
  shapeWalkCycle,
  organicSine,
  anticipate,
  overshoot,
} from "../../src/animation/easing";

describe("Easing Functions", () => {
  describe("basic easing functions", () => {
    describe("easeInQuad", () => {
      it("should return 0 at t=0", () => {
        expect(easeInQuad(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInQuad(1)).toBe(1);
      });

      it("should increase quadratically", () => {
        expect(easeInQuad(0.5)).toBe(0.25);
      });
    });

    describe("easeOutQuad", () => {
      it("should return 0 at t=0", () => {
        expect(easeOutQuad(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeOutQuad(1)).toBe(1);
      });

      it("should decrease quadratically", () => {
        expect(easeOutQuad(0.5)).toBe(0.75);
      });
    });

    describe("easeInOutQuad", () => {
      it("should return 0 at t=0", () => {
        expect(easeInOutQuad(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInOutQuad(1)).toBe(1);
      });

      it("should be symmetric", () => {
        expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 2);
      });
    });

    describe("easeInCubic", () => {
      it("should return 0 at t=0", () => {
        expect(easeInCubic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInCubic(1)).toBe(1);
      });

      it("should increase cubically", () => {
        expect(easeInCubic(0.5)).toBe(0.125);
      });
    });

    describe("easeOutCubic", () => {
      it("should return 0 at t=0", () => {
        expect(easeOutCubic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeOutCubic(1)).toBe(1);
      });
    });

    describe("easeInOutCubic", () => {
      it("should return 0 at t=0", () => {
        expect(easeInOutCubic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInOutCubic(1)).toBe(1);
      });
    });
  });

  describe("back easing functions", () => {
    describe("easeInBack", () => {
      it("should return 0 at t=0", () => {
        expect(easeInBack(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInBack(1)).toBeCloseTo(1, 2);
      });

      it("should overshoot below 0", () => {
        const result = easeInBack(0.1);
        expect(result).toBeLessThan(0);
      });
    });

    describe("easeOutBack", () => {
      it("should return 0 at t=0", () => {
        expect(easeOutBack(0)).toBeCloseTo(0, 10);
      });

      it("should return 1 at t=1", () => {
        expect(easeOutBack(1)).toBeCloseTo(1, 2);
      });

      it("should overshoot above 1", () => {
        const result = easeOutBack(0.9);
        expect(result).toBeGreaterThan(1);
      });
    });

    describe("easeInOutBack", () => {
      it("should return 0 at t=0", () => {
        expect(easeInOutBack(0)).toBeCloseTo(0, 10);
      });

      it("should return 1 at t=1", () => {
        expect(easeInOutBack(1)).toBeCloseTo(1, 2);
      });
    });
  });

  describe("elastic easing functions", () => {
    describe("easeOutElastic", () => {
      it("should return 0 at t=0", () => {
        expect(easeOutElastic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeOutElastic(1)).toBe(1);
      });

      it("should oscillate", () => {
        const result = easeOutElastic(0.5);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(2);
      });
    });

    describe("easeInElastic", () => {
      it("should return 0 at t=0", () => {
        expect(easeInElastic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInElastic(1)).toBe(1);
      });
    });

    describe("easeInOutElastic", () => {
      it("should return 0 at t=0", () => {
        expect(easeInOutElastic(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInOutElastic(1)).toBe(1);
      });
    });
  });

  describe("bounce easing functions", () => {
    describe("easeOutBounce", () => {
      it("should return 0 at t=0", () => {
        expect(easeOutBounce(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeOutBounce(1)).toBeCloseTo(1, 2);
      });

      it("should bounce", () => {
        const result = easeOutBounce(0.5);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(2);
      });
    });

    describe("easeInBounce", () => {
      it("should return 0 at t=0", () => {
        expect(easeInBounce(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(easeInBounce(1)).toBeCloseTo(1, 2);
      });
    });
  });

  describe("smooth step functions", () => {
    describe("smoothStep", () => {
      it("should return 0 at t=0", () => {
        expect(smoothStep(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(smoothStep(1)).toBe(1);
      });

      it("should be smooth", () => {
        const result = smoothStep(0.5);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });
    });

    describe("smootherStep", () => {
      it("should return 0 at t=0", () => {
        expect(smootherStep(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(smootherStep(1)).toBe(1);
      });
    });
  });

  describe("custom functions", () => {
    describe("shapeWalkCycle", () => {
      it("should return 0 at phase 0", () => {
        expect(shapeWalkCycle(0)).toBe(0);
      });

      it("should return 1 at peak", () => {
        const peak = shapeWalkCycle(Math.PI);
        expect(peak).toBeCloseTo(1, 1);
      });

      it("should cycle", () => {
        const cycle1 = shapeWalkCycle(0);
        const cycle2 = shapeWalkCycle(Math.PI * 2);
        expect(cycle1).toBeCloseTo(cycle2, 2);
      });

      it("should handle negative phases", () => {
        const result = shapeWalkCycle(-Math.PI);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      });
    });

    describe("organicSine", () => {
      it("should return 0 at phase 0", () => {
        expect(organicSine(0)).toBe(0);
      });

      it("should return 1 at phase PI/2", () => {
        expect(organicSine(Math.PI / 2)).toBeCloseTo(1, 1);
      });

      it("should return -1 at phase -PI/2", () => {
        expect(organicSine(-Math.PI / 2)).toBeCloseTo(-1, 1);
      });

      it("should use default sharpness", () => {
        const result1 = organicSine(Math.PI / 2);
        const result2 = organicSine(Math.PI / 2, 0.5);
        expect(result1).toBeCloseTo(result2, 2);
      });

      it("should adjust with sharpness parameter", () => {
        const lowSharp = organicSine(Math.PI / 2, 0.1);
        const highSharp = organicSine(Math.PI / 2, 0.9);
        expect(lowSharp).toBeGreaterThan(0);
        expect(highSharp).toBeGreaterThan(0);
      });
    });

    describe("anticipate", () => {
      it("should return 0 at t=0", () => {
        expect(anticipate(0)).toBeCloseTo(0, 10);
      });

      it("should return 1 at t=1", () => {
        expect(anticipate(1)).toBeCloseTo(1, 2);
      });

      it("should pull back before moving forward", () => {
        const result = anticipate(0.1);
        expect(result).toBeLessThan(0);
      });

      it("should use default anticipation amount", () => {
        const result1 = anticipate(0.1);
        const result2 = anticipate(0.1, 0.2);
        expect(result1).toBeCloseTo(result2, 2);
      });
    });

    describe("overshoot", () => {
      it("should return 0 at t=0", () => {
        expect(overshoot(0)).toBe(0);
      });

      it("should return 1 at t=1", () => {
        expect(overshoot(1)).toBeCloseTo(1, 2);
      });

      it("should overshoot before settling", () => {
        const result = overshoot(0.7);
        expect(result).toBeGreaterThan(1);
      });

      it("should use default overshoot amount", () => {
        const result1 = overshoot(0.7);
        const result2 = overshoot(0.7, 0.1);
        expect(result1).toBeCloseTo(result2, 2);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle t < 0", () => {
      // easeInQuad squares the input, so negative becomes positive
      expect(easeInQuad(-0.5)).toBeGreaterThanOrEqual(0);
      // easeOutQuad can return negative for negative inputs
      const result = easeOutQuad(-0.5);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });

    it("should handle t > 1", () => {
      // Quadratic functions may not exceed 1 for inputs > 1
      expect(easeInQuad(1.5)).toBeGreaterThanOrEqual(0);
      expect(easeOutQuad(1.5)).toBeGreaterThanOrEqual(0);
    });

    it("should handle t = 0.5 for all functions", () => {
      const functions = [
        easeInQuad,
        easeOutQuad,
        easeInOutQuad,
        easeInCubic,
        easeOutCubic,
        easeInOutCubic,
        easeInBack,
        easeOutBack,
        easeInOutBack,
        easeOutElastic,
        easeInElastic,
        easeInOutElastic,
        easeOutBounce,
        easeInBounce,
        smoothStep,
        smootherStep,
      ];
      functions.forEach((fn) => {
        const result = fn(0.5);
        // Back easing can go negative, elastic/bounce can overshoot
        expect(result).toBeGreaterThanOrEqual(-0.5); // Allow some undershoot
        expect(result).toBeLessThanOrEqual(2); // Allow some overshoot
        expect(isNaN(result)).toBe(false);
      });
    });
  });

  describe("mathematical correctness", () => {
    it("should be monotonic for easeIn functions", () => {
      const values = [0, 0.25, 0.5, 0.75, 1].map(easeInQuad);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it("should be monotonic for easeOut functions", () => {
      const values = [0, 0.25, 0.5, 0.75, 1].map(easeOutQuad);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it("should satisfy boundary conditions", () => {
      const functions = [
        easeInQuad,
        easeOutQuad,
        easeInOutQuad,
        easeInCubic,
        easeOutCubic,
        easeInOutCubic,
        smoothStep,
        smootherStep,
      ];
      functions.forEach((fn) => {
        expect(fn(0)).toBe(0);
        expect(fn(1)).toBe(1);
      });
    });
  });
});

