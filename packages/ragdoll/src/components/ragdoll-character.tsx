import React, { useEffect, useRef, useState } from "react";
import { CharacterController } from "../controllers/character-controller";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import type { RagdollTheme } from "../themes/types";
import type { GradientDef } from "../themes/types";

interface RagdollCharacterProps {
  onControllerReady?: (controller: CharacterController) => void;
  theme?: RagdollTheme;
  destroyOnUnmount?: boolean;
}

/**
 * Render SVG gradients from theme
 * Note: We include theme.id in gradient IDs to force re-render when theme changes
 */
function renderGradients(theme: RagdollTheme): React.JSX.Element {
  const prefix = theme.id;

  const renderGradient = (
    id: string,
    gradient: GradientDef,
  ): React.JSX.Element => {
    const fullId = `${prefix}-${id}`;
    if (gradient.type === "linear") {
      return (
        <linearGradient
          key={fullId}
          id={fullId}
          x1={gradient.x1}
          y1={gradient.y1}
          x2={gradient.x2}
          y2={gradient.y2}
        >
          {gradient.stops.map((stop, idx) => (
            <stop key={idx} offset={stop.offset} stopColor={stop.stopColor} />
          ))}
        </linearGradient>
      );
    } else {
      return (
        <radialGradient
          key={fullId}
          id={fullId}
          cx={gradient.cx}
          cy={gradient.cy}
          r={gradient.r}
        >
          {gradient.stops.map((stop, idx) => (
            <stop key={idx} offset={stop.offset} stopColor={stop.stopColor} />
          ))}
        </radialGradient>
      );
    }
  };

  return (
    <defs>
      {renderGradient("skinGradient", theme.gradients.skinGradient)}
      {renderGradient("skinRadial", theme.gradients.skinRadial)}
      {renderGradient("hairGradient", theme.gradients.hairGradient)}
      {renderGradient("upperLipGradient", theme.gradients.upperLipGradient)}
      {renderGradient("lowerLipGradient", theme.gradients.lowerLipGradient)}
      {renderGradient("irisGradient", theme.gradients.irisGradient)}
      {renderGradient("blushGradient", theme.gradients.blushGradient)}
      {renderGradient("lidGradient", theme.gradients.lidGradient)}
      {renderGradient("faceShadowLeft", theme.gradients.faceShadowLeft)}
      {renderGradient("faceShadowRight", theme.gradients.faceShadowRight)}
    </defs>
  );
}

/**
 * Calculate 2D head rotation transforms
 * Simulates 3D rotation by moving facial features within the face
 */
function calculateHeadTransforms(yawRad: number, pitchRad: number) {
  const maxYaw = (35 * Math.PI) / 180;
  const maxPitch = (20 * Math.PI) / 180;

  // Normalize to -1 to 1 range
  const yaw = Math.max(-1, Math.min(1, yawRad / maxYaw));
  const pitch = Math.max(-1, Math.min(1, pitchRad / maxPitch));

  return {
    // Feature horizontal shift - features move opposite to head turn direction
    // When looking right (positive yaw), features shift left on the face
    featureShiftX: -yaw * 12,

    // Feature vertical shift - when looking up, features move down on face
    featureShiftY: pitch * 8,

    // Nose shifts more (it's more prominent)
    noseShiftX: -yaw * 8,
    noseShiftY: pitch * 5,

    // Eyes shift slightly differently to add depth
    leftEyeShiftX: -yaw * 10 - yaw * 3, // Far eye shifts more when turning
    rightEyeShiftX: -yaw * 10 + yaw * 3, // Near eye shifts less
    eyeShiftY: pitch * 6,

    // Mouth shifts
    mouthShiftX: -yaw * 10,
    mouthShiftY: pitch * 10,

    // Ear visibility (opacity and scale)
    // When turning right, left ear becomes more visible, right ear less
    leftEarOpacity: Math.max(0.3, Math.min(1, 1 + yaw * 0.7)),
    rightEarOpacity: Math.max(0.3, Math.min(1, 1 - yaw * 0.7)),
    leftEarScale: 1 + yaw * 0.15,
    rightEarScale: 1 - yaw * 0.15,

    // Slight face shadow on the far side
    shadowSide: yaw > 0 ? "left" : "right",
    shadowIntensity: Math.abs(yaw) * 0.15,

    // Hair shifts slightly
    hairShiftX: -yaw * 5,

    // Eyebrow shifts
    eyebrowShiftX: -yaw * 8,
    eyebrowShiftY: pitch * 4,

    // Raw values for other uses
    yaw,
    pitch,
  };
}

