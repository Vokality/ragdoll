import { describe, it, expect, beforeEach } from "bun:test";
import {
  RagdollGeometry,
  type ExpressionConfig,
} from "../../src/models/ragdoll-geometry";
import type { FacialMood } from "../../src/types";
import {
  einsteinVariant,
  getDefaultVariant,
  humanVariant,
} from "../../src/variants";

const MOODS: readonly FacialMood[] = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
  "confusion",
  "thinking",
];

const SYMMETRIC_MOODS: readonly FacialMood[] = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
];

const BUILT_IN_VARIANTS = [humanVariant, einsteinVariant] as const;
const TRANSITION_SAMPLES = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] as const;

function expectFinitePath(path: string): void {
  expect(path.length).toBeGreaterThan(0);
  expect(path).not.toMatch(/NaN|Infinity/);
}

function expectFiniteExpressionGeometry(
  geometry: RagdollGeometry,
  expression: ExpressionConfig,
): void {
  const leftEye = geometry.getEyePath(true, expression.leftEye);
  const rightEye = geometry.getEyePath(false, expression.rightEye);
  const leftIris = geometry.getIrisPosition(true, expression.leftEye);
  const rightIris = geometry.getIrisPosition(false, expression.rightEye);
  const mouth = geometry.getMouthPath(expression.mouth);

  for (const path of [
    leftEye.sclera,
    leftEye.clipPath,
    leftEye.upperLid,
    leftEye.lowerLid,
    rightEye.sclera,
    rightEye.clipPath,
    rightEye.upperLid,
    rightEye.lowerLid,
    geometry.getEyebrowPath(true, expression.leftEyebrow),
    geometry.getEyebrowPath(false, expression.rightEyebrow),
    mouth.upperLip,
    mouth.lowerLip,
  ]) {
    expectFinitePath(path);
  }

  if (mouth.openingHeight > 1) {
    expectFinitePath(mouth.opening);
  } else {
    expect(mouth.opening).toBe("");
  }

  expect(leftEye.aperture.height).toBeGreaterThanOrEqual(0);
  expect(rightEye.aperture.height).toBeGreaterThanOrEqual(0);
  expect(mouth.openingHeight).toBeGreaterThanOrEqual(0);

  for (const value of [
    leftIris.cx,
    leftIris.cy,
    leftIris.irisR,
    leftIris.pupilR,
    rightIris.cx,
    rightIris.cy,
    rightIris.irisR,
    rightIris.pupilR,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
  }

  expect(leftIris.pupilR).toBeLessThan(leftIris.irisR);
  expect(rightIris.pupilR).toBeLessThan(rightIris.irisR);
}

describe("RagdollGeometry", () => {
  let geometry: RagdollGeometry;

  beforeEach(() => {
    const variant = getDefaultVariant();
    geometry = new RagdollGeometry(variant);
  });

  describe("expression config retrieval", () => {
    it("should get expression for neutral mood", () => {
      const expr = geometry.getExpressionForMood("neutral");
      expect(expr).toBeDefined();
      expect(expr.leftEye).toBeDefined();
      expect(expr.rightEye).toBeDefined();
      expect(expr.mouth).toBeDefined();
    });

    it("should get expression for smile mood", () => {
      const expr = geometry.getExpressionForMood("smile");
      expect(expr.mouth.cornerPull).toBeGreaterThan(0);
      expect(expr.leftEye.squint).toBeGreaterThan(0);
    });

    it("should get expression for sad mood", () => {
      const expr = geometry.getExpressionForMood("sad");
      expect(expr.mouth.cornerPull).toBeLessThan(0);
      expect(expr.leftEyebrow.innerY).toBeGreaterThan(0);
    });

    it("should get expression for angry mood", () => {
      const expr = geometry.getExpressionForMood("angry");
      expect(expr.leftEyebrow.innerY).toBeLessThan(0);
      expect(expr.noseScrunch).toBeGreaterThan(0);
    });

    it("should get expression for laugh mood", () => {
      const expr = geometry.getExpressionForMood("laugh");
      expect(expr.mouth.lowerLipTop).toBeGreaterThan(10);
      expect(expr.cheekPuff).toBeGreaterThan(0);
    });

    it("should get expression for surprise mood", () => {
      const expr = geometry.getExpressionForMood("surprise");
      expect(expr.leftEye.openness).toBeGreaterThan(1);
      expect(expr.leftEye.pupilSize).toBeGreaterThan(1);
    });

    it("should get expression for confusion mood", () => {
      const expr = geometry.getExpressionForMood("confusion");
      expect(expr.leftEye.pupilOffset.x).not.toBe(expr.rightEye.pupilOffset.x);
    });

    it("should get expression for thinking mood", () => {
      const expr = geometry.getExpressionForMood("thinking");
      expect(expr).toBeDefined();
      expect(expr.leftEye).toBeDefined();
    });

    it("should get expression for frown mood", () => {
      const expr = geometry.getExpressionForMood("frown");
      expect(expr.mouth.cornerPull).toBeLessThan(0);
    });
  });

  describe("expression interpolation", () => {
    it("should interpolate between two expressions", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(
        neutral,
        smile,
        0.5,
      );

      expect(interpolated.mouth.cornerPull).toBeGreaterThan(
        neutral.mouth.cornerPull,
      );
      expect(interpolated.mouth.cornerPull).toBeLessThan(
        smile.mouth.cornerPull,
      );
    });

    it("should return first expression at t=0", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(
        neutral,
        smile,
        0,
      );

      expect(interpolated.mouth.cornerPull).toBeCloseTo(
        neutral.mouth.cornerPull,
        2,
      );
    });

    it("should return second expression at t=1", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(
        neutral,
        smile,
        1,
      );

      expect(interpolated.mouth.cornerPull).toBeCloseTo(
        smile.mouth.cornerPull,
        2,
      );
    });

    it("should interpolate eye properties", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(
        neutral,
        smile,
        0.5,
      );

      expect(interpolated.leftEye.openness).toBeGreaterThan(
        smile.leftEye.openness,
      );
      expect(interpolated.leftEye.openness).toBeLessThanOrEqual(
        neutral.leftEye.openness,
      );
    });

    it("should interpolate eyebrow properties", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const sad = geometry.getExpressionForMood("sad");
      const interpolated = RagdollGeometry.interpolateExpression(
        neutral,
        sad,
        0.5,
      );

      expect(interpolated.leftEyebrow.innerY).toBeGreaterThan(
        neutral.leftEyebrow.innerY,
      );
      expect(interpolated.leftEyebrow.innerY).toBeLessThan(
        sad.leftEyebrow.innerY,
      );
    });
  });

  describe("geometry calculations", () => {
    it("should have valid dimensions", () => {
      expect(geometry.dimensions.headWidth).toBeGreaterThan(0);
      expect(geometry.dimensions.headHeight).toBeGreaterThan(0);
      expect(geometry.dimensions.eyeWidth).toBeGreaterThan(0);
      expect(geometry.dimensions.mouthWidth).toBeGreaterThan(0);
    });

    it("should apply variant dimension overrides", () => {
      const einsteinVariant = getDefaultVariant();
      const einsteinGeometry = new RagdollGeometry(einsteinVariant);
      expect(einsteinGeometry.dimensions).toBeDefined();
    });
  });

  describe("face dimension handling", () => {
    it("should have all required dimensions", () => {
      const dims = geometry.dimensions;
      expect(dims.headWidth).toBeDefined();
      expect(dims.headHeight).toBeDefined();
      expect(dims.jawWidth).toBeDefined();
      expect(dims.chinHeight).toBeDefined();
      expect(dims.eyeWidth).toBeDefined();
      expect(dims.eyeHeight).toBeDefined();
      expect(dims.eyeSpacing).toBeDefined();
      expect(dims.eyeY).toBeDefined();
      expect(dims.irisRadius).toBeDefined();
      expect(dims.pupilRadius).toBeDefined();
      expect(dims.eyebrowWidth).toBeDefined();
      expect(dims.eyebrowThickness).toBeDefined();
      expect(dims.eyebrowY).toBeDefined();
      expect(dims.noseWidth).toBeDefined();
      expect(dims.noseHeight).toBeDefined();
      expect(dims.noseY).toBeDefined();
      expect(dims.mouthWidth).toBeDefined();
      expect(dims.mouthY).toBeDefined();
      expect(dims.lipThickness).toBeDefined();
      expect(dims.earWidth).toBeDefined();
      expect(dims.earHeight).toBeDefined();
      expect(dims.neckWidth).toBeDefined();
      expect(dims.neckHeight).toBeDefined();
    });
  });

  describe("eye/mouth/eyebrow state management", () => {
    it("should set expression", () => {
      const smile = geometry.getExpressionForMood("smile");
      geometry.setExpression(smile);
      expect(geometry.currentExpression.mouth.cornerPull).toBe(
        smile.mouth.cornerPull,
      );
    });

    it("should update current expression", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      geometry.setExpression(neutral);
      const smile = geometry.getExpressionForMood("smile");
      geometry.setExpression(smile);
      expect(geometry.currentExpression.mouth.cornerPull).toBe(
        smile.mouth.cornerPull,
      );
    });

    it("should maintain eye state", () => {
      const expr = geometry.getExpressionForMood("smile");
      geometry.setExpression(expr);
      expect(geometry.currentExpression.leftEye).toBeDefined();
      expect(geometry.currentExpression.rightEye).toBeDefined();
    });

    it("should maintain mouth state", () => {
      const expr = geometry.getExpressionForMood("laugh");
      geometry.setExpression(expr);
      expect(geometry.currentExpression.mouth.width).toBeGreaterThan(1);
    });

    it("should maintain eyebrow state", () => {
      const expr = geometry.getExpressionForMood("angry");
      geometry.setExpression(expr);
      expect(geometry.currentExpression.leftEyebrow.innerY).toBeLessThan(0);
    });
  });

  describe("default expression values", () => {
    it("should have neutral expression as default", () => {
      const expr = geometry.currentExpression;
      expect(expr.leftEye.openness).toBe(1);
      expect(expr.mouth.cornerPull).toBe(0);
      expect(expr.cheekPuff).toBe(0);
      expect(expr.noseScrunch).toBe(0);
    });

    it("should have symmetric eyes in neutral", () => {
      const expr = geometry.currentExpression;
      expect(expr.leftEye.openness).toBe(expr.rightEye.openness);
      expect(expr.leftEye.pupilSize).toBe(expr.rightEye.pupilSize);
    });

    it("should have symmetric eyebrows in neutral", () => {
      const expr = geometry.currentExpression;
      expect(expr.leftEyebrow.innerY).toBe(expr.rightEyebrow.innerY);
      expect(expr.leftEyebrow.arcY).toBe(expr.rightEyebrow.arcY);
    });
  });

  describe("variant integration", () => {
    it("should use variant dimensions", () => {
      const variant = getDefaultVariant();
      const customGeometry = new RagdollGeometry(variant);
      expect(customGeometry.variant.id).toBe(variant.id);
    });

    it("should merge variant dimension overrides", () => {
      const variant = getDefaultVariant();
      const customGeometry = new RagdollGeometry(variant);
      expect(customGeometry.dimensions).toBeDefined();
    });
  });

  describe("built-in facial proportion invariants", () => {
    for (const variant of BUILT_IN_VARIANTS) {
      it(`${variant.id} keeps facial features in natural anatomical order and bounds`, () => {
        const variantGeometry = new RagdollGeometry(variant);
        const d = variantGeometry.dimensions;
        const faceBottom = d.headHeight * 0.25 + d.chinHeight;

        expect(d.jawWidth).toBeLessThanOrEqual(d.headWidth);
        expect(d.eyeSpacing + d.eyeWidth).toBeLessThan(d.headWidth);
        expect(d.irisRadius).toBeLessThanOrEqual(d.eyeHeight / 2 + 1);
        expect(d.pupilRadius).toBeLessThan(d.irisRadius);
        expect(d.eyeY).toBeLessThan(d.noseY);
        expect(d.noseY).toBeLessThan(d.mouthY);
        expect(d.eyebrowY).toBeGreaterThan(d.eyeHeight / 2);
        expect(d.mouthY).toBeLessThan(faceBottom);
      });
    }
  });

  describe("expression geometry invariants", () => {
    for (const variant of BUILT_IN_VARIANTS) {
      for (const mood of MOODS) {
        it(`${variant.id} ${mood} produces finite, non-intersecting face geometry`, () => {
          const variantGeometry = new RagdollGeometry(variant);
          const expression = variantGeometry.getExpressionForMood(mood);
          const d = variantGeometry.dimensions;
          const faceBottom = d.headHeight * 0.25 + d.chinHeight;
          const mouthBottom =
            d.mouthY +
            expression.mouth.lowerLipBottom +
            Math.max(0, expression.mouth.lowerLipCurve * 4);

          expectFiniteExpressionGeometry(variantGeometry, expression);
          expect(mouthBottom).toBeLessThan(faceBottom);
        });
      }
    }

    it("fully closes the visible eye aperture", () => {
      const expression = geometry.getExpressionForMood("neutral");
      const closedEye = geometry.getEyePath(true, {
        ...expression.leftEye,
        openness: 0,
      });

      expect(closedEye.aperture.height).toBe(0);
      expect(closedEye.aperture.upperY).toBe(closedEye.aperture.lowerY);
    });

    it("changes pupil dilation without changing iris size", () => {
      const expression = geometry.getExpressionForMood("neutral");
      const normal = geometry.getIrisPosition(true, expression.leftEye);
      const dilated = geometry.getIrisPosition(true, {
        ...expression.leftEye,
        pupilSize: 1.5,
      });

      expect(dilated.irisR).toBe(normal.irisR);
      expect(dilated.pupilR).toBeGreaterThan(normal.pupilR);
      expect(dilated.pupilR).toBeLessThan(dilated.irisR);
    });

    it("applies eyebrow rotation to the generated path", () => {
      const expression = geometry.getExpressionForMood("neutral");
      const unrotated = geometry.getEyebrowPath(true, expression.leftEyebrow);
      const rotated = geometry.getEyebrowPath(true, {
        ...expression.leftEyebrow,
        rotation: 0.2,
      });

      expect(rotated).not.toBe(unrotated);
      expectFinitePath(rotated);
    });

    for (const mood of SYMMETRIC_MOODS) {
      it(`${mood} preserves bilateral expression symmetry`, () => {
        const expression = geometry.getExpressionForMood(mood);

        expect(expression.leftEye).toEqual(expression.rightEye);
        expect(expression.leftEyebrow.innerY).toBe(
          expression.rightEyebrow.innerY,
        );
        expect(expression.leftEyebrow.arcY).toBe(expression.rightEyebrow.arcY);
        expect(expression.leftEyebrow.outerY).toBe(
          expression.rightEyebrow.outerY,
        );
        expect(expression.leftEyebrow.rotation).toBeCloseTo(
          -expression.rightEyebrow.rotation,
          10,
        );
      });
    }
  });

  describe("transition geometry invariants", () => {
    for (const variant of BUILT_IN_VARIANTS) {
      it(`${variant.id} keeps every mood-to-mood transition valid`, () => {
        const variantGeometry = new RagdollGeometry(variant);

        for (const fromMood of MOODS) {
          for (const toMood of MOODS) {
            const from = variantGeometry.getExpressionForMood(fromMood);
            const to = variantGeometry.getExpressionForMood(toMood);

            for (const progress of TRANSITION_SAMPLES) {
              const expression = RagdollGeometry.interpolateExpression(
                from,
                to,
                progress,
              );
              expectFiniteExpressionGeometry(variantGeometry, expression);
            }
          }
        }
      });
    }
  });
});
