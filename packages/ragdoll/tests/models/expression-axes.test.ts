import { describe, expect, it } from "bun:test";
import {
  applyAxes,
  clampAxis,
  cloneExpression,
  GAZE_OFFSET_X,
  GAZE_OFFSET_Y,
} from "../../src/models/expression-axes";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import { getDefaultVariant } from "../../src/variants";

function geometry(): RagdollGeometry {
  return new RagdollGeometry(getDefaultVariant());
}

function jawOpen(mouth: {
  lowerLipTop: number;
  upperLipBottom: number;
}): number {
  return Math.max(0, mouth.lowerLipTop - mouth.upperLipBottom - 2) / 26;
}

describe("clampAxis", () => {
  it("clamps each axis to its inclusive range", () => {
    expect(clampAxis("smile", 2)).toBe(1);
    expect(clampAxis("smile", -1)).toBe(0);
    expect(clampAxis("frown", 1.5)).toBe(1);
    expect(clampAxis("brows", -4)).toBe(-1);
    expect(clampAxis("brows", 3)).toBe(1);
    expect(clampAxis("eyesOpen", 2)).toBe(1.3);
    expect(clampAxis("eyesOpen", -0.2)).toBe(0);
    expect(clampAxis("jaw", 9)).toBe(1);
    expect(clampAxis("gazeX", 1.4)).toBe(1);
    expect(clampAxis("gazeY", -2)).toBe(-1);
  });
});

describe("cloneExpression", () => {
  it("deep-clones nested eye, brow, and mouth objects", () => {
    const base = geometry().getExpressionForMood("smile");
    const cloned = cloneExpression(base);

    cloned.mouth.cornerPull = 0;
    cloned.leftEye.pupilOffset.x = 99;
    cloned.rightEye.openness = 0;
    cloned.leftEyebrow.innerY = 99;

    expect(base.mouth.cornerPull).toBe(0.8);
    expect(base.leftEye.pupilOffset.x).toBe(0);
    expect(base.rightEye.openness).toBe(0.9);
    expect(base.leftEyebrow.innerY).toBe(0);
  });
});

describe("applyAxes", () => {
  it("does not mutate the mood base", () => {
    const base = geometry().getExpressionForMood("laugh");
    const snapshot = cloneExpression(base);
    const mixed = applyAxes(base, { jaw: 1, smile: 0.5, gazeX: 1 });

    expect(base).toEqual(snapshot);
    mixed.mouth.cornerPull = 0;
    mixed.leftEye.pupilOffset.x = 0;
    expect(base).toEqual(snapshot);
  });

  it("replaces cornerPull for smile, frown, and both", () => {
    const base = geometry().getExpressionForMood("smile");
    expect(applyAxes(base, { smile: 0.3 }).mouth.cornerPull).toBeCloseTo(0.3);
    expect(applyAxes(base, { frown: 1 }).mouth.cornerPull).toBeCloseTo(-1);
    expect(applyAxes(base, { smile: 1, frown: 1 }).mouth.cornerPull).toBe(0);
  });

  it("maps gaze onto pupilOffset without touching an unowned axis", () => {
    const thinking = geometry().getExpressionForMood("thinking");
    const xOnly = applyAxes(thinking, { gazeX: 1 });
    expect(xOnly.leftEye.pupilOffset.x).toBeCloseTo(GAZE_OFFSET_X);
    expect(xOnly.leftEye.pupilOffset.y).toBe(thinking.leftEye.pupilOffset.y);

    const yOnly = applyAxes(thinking, { gazeY: 1 });
    expect(yOnly.leftEye.pupilOffset.x).toBe(thinking.leftEye.pupilOffset.x);
    expect(yOnly.leftEye.pupilOffset.y).toBeCloseTo(-GAZE_OFFSET_Y);
  });

  it("keeps mouth path invariants for jaw 0, 0.5, and 1 on neutral and laugh", () => {
    const geo = geometry();
    for (const mood of ["neutral", "laugh"] as const) {
      const base = geo.getExpressionForMood(mood);
      for (const jaw of [0, 0.5, 1]) {
        const mixed = applyAxes(base, { jaw });
        expect(() => geo.getMouthPath(mixed.mouth)).not.toThrow();
        if (jaw === 1) {
          expect(jawOpen(mixed.mouth)).toBeGreaterThan(0.9);
        }
      }
    }
  });

  it("keeps mouth path invariants while interpolating a jaw overlay", () => {
    const geo = geometry();
    const laugh = geo.getExpressionForMood("laugh");
    const start = applyAxes(laugh, {});
    const end = applyAxes(laugh, { jaw: 1 });
    for (const t of [0, 0.1, 0.35, 0.5, 0.9, 1]) {
      const frame = RagdollGeometry.interpolateExpression(start, end, t);
      expect(() => geo.getMouthPath(frame.mouth)).not.toThrow();
    }
  });
});
