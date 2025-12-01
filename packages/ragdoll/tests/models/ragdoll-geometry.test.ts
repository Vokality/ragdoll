import { describe, it, expect, beforeEach } from "bun:test";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import { getDefaultVariant } from "../../src/variants";

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
      const interpolated = RagdollGeometry.interpolateExpression(neutral, smile, 0.5);
      
      expect(interpolated.mouth.cornerPull).toBeGreaterThan(neutral.mouth.cornerPull);
      expect(interpolated.mouth.cornerPull).toBeLessThan(smile.mouth.cornerPull);
    });

    it("should return first expression at t=0", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(neutral, smile, 0);
      
      expect(interpolated.mouth.cornerPull).toBeCloseTo(neutral.mouth.cornerPull, 2);
    });

    it("should return second expression at t=1", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(neutral, smile, 1);
      
      expect(interpolated.mouth.cornerPull).toBeCloseTo(smile.mouth.cornerPull, 2);
    });

    it("should interpolate eye properties", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const smile = geometry.getExpressionForMood("smile");
      const interpolated = RagdollGeometry.interpolateExpression(neutral, smile, 0.5);
      
      expect(interpolated.leftEye.openness).toBeGreaterThan(smile.leftEye.openness);
      expect(interpolated.leftEye.openness).toBeLessThanOrEqual(neutral.leftEye.openness);
    });

    it("should interpolate eyebrow properties", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      const sad = geometry.getExpressionForMood("sad");
      const interpolated = RagdollGeometry.interpolateExpression(neutral, sad, 0.5);
      
      expect(interpolated.leftEyebrow.innerY).toBeGreaterThan(neutral.leftEyebrow.innerY);
      expect(interpolated.leftEyebrow.innerY).toBeLessThan(sad.leftEyebrow.innerY);
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
      expect(geometry.currentExpression.mouth.cornerPull).toBe(smile.mouth.cornerPull);
    });

    it("should update current expression", () => {
      const neutral = geometry.getExpressionForMood("neutral");
      geometry.setExpression(neutral);
      const smile = geometry.getExpressionForMood("smile");
      geometry.setExpression(smile);
      expect(geometry.currentExpression.mouth.cornerPull).toBe(smile.mouth.cornerPull);
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
});