// Render data structure to avoid accessing refs during render
interface RenderData {
  dims: ReturnType<CharacterController["getGeometry"]>["dimensions"];
  expression: ExpressionConfig;
  ht: ReturnType<typeof calculateHeadTransforms>;
  facePath: string;
  hairPath: string;
  nosePath: string;
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
  mouthPaths: ReturnType<
    ReturnType<CharacterController["getGeometry"]>["getMouthPath"]
  >;
  currentTheme: RagdollTheme;
  breathingOffsetY: number;
  breathingScale: number;
  headRollDeg: number;
}

function computeRenderData(
  controller: CharacterController,
  theme?: RagdollTheme,
): RenderData {
  const geometry = controller.getGeometry();
  const dims = geometry.dimensions;
  const state = controller.getState();
  const headPose = state.headPose;
  const idleState = controller.getIdleState();

  // Get expression with action overlay and idle blink
  const baseExpression = controller.getExpressionWithAction();
  const expression = applyIdleToExpression(
    baseExpression,
    idleState.blinkAmount,
    idleState.pupilOffsetX,
    idleState.pupilOffsetY,
  );

  // Calculate head transforms with idle micro-movements
  const yawWithIdle = headPose.yaw + (idleState.headMicroX * Math.PI) / 180;
  const pitchWithIdle = headPose.pitch + (idleState.headMicroY * Math.PI) / 180;
  const ht = calculateHeadTransforms(yawWithIdle, pitchWithIdle);
  const breathingOffsetY = -idleState.breathAmount * dims.headHeight * 0.8;
  const breathingScale = 1 + idleState.breathAmount * 2.5;
  const headRollDeg = ht.yaw * 4 + ht.pitch * -3;

  return {
    dims,
    expression,
    ht,
    facePath: geometry.getFacePath(),
    hairPath: geometry.getHairPath(),
    nosePath: geometry.getNosePath(expression.noseScrunch),
    leftEarPath: geometry.getEarPath(true),
    rightEarPath: geometry.getEarPath(false),
    leftEyePaths: geometry.getEyePath(true, expression.leftEye),
    rightEyePaths: geometry.getEyePath(false, expression.rightEye),
    leftIris: geometry.getIrisPosition(true, expression.leftEye),
    rightIris: geometry.getIrisPosition(false, expression.rightEye),
    leftEyebrowPath: geometry.getEyebrowPath(true, expression.leftEyebrow),
    rightEyebrowPath: geometry.getEyebrowPath(false, expression.rightEyebrow),
    mouthPaths: geometry.getMouthPath(expression.mouth),
    currentTheme: theme || controller.getTheme(),
    breathingOffsetY,
    breathingScale,
    headRollDeg,
  };
}

