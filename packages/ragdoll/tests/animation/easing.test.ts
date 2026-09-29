import { describe, it, expect } from "bun:test";
import {
  easeInOutCubic,
  easeInQuad,
  easeOutCubic,
  easeOutQuad,
  smoothStep,
} from "../../src/animation/easing";

const CURVES = {
  easeInQuad,
  easeOutQuad,
  easeOutCubic,
  easeInOutCubic,
  smoothStep,
};

describe("easing", () => {
  for (const [name, curve] of Object.entries(CURVES)) {
    describe(name, () => {
      it("maps the endpoints to 0 and 1", () => {
        expect(curve(0)).toBe(0);
        expect(curve(1)).toBe(1);
      });

      it("clamps input outside [0, 1]", () => {
        expect(curve(-0.5)).toBe(0);
        expect(curve(1.5)).toBe(1);
      });

      it("increases monotonically", () => {
        let previous = curve(0);
        for (let i = 1; i <= 20; i++) {
          const value = curve(i / 20);
          expect(value).toBeGreaterThanOrEqual(previous);
          previous = value;
        }
      });
    });
  }

  it("eases in slowly and out quickly", () => {
    expect(easeInQuad(0.5)).toBeLessThan(0.5);
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(easeOutQuad(0.5));
  });

  it("keeps the symmetric curves centred", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(smoothStep(0.5)).toBeCloseTo(0.5);
  });
});
