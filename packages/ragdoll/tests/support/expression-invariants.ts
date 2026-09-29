import { expect } from "bun:test";
import type {
  ExpressionConfig,
  FaceDimensions,
  MouthState,
} from "../../src/models/ragdoll-geometry";

function expectFiniteNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    expect({ path, finite: Number.isFinite(value) }).toEqual({
      path,
      finite: true,
    });
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      expectFiniteNumbers(child, `${path}.${key}`);
    }
  }
}

/** Lips keep a real thickness and never cross. */
export function expectValidMouth(
  mouth: MouthState,
  dims: FaceDimensions,
): void {
  expectFiniteNumbers(mouth, "mouth");
  const upperTop = dims.mouthY - dims.lipThickness + mouth.upperLipTop;
  const upperBottom = dims.mouthY + mouth.upperLipBottom;
  const lowerTop = dims.mouthY + mouth.lowerLipTop;
  const lowerBottom = dims.mouthY + mouth.lowerLipBottom;
  expect(mouth.width).toBeGreaterThan(0);
  expect(upperBottom - upperTop).toBeGreaterThanOrEqual(2);
  expect(lowerBottom - lowerTop).toBeGreaterThanOrEqual(2);
  expect(lowerTop).toBeGreaterThanOrEqual(upperBottom);
}

/** A mood or action face: valid eyes and lips, with the mouth above the chin. */
export function expectValidExpression(
  expression: ExpressionConfig,
  dims: FaceDimensions,
): void {
  expectFiniteNumbers(expression, "expression");
  for (const eye of [expression.leftEye, expression.rightEye]) {
    expect(eye.openness).toBeGreaterThanOrEqual(0);
    expect(eye.pupilSize).toBeGreaterThan(0);
  }
  const { mouth } = expression;
  expectValidMouth(mouth, dims);
  const faceBottom = dims.headHeight * 0.25 + dims.chinHeight;
  const mouthBottom =
    dims.mouthY + mouth.lowerLipBottom + Math.max(0, mouth.lowerLipCurve * 4);
  expect(mouthBottom).toBeLessThanOrEqual(faceBottom);
}