export function RagdollCharacter({
  onControllerReady,
  theme,
  destroyOnUnmount = true,
}: RagdollCharacterProps) {
  // Create controller once and store in state (not ref) so it's safe to read during render
  const [controller] = useState(() => new CharacterController(theme?.id));
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Store all render data in state to avoid accessing refs during render
  const [renderData, setRenderData] = useState<RenderData>(() =>
    computeRenderData(controller, theme),
  );

  // Update theme if it changes
  useEffect(() => {
    if (theme) {
      controller.setTheme(theme.id);
    }
  }, [theme, controller]);

  useEffect(() => {
    if (onControllerReady) {
      onControllerReady(controller);
    }
  }, [onControllerReady, controller]);

  // Update animations at 60fps
  useEffect(() => {
    let isMounted = true;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      if (!isMounted || lastTimeRef.current === null) return;

      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      controller.update(deltaTime);
      setRenderData(computeRenderData(controller, theme));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [controller, theme]);

  // Cleanup owned controller when unmounting
  useEffect(
    () => () => {
      if (destroyOnUnmount) {
        controller.destroy();
      }
    },
    [controller, destroyOnUnmount],
  );

  // Extract render data from state
  const {
    dims,
    expression,
    ht,
    facePath,
    hairPath,
    nosePath,
    leftEarPath,
    rightEarPath,
    leftEyePaths,
    rightEyePaths,
    leftIris,
    rightIris,
    leftEyebrowPath,
    rightEyebrowPath,
    mouthPaths,
    currentTheme,
    breathingOffsetY,
    breathingScale,
    headRollDeg,
  } = renderData;

  // Helper to generate gradient URL with theme prefix
  const g = (name: string) => `url(#${currentTheme.id}-${name})`;
  const rootTransform = `translate(0 ${breathingOffsetY}) scale(${breathingScale}) rotate(${headRollDeg})`;

  return (
    <svg
      width="320"
      height="380"
      viewBox="-160 -190 320 380"
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "320px",
        maxHeight: "380px",
      }}
    >
      {renderGradients(currentTheme)}

      <g transform={rootTransform}>
        {/* Left Ear (behind face) - visibility changes with yaw */}
        <g
          transform={`translate(${ht.yaw * 5}, 0) scale(${ht.leftEarScale}, 1)`}
          opacity={ht.leftEarOpacity}
        >
          <path d={leftEarPath} fill={g("skinGradient")} />
        </g>

        {/* Right Ear (behind face) */}
        <g
          transform={`translate(${-ht.yaw * 5}, 0) scale(${ht.rightEarScale}, 1)`}
          opacity={ht.rightEarOpacity}
        >
          <path d={rightEarPath} fill={g("skinGradient")} />
        </g>

        {/* Face shape - stays relatively stationary */}
        <path
          d={facePath}
          fill={g("skinRadial")}
          stroke={currentTheme.colors.stroke}
          strokeWidth={0.5}
        />

        {/* Dynamic face shadow based on rotation */}
        {ht.shadowIntensity > 0.02 && (
          <ellipse
            cx={
              ht.shadowSide === "left"
                ? -dims.headWidth / 3
                : dims.headWidth / 3
            }
            cy={0}
            rx={30}
            ry={dims.headHeight / 2 - 15}
            fill={
              ht.shadowSide === "left"
                ? g("faceShadowLeft")
                : g("faceShadowRight")
            }
            opacity={ht.shadowIntensity}
          />
        )}

        {/* Cheek blush - shifts with face */}
        <g transform={`translate(${ht.featureShiftX}, ${ht.featureShiftY})`}>
          <ellipse
            cx={-dims.headWidth / 4}
            cy={dims.eyeY + 25}
            rx={18}
            ry={12}
            fill={g("blushGradient")}
            opacity={0.5 + expression.cheekPuff * 0.5}
          />
          <ellipse
            cx={dims.headWidth / 4}
            cy={dims.eyeY + 25}
            rx={18}
            ry={12}
            fill={g("blushGradient")}
            opacity={0.5 + expression.cheekPuff * 0.5}
          />
        </g>

        {/* Left eye - shifts based on head rotation */}
        <g transform={`translate(${ht.leftEyeShiftX}, ${ht.eyeShiftY})`}>
          {/* Sclera (white) */}
          <path d={leftEyePaths.sclera} fill={currentTheme.colors.eyes.white} />

          {/* Iris */}
          <circle
            cx={leftIris.cx}
            cy={leftIris.cy}
            r={leftIris.irisR}
            fill={g("irisGradient")}
          />

          {/* Pupil */}
          <circle
            cx={leftIris.cx}
            cy={leftIris.cy}
            r={leftIris.pupilR}
            fill={currentTheme.colors.eyes.pupil}
          />

          {/* Eye highlight */}
          <circle
            cx={leftIris.cx - 2}
            cy={leftIris.cy - 2}
            r={leftIris.pupilR * 0.6}
            fill="rgba(255,255,255,0.8)"
          />
          <circle
            cx={leftIris.cx + 3}
            cy={leftIris.cy + 1}
            r={leftIris.pupilR * 0.3}
            fill="rgba(255,255,255,0.4)"
          />

          {/* Upper eyelid */}
          <path d={leftEyePaths.upperLid} fill={g("lidGradient")} />

          {/* Lower eyelid */}
          <path d={leftEyePaths.lowerLid} fill={g("lidGradient")} />

          {/* Eyelid crease */}
          <path
            d={`M ${dims.eyeSpacing / 2 - dims.eyeWidth / 2 - 2} ${dims.eyeY - dims.eyeHeight / 2 - 6}
              Q ${dims.eyeSpacing / 2} ${dims.eyeY - dims.eyeHeight / 2 - 8}
              ${dims.eyeSpacing / 2 + dims.eyeWidth / 2 + 2} ${dims.eyeY - dims.eyeHeight / 2 - 5}`}
            fill="none"
            stroke={currentTheme.colors.shadow.color}
            strokeWidth={1}
          />
        </g>

        {/* Right eye */}
        <g transform={`translate(${ht.rightEyeShiftX}, ${ht.eyeShiftY})`}>
          {/* Sclera */}
          <path
            d={rightEyePaths.sclera}
            fill={currentTheme.colors.eyes.white}
          />

          {/* Iris */}
          <circle
            cx={rightIris.cx}
            cy={rightIris.cy}
            r={rightIris.irisR}
            fill={g("irisGradient")}
          />

          {/* Pupil */}
          <circle
            cx={rightIris.cx}
            cy={rightIris.cy}
            r={rightIris.pupilR}
            fill={currentTheme.colors.eyes.pupil}
          />

          {/* Eye highlight */}
          <circle
            cx={rightIris.cx - 2}
            cy={rightIris.cy - 2}
            r={rightIris.pupilR * 0.6}
            fill="rgba(255,255,255,0.8)"
          />
          <circle
            cx={rightIris.cx + 3}
            cy={rightIris.cy + 1}
            r={rightIris.pupilR * 0.3}
            fill="rgba(255,255,255,0.4)"
          />

          {/* Upper eyelid */}
          <path d={rightEyePaths.upperLid} fill={g("lidGradient")} />

          {/* Lower eyelid */}
          <path d={rightEyePaths.lowerLid} fill={g("lidGradient")} />

          {/* Eyelid crease */}
          <path
            d={`M ${-dims.eyeSpacing / 2 - dims.eyeWidth / 2 - 2} ${dims.eyeY - dims.eyeHeight / 2 - 5}
              Q ${-dims.eyeSpacing / 2} ${dims.eyeY - dims.eyeHeight / 2 - 8}
              ${-dims.eyeSpacing / 2 + dims.eyeWidth / 2 + 2} ${dims.eyeY - dims.eyeHeight / 2 - 6}`}
            fill="none"
            stroke={currentTheme.colors.shadow.color}
            strokeWidth={1}
          />
        </g>

        {/* Eyebrows - shift with head rotation */}
        <g transform={`translate(${ht.eyebrowShiftX}, ${ht.eyebrowShiftY})`}>
          <path d={leftEyebrowPath} fill={currentTheme.colors.hair.mid} />
          <path d={rightEyebrowPath} fill={currentTheme.colors.hair.mid} />
        </g>

        {/* Nose - shifts more prominently */}
        <g transform={`translate(${ht.noseShiftX}, ${ht.noseShiftY})`}>
          <path
            d={nosePath}
            fill="none"
            stroke={currentTheme.colors.shadow.color.replace("0.3", "0.5")}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Nose tip highlight */}
          <ellipse
            cx={0}
            cy={dims.noseY + dims.noseHeight * 0.3}
            rx={4}
            ry={3}
            fill="rgba(255,240,230,0.4)"
          />
        </g>

        {/* Mouth - shifts with face */}
        <g transform={`translate(${ht.mouthShiftX}, ${ht.mouthShiftY})`}>
          {/* Mouth opening (dark) */}
          {mouthPaths.opening && (
            <path
              d={mouthPaths.opening}
              fill={currentTheme.colors.shadow.color.replace("0.3", "0.8")}
            />
          )}

          {/* Teeth hint when mouth is open */}
          {expression.mouth.lowerLipTop - expression.mouth.upperLipBottom >
            6 && (
            <rect
              x={-dims.mouthWidth * expression.mouth.width * 0.3}
              y={dims.mouthY + expression.mouth.upperLipBottom + 2}
              width={dims.mouthWidth * expression.mouth.width * 0.6}
              height={Math.min(
                8,
                (expression.mouth.lowerLipTop -
                  expression.mouth.upperLipBottom) *
                  0.6,
              )}
              fill="#f8f8f0"
              rx={2}
            />
          )}

          {/* Upper lip */}
          <path d={mouthPaths.upperLip} fill={g("upperLipGradient")} />

          {/* Lower lip */}
          <path d={mouthPaths.lowerLip} fill={g("lowerLipGradient")} />

          {/* Lip highlight */}
          <ellipse
            cx={0}
            cy={dims.mouthY + expression.mouth.lowerLipBottom - 4}
            rx={dims.mouthWidth * expression.mouth.width * 0.25}
            ry={2}
            fill="rgba(255,255,255,0.25)"
          />
        </g>

        {/* Hair (on top) - slight shift */}
        <g transform={`translate(${ht.hairShiftX}, 0)`}>
          <path d={hairPath} fill={g("hairGradient")} />

          {/* Hair highlight */}
          <ellipse
            cx={-20}
            cy={-dims.headHeight / 2 - 5}
            rx={25}
            ry={10}
            fill="rgba(100,70,50,0.3)"
          />
        </g>
      </g>
    </svg>
  );
}

/**
 * Apply idle animation state to expression
 */
function applyIdleToExpression(
  expr: ExpressionConfig,
  blinkAmount: number,
  pupilOffsetX: number,
  pupilOffsetY: number,
): ExpressionConfig {
  return {
    ...expr,
    leftEye: {
      ...expr.leftEye,
      openness: expr.leftEye.openness * (1 - blinkAmount * 0.95),
      pupilOffset: {
        x: expr.leftEye.pupilOffset.x + pupilOffsetX,
        y: expr.leftEye.pupilOffset.y + pupilOffsetY,
      },
    },
    rightEye: {
      ...expr.rightEye,
      openness: expr.rightEye.openness * (1 - blinkAmount * 0.95),
      pupilOffset: {
        x: expr.rightEye.pupilOffset.x + pupilOffsetX,
        y: expr.rightEye.pupilOffset.y + pupilOffsetY,
      },
    },
  };
}
