import type { CharacterController } from "../controllers/character-controller";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
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

function creasePath(
  centerX: number,
  eyeY: number,
  eyeWidth: number,
  eyeHeight: number,
  leftLift: number,
  rightLift: number,
): string {
  const half = eyeWidth / 2;
  const baseY = eyeY - eyeHeight / 2;
  return `M ${centerX - half - 2} ${baseY - leftLift}
    Q ${centerX} ${baseY - 8}
    ${centerX + half + 2} ${baseY - rightLift}`;
}

export interface RenderData {
  appearance: CharacterAppearance;
  dims: ReturnType<CharacterController["getGeometry"]>["dimensions"];
  expression: ExpressionConfig;
  yaw: number;
  pitch: number;
  headRoll: number;
  facePath: string;
  hairPath: string;
  nosePath: string;
  mustachePath: string;
  leftEarPath: string;
  rightEarPath: string;
  leftEyePaths: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getEyePath"]
  >;
  rightEyePaths: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getEyePath"]
  >;
  leftIris: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getIrisPosition"]
  >;
  rightIris: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getIrisPosition"]
  >;
  leftEyebrowPath: string;
  rightEyebrowPath: string;
  leftCreasePath: string;
  rightCreasePath: string;
  mouthPaths: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getMouthPath"]
  >;
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

  const yaw = state.headPose.yaw + (idleState.headMicroX * Math.PI) / 180;
  const pitch = state.headPose.pitch + (idleState.headMicroY * Math.PI) / 180;
  const breathingOffsetY = -idleState.breathAmount * dims.headHeight * 0.25;
  const breathingScale = 1 + idleState.breathAmount * 0.4;
  const headRoll = (idleState.headMicroX * 0.35 * Math.PI) / 180;

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
    facePath: geometry.getFacePath(),
    hairPath: geometry.getHairPath(),
    nosePath: geometry.getNosePath(expression.noseScrunch),
    mustachePath: geometry.getMustachePath(),
    leftEarPath: geometry.getEarPath(true),
    rightEarPath: geometry.getEarPath(false),
    leftEyePaths: geometry.getEyePath(true, expression.leftEye),
    rightEyePaths: geometry.getEyePath(false, expression.rightEye),
    leftIris: geometry.getIrisPosition(true, expression.leftEye),
    rightIris: geometry.getIrisPosition(false, expression.rightEye),
    leftEyebrowPath: geometry.getEyebrowPath(true, expression.leftEyebrow),
    rightEyebrowPath: geometry.getEyebrowPath(false, expression.rightEyebrow),
    leftCreasePath: creasePath(
      dims.eyeSpacing / 2,
      dims.eyeY,
      dims.eyeWidth,
      dims.eyeHeight,
      6,
      5,
    ),
    rightCreasePath: creasePath(
      -dims.eyeSpacing / 2,
      dims.eyeY,
      dims.eyeWidth,
      dims.eyeHeight,
      5,
      6,
    ),
    mouthPaths: geometry.getMouthPath(expression.mouth),
    currentTheme: controller.getTheme(),
    breathingOffsetY,
    breathingScale,
  };
}
