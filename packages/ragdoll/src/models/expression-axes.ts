import type {
  ExpressionAxes,
  ExpressionAxis,
  FaceAxis,
  GazeAxis,
} from "../types";
import type { ExpressionConfig } from "./ragdoll-geometry";

export const FACE_AXES_CLEARED_ON_SET_MOOD: readonly FaceAxis[] = [
  "smile",
  "frown",
  "brows",
  "eyesOpen",
  "jaw",
];

export const GAZE_AXES: readonly GazeAxis[] = ["gazeX", "gazeY"];

export const AXIS_KEYS: readonly ExpressionAxis[] = [
  ...FACE_AXES_CLEARED_ON_SET_MOOD,
  ...GAZE_AXES,
];

export const GAZE_OFFSET_X = 4;
export const GAZE_OFFSET_Y = 5;

const AXIS_RANGE: Record<ExpressionAxis, readonly [number, number]> = {
  smile: [0, 1],
  frown: [0, 1],
  brows: [-1, 1],
  eyesOpen: [0, 1.3],
  jaw: [0, 1],
  gazeX: [-1, 1],
  gazeY: [-1, 1],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampAxis(key: ExpressionAxis, value: number): number {
  const [min, max] = AXIS_RANGE[key];
  return clamp(value, min, max);
}

export function cloneExpression(
  expression: ExpressionConfig,
): ExpressionConfig {
  return {
    leftEye: {
      ...expression.leftEye,
      pupilOffset: { ...expression.leftEye.pupilOffset },
    },
    rightEye: {
      ...expression.rightEye,
      pupilOffset: { ...expression.rightEye.pupilOffset },
    },
    leftEyebrow: { ...expression.leftEyebrow },
    rightEyebrow: { ...expression.rightEyebrow },
    mouth: { ...expression.mouth },
    cheekPuff: expression.cheekPuff,
    noseScrunch: expression.noseScrunch,
  };
}

export function applyAxes(
  base: ExpressionConfig,
  overlay: Partial<ExpressionAxes>,
): ExpressionConfig {
  const result = cloneExpression(base);
  const smile = overlay.smile;
  const frown = overlay.frown;

  if (smile !== undefined && frown !== undefined) {
    result.mouth.cornerPull = clamp(smile - frown, -1, 1);
  } else if (smile !== undefined) {
    result.mouth.cornerPull = smile;
  } else if (frown !== undefined) {
    result.mouth.cornerPull = -frown;
  }

  if (overlay.brows !== undefined) {
    const brows = overlay.brows;
    result.leftEyebrow = {
      innerY: brows * 10,
      arcY: brows * 12,
      outerY: brows * 8,
      rotation: 0,
    };
    result.rightEyebrow = {
      innerY: brows * 10,
      arcY: brows * 12,
      outerY: brows * 8,
      rotation: 0,
    };
  }

  if (overlay.eyesOpen !== undefined) {
    result.leftEye.openness = overlay.eyesOpen;
    result.rightEye.openness = overlay.eyesOpen;
  }

  if (overlay.jaw !== undefined) {
    const opening = overlay.jaw * 26;
    result.mouth.lowerLipTop = base.mouth.upperLipBottom + 2 + opening;
    result.mouth.lowerLipBottom = Math.max(
      result.mouth.lowerLipTop + 2,
      base.mouth.lowerLipBottom + opening,
    );
  }

  if (overlay.gazeX !== undefined) {
    const x = overlay.gazeX * GAZE_OFFSET_X;
    result.leftEye.pupilOffset.x = x;
    result.rightEye.pupilOffset.x = x;
  }

  if (overlay.gazeY !== undefined) {
    const y = -overlay.gazeY * GAZE_OFFSET_Y;
    result.leftEye.pupilOffset.y = y;
    result.rightEye.pupilOffset.y = y;
  }

  return result;
}
