import type { CharacterController } from "../controllers/character-controller";
import type {
  ExpressionConfig,
  FaceDimensions,
} from "../models/ragdoll-geometry";
import type { CharacterAppearance } from "../variants/types";
import type { RagdollTheme } from "../themes/types";

export function applyIdleToExpression(
  expr: ExpressionConfig,
  blinkAmount: number,
  pupilOffsetX: number,
  pupilOffsetY: number,
): ExpressionConfig {
  const blink = Math.max(0, Math.min(1, blinkAmount));
  return {
    ...expr,
    leftEye: {
      ...expr.leftEye,
      openness: expr.leftEye.openness * (1 - blink),
      pupilOffset: {
        x: expr.leftEye.pupilOffset.x + pupilOffsetX,
        y: expr.leftEye.pupilOffset.y + pupilOffsetY,
      },
    },
    rightEye: {
      ...expr.rightEye,
      openness: expr.rightEye.openness * (1 - blink),
      pupilOffset: {
        x: expr.rightEye.pupilOffset.x + pupilOffsetX,
        y: expr.rightEye.pupilOffset.y + pupilOffsetY,
      },
    },
  };
}

export interface RenderData {
  appearance: CharacterAppearance;
  dims: FaceDimensions;
  expression: ExpressionConfig;
  yaw: number;
  pitch: number;
  headRoll: number;
  currentTheme: RagdollTheme;
  breathingOffsetY: number;
  breathingScale: number;
}

export function computeRenderData(controller: CharacterController): RenderData {
  const geometry = controller.getGeometry();
  const dims = geometry.dimensions;
  const state = controller.getState();
  const idleState = controller.getIdleState();

  const expression = applyIdleToExpression(
    controller.getExpressionWithAction(),
    idleState.blinkAmount,
    idleState.pupilOffsetX,
    idleState.pupilOffsetY,
  );

  const moodHead = controller.getMoodHeadOffset();
  const yaw =
    state.headPose.yaw + moodHead.yaw + (idleState.headMicroX * Math.PI) / 180;
  const pitch =
    state.headPose.pitch +
    moodHead.pitch +
    (idleState.headMicroY * Math.PI) / 180;
  const breathingOffsetY = -idleState.breathAmount * dims.headHeight * 0.25;
  const breathingScale = 1 + idleState.breathAmount * 0.4;
  const headRoll =
    moodHead.roll + (idleState.headMicroX * 0.35 * Math.PI) / 180;

  return {
    dims,
    appearance: {
      hairStyle: geometry.variant.hairStyle ?? "default",
      mustacheStyle: geometry.variant.mustacheStyle ?? "none",
      age: geometry.variant.ageModifier ?? 0.5,
    },
    expression,
    yaw,
    pitch,
    headRoll,
    currentTheme: controller.getTheme(),
    breathingOffsetY,
    breathingScale,
  };
}
