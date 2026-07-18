import type { FacialMood } from "../types";
import type { CharacterVariant } from "../variants";

/**
 * Point interface for 2D coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Eye state for independent left/right control
 */
export interface EyeState {
  openness: number; // 0 = closed, 1 = fully open
  pupilSize: number; // 0.5 = small, 1 = normal, 1.5 = dilated
  pupilOffset: Point; // For gaze direction
  squint: number; // 0 = none, 1 = full squint (affects lower lid)
}

export interface EyePaths {
  sclera: string;
  clipPath: string;
  upperLid: string;
  lowerLid: string;
  aperture: {
    upperY: number;
    lowerY: number;
    height: number;
  };
}

export interface IrisPosition {
  cx: number;
  cy: number;
  irisR: number;
  pupilR: number;
}

/**
 * Eyebrow control points
 */
export interface EyebrowState {
  innerY: number; // Inner point Y offset
  arcY: number; // Middle arc height
  outerY: number; // Outer point Y offset
  rotation: number; // Overall rotation in radians
}

/**
 * Mouth shape using control points for bezier curves
 */
export interface MouthState {
  // Upper lip
  upperLipTop: number; // Y offset for top of upper lip
  upperLipBottom: number; // Y offset for bottom of upper lip (mouth opening)
  upperLipCurve: number; // Curve intensity for cupid's bow (-1 to 1)
  // Lower lip
  lowerLipTop: number; // Y offset for top of lower lip (mouth opening)
  lowerLipBottom: number; // Y offset for bottom of lower lip
  lowerLipCurve: number; // Curve intensity
  // Width
  width: number; // Mouth width multiplier
  // Corners
  cornerPull: number; // -1 = frown, 0 = neutral, 1 = smile
}

export interface MouthPaths {
  upperLip: string;
  lowerLip: string;
  opening: string;
  openingHeight: number;
  commissureY: number;
}

/**
 * Complete expression configuration using path-based control
 */
export interface ExpressionConfig {
  leftEye: EyeState;
  rightEye: EyeState;
  leftEyebrow: EyebrowState;
  rightEyebrow: EyebrowState;
  mouth: MouthState;
  cheekPuff: number; // 0 = normal, 1 = puffed
  noseScrunch: number; // 0 = normal, 1 = scrunched
}

/**
 * Face dimensions and proportions (based on human facial proportions)
 */
export interface FaceDimensions {
  // Head
  headWidth: number;
  headHeight: number;
  jawWidth: number;
  chinHeight: number;

  // Eyes
  eyeWidth: number;
  eyeHeight: number;
  eyeSpacing: number; // Distance between eyes
  eyeY: number; // Y position from center
  irisRadius: number;
  pupilRadius: number;

  // Eyebrows
  eyebrowWidth: number;
  eyebrowThickness: number;
  eyebrowY: number; // Y offset above eyes

  // Nose
  noseWidth: number;
  noseHeight: number;
  noseY: number;

  // Mouth
  mouthWidth: number;
  mouthY: number;
  lipThickness: number;

  // Ears
  earWidth: number;
  earHeight: number;

  // Neck
  neckWidth: number;
  neckHeight: number;
}

/**
 * Geometry for the ragdoll character using SVG paths
 */
export class RagdollGeometry {
  public currentExpression: ExpressionConfig;
  public readonly variant: CharacterVariant;
  public readonly dimensions: FaceDimensions;

  // Base human-like facial proportions
  private readonly baseDimensions: FaceDimensions = {
    // Head - slightly taller than wide for natural look
    headWidth: 140,
    headHeight: 170,
    jawWidth: 120,
    chinHeight: 40,

    // Eyes - positioned in upper third of face
    eyeWidth: 28,
    eyeHeight: 18,
    eyeSpacing: 64, // Distance between eye centers
    eyeY: -15, // Slightly above center
    irisRadius: 9,
    pupilRadius: 4,

    // Eyebrows
    eyebrowWidth: 34,
    eyebrowThickness: 4,
    eyebrowY: 22, // Above eyes

    // Nose - centered, in middle third
    noseWidth: 20,
    noseHeight: 35,
    noseY: 15,

    // Mouth - lower third of face
    mouthWidth: 40,
    mouthY: 50,
    lipThickness: 8,

    // Ears
    earWidth: 18,
    earHeight: 40,

    // Neck
    neckWidth: 45,
    neckHeight: 55,
  };

  constructor(variant?: CharacterVariant) {
    // Use provided variant or default to human
    this.variant = variant || {
      id: "human",
      name: "Human",
      hairStyle: "default",
      mustacheStyle: "none",
    };

    // Merge variant dimension overrides with base dimensions
    this.dimensions = {
      ...this.baseDimensions,
      ...this.variant.dimensions,
    };

    this.currentExpression = this.createNeutralExpression();
  }

  private createNeutralExpression(): ExpressionConfig {
    return {
      leftEye: {
        openness: 1,
        pupilSize: 1,
        pupilOffset: { x: 0, y: 0 },
        squint: 0,
      },
      rightEye: {
        openness: 1,
        pupilSize: 1,
        pupilOffset: { x: 0, y: 0 },
        squint: 0,
      },
      leftEyebrow: {
        innerY: 0,
        arcY: 0,
        outerY: 0,
        rotation: 0,
      },
      rightEyebrow: {
        innerY: 0,
        arcY: 0,
        outerY: 0,
        rotation: 0,
      },
      mouth: {
        upperLipTop: 0,
        upperLipBottom: 2,
        upperLipCurve: 0.3,
        lowerLipTop: 4,
        lowerLipBottom: 10,
        lowerLipCurve: 0.5,
        width: 1,
        cornerPull: 0,
      },
      cheekPuff: 0,
      noseScrunch: 0,
    };
  }

  public getExpressionForMood(mood: FacialMood): ExpressionConfig {
    const base = this.createNeutralExpression();

    switch (mood) {
      case "smile":
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.9, squint: 0.2 },
          rightEye: { ...base.rightEye, openness: 0.9, squint: 0.2 },
          leftEyebrow: { ...base.leftEyebrow, arcY: 3, outerY: 2 },
          rightEyebrow: { ...base.rightEyebrow, arcY: 3, outerY: 2 },
          mouth: {
            ...base.mouth,
            upperLipTop: -1, // Pull top up for better smile curve
            upperLipBottom: 2, // Keep lips closed/barely open
            lowerLipTop: 4, // Very small gap for natural closed smile
            lowerLipBottom: 10,
            width: 1.15,
            cornerPull: 0.8, // Stronger corner pull for clear smile
          },
          cheekPuff: 0.15,
        };

      case "frown":
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.85 },
          rightEye: { ...base.rightEye, openness: 0.85 },
          leftEyebrow: {
            ...base.leftEyebrow,
            innerY: -4,
            arcY: -2,
            rotation: 0.15,
          },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: -4,
            arcY: -2,
            rotation: -0.15,
          },
          mouth: {
            ...base.mouth,
            upperLipBottom: 1,
            lowerLipTop: 3,
            width: 0.85,
            cornerPull: -0.5,
          },
        };

      case "laugh":
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.5, squint: 0.6 },
          rightEye: { ...base.rightEye, openness: 0.5, squint: 0.6 },
          leftEyebrow: { ...base.leftEyebrow, arcY: 6, outerY: 4 },
          rightEyebrow: { ...base.rightEyebrow, arcY: 6, outerY: 4 },
          mouth: {
            ...base.mouth,
            upperLipTop: 1, // Pull top down slightly to prevent overly thick upper lip
            upperLipBottom: 5, // Reduced from 8 to keep upper lip thinner
            lowerLipTop: 18,
            lowerLipBottom: 22,
            width: 1.3,
            cornerPull: 0.9,
          },
          cheekPuff: 0.3,
        };

      case "angry":
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.7, squint: 0.3 },
          rightEye: { ...base.rightEye, openness: 0.7, squint: 0.3 },
          leftEyebrow: {
            ...base.leftEyebrow,
            innerY: -8,
            arcY: -4,
            outerY: 2,
            rotation: 0.25,
          },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: -8,
            arcY: -4,
            outerY: 2,
            rotation: -0.25,
          },
          mouth: {
            ...base.mouth,
            upperLipBottom: 2,
            lowerLipTop: 5,
            width: 0.9,
            cornerPull: -0.4,
          },
          noseScrunch: 0.4,
        };

      case "sad":
        return {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 0.75,
            pupilOffset: { x: 0, y: 2 },
          },
          rightEye: {
            ...base.rightEye,
            openness: 0.75,
            pupilOffset: { x: 0, y: 2 },
          },
          leftEyebrow: {
            ...base.leftEyebrow,
            innerY: 6,
            arcY: -2,
            outerY: -4,
            rotation: -0.2,
          },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: 6,
            arcY: -2,
            outerY: -4,
            rotation: 0.2,
          },
          mouth: {
            ...base.mouth,
            upperLipBottom: 1,
            lowerLipTop: 2,
            lowerLipBottom: 7,
            width: 0.8,
            cornerPull: -0.6,
          },
        };

      case "surprise":
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 1.3, pupilSize: 1.3 },
          rightEye: { ...base.rightEye, openness: 1.3, pupilSize: 1.3 },
          leftEyebrow: { ...base.leftEyebrow, innerY: 10, arcY: 12, outerY: 8 },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: 10,
            arcY: 12,
            outerY: 8,
          },
          mouth: {
            ...base.mouth,
            upperLipTop: -2,
            upperLipBottom: 6,
            lowerLipTop: 14,
            lowerLipBottom: 20,
            width: 0.9,
            cornerPull: 0,
          },
        };

      case "confusion":
        return {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 0.95,
            pupilOffset: { x: 2, y: -1 },
          },
          rightEye: {
            ...base.rightEye,
            openness: 0.8,
            pupilOffset: { x: -2, y: 1 },
          },
          leftEyebrow: { ...base.leftEyebrow, innerY: 4, arcY: 6, outerY: 2 },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: -2,
            arcY: -1,
            outerY: -3,
            rotation: -0.1,
          },
          mouth: {
            ...base.mouth,
            upperLipBottom: 2,
            lowerLipTop: 4,
            width: 0.85,
            cornerPull: -0.15,
          },
        };

      case "thinking":
        return {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 0.85,
            pupilOffset: { x: 4, y: -3 },
          },
          rightEye: {
            ...base.rightEye,
            openness: 0.85,
            pupilOffset: { x: 4, y: -3 },
          },
          leftEyebrow: { ...base.leftEyebrow, innerY: 2, arcY: 5, outerY: 3 },
          rightEyebrow: {
            ...base.rightEyebrow,
            innerY: -1,
            arcY: 2,
            outerY: 0,
          },
          mouth: {
            ...base.mouth,
            upperLipBottom: 1,
            lowerLipTop: 3,
            width: 0.75,
            cornerPull: 0.1,
          },
        };

      default:
        return base;
    }
  }

  /**
   * Generate SVG path for the face outline
   */
  public getFacePath(): string {
    const d = this.dimensions;
    const hw = d.headWidth / 2;
    const hh = d.headHeight / 2;
    const jw = d.jawWidth / 2;
    const ch = d.chinHeight;

    // Face path with forehead, temples, cheeks, jaw, and chin
    return `
      M 0 ${-hh}
      C ${hw * 0.6} ${-hh} ${hw} ${-hh * 0.7} ${hw} ${-hh * 0.3}
      C ${hw} ${hh * 0.1} ${hw * 0.95} ${hh * 0.4} ${jw} ${hh * 0.5}
      Q ${jw * 0.7} ${hh * 0.75} 0 ${hh * 0.5 + ch}
      Q ${-jw * 0.7} ${hh * 0.75} ${-jw} ${hh * 0.5}
      C ${-hw * 0.95} ${hh * 0.4} ${-hw} ${hh * 0.1} ${-hw} ${-hh * 0.3}
      C ${-hw} ${-hh * 0.7} ${-hw * 0.6} ${-hh} 0 ${-hh}
      Z
    `;
  }

  /**
   * Generate SVG path for an eye shape
   */
  public getEyePath(isLeft: boolean, eyeState: EyeState): EyePaths {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const cx = (sign * d.eyeSpacing) / 2;
    const cy = d.eyeY;
    const w = d.eyeWidth / 2;
    const h = d.eyeHeight / 2;

    const openness = Math.max(0, Math.min(1.3, eyeState.openness));
    const squint = Math.max(0, Math.min(1, eyeState.squint));
    const upperY = cy - h * openness;
    const lowerY = cy + h * openness * (1 - squint * 0.55);
    const apertureHeight = Math.max(0, lowerY - upperY);

    // The visible eye itself follows the lid aperture. This keeps the iris and
    // sclera from leaking through a closed blink or wink.
    const sclera = `
      M ${cx - w} ${cy}
      Q ${cx - w * 0.5} ${upperY} ${cx} ${upperY}
      Q ${cx + w * 0.5} ${upperY} ${cx + w} ${cy}
      Q ${cx + w * 0.5} ${lowerY} ${cx} ${lowerY}
      Q ${cx - w * 0.5} ${lowerY} ${cx - w} ${cy}
      Z
    `;

    const upperCurve = Math.min(2, apertureHeight * 0.15);
    const upperLid = `
      M ${cx - w - 2} ${cy - h - 4}
      L ${cx + w + 2} ${cy - h - 4}
      L ${cx + w + 2} ${cy}
      Q ${cx} ${upperY - upperCurve} ${cx - w - 2} ${cy}
      Z
    `;

    const lowerCurve = Math.min(2, apertureHeight * 0.15);
    const lowerLid = `
      M ${cx - w - 2} ${cy + h + 4}
      L ${cx + w + 2} ${cy + h + 4}
      L ${cx + w + 2} ${cy}
      Q ${cx} ${lowerY + lowerCurve} ${cx - w - 2} ${cy}
      Z
    `;

    return {
      sclera,
      clipPath: sclera,
      upperLid,
      lowerLid,
      aperture: { upperY, lowerY, height: apertureHeight },
    };
  }

  /**
   * Get iris and pupil positions
   */
  public getIrisPosition(isLeft: boolean, eyeState: EyeState): IrisPosition {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const baseCx = (sign * d.eyeSpacing) / 2;
    const baseCy = d.eyeY;

    // Pupil dilation changes the pupil, not the iris. Keep the complete iris
    // inside the horizontal eye bounds while the eye clip handles the lids.
    const irisR = Math.min(d.irisRadius, d.eyeWidth * 0.45, d.eyeHeight * 0.5);
    const pupilR = Math.max(
      irisR * 0.15,
      Math.min(irisR * 0.72, d.pupilRadius * eyeState.pupilSize),
    );
    const maxOffset = Math.max(0, d.eyeWidth / 2 - irisR - 1);
    const offsetX = Math.max(
      -maxOffset,
      Math.min(maxOffset, eyeState.pupilOffset.x),
    );
    const offsetY = Math.max(-5, Math.min(5, eyeState.pupilOffset.y));

    return {
      cx: baseCx + offsetX,
      cy: baseCy + offsetY,
      irisR,
      pupilR,
    };
  }

  /**
   * Generate SVG path for an eyebrow
   */
  public getEyebrowPath(isLeft: boolean, eyebrowState: EyebrowState): string {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const cx = (sign * d.eyeSpacing) / 2;
    const baseY = d.eyeY - d.eyeHeight / 2 - d.eyebrowY;
    const w = d.eyebrowWidth / 2;
    const t = d.eyebrowThickness;

    // Apply state
    const innerY = baseY - eyebrowState.innerY;
    const arcY = baseY - eyebrowState.arcY;
    const outerY = baseY - eyebrowState.outerY;

    // Inner point is closer to center, outer is toward temple
    const innerX = cx - sign * w * 0.3;
    const outerX = cx + sign * w;

    const rotate = (point: Point): Point => {
      const angle = -eyebrowState.rotation;
      const dx = point.x - cx;
      const dy = point.y - baseY;
      return {
        x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: baseY + dx * Math.sin(angle) + dy * Math.cos(angle),
      };
    };
    const innerTop = rotate({ x: innerX, y: innerY });
    const arcTop = rotate({ x: cx, y: arcY - t });
    const outerTop = rotate({ x: outerX, y: outerY });
    const outerBottom = rotate({ x: outerX, y: outerY + t });
    const arcBottom = rotate({ x: cx, y: arcY + t * 0.5 });
    const innerBottom = rotate({ x: innerX, y: innerY + t * 1.2 });

    return `
      M ${innerTop.x} ${innerTop.y}
      Q ${arcTop.x} ${arcTop.y} ${outerTop.x} ${outerTop.y}
      L ${outerBottom.x} ${outerBottom.y}
      Q ${arcBottom.x} ${arcBottom.y} ${innerBottom.x} ${innerBottom.y}
      Z
    `;
  }

  /**
   * Generate SVG path for the mouth/lips
   */
  public getMouthPath(mouthState: MouthState): MouthPaths {
    const d = this.dimensions;
    const cy = d.mouthY;
    const w = (d.mouthWidth / 2) * mouthState.width;

    const pull = mouthState.cornerPull;
    const cornerY = cy - pull * 6; // Corners go up for smile, down for frown

    // Upper lip with cupid's bow
    const upperTop = cy - d.lipThickness + mouthState.upperLipTop;
    const upperBottom = cy + mouthState.upperLipBottom;
    const lowerTop = cy + mouthState.lowerLipTop;
    const lowerBottom = cy + mouthState.lowerLipBottom;
    const values = [
      w,
      upperTop,
      upperBottom,
      lowerTop,
      lowerBottom,
      mouthState.upperLipCurve,
      mouthState.lowerLipCurve,
      pull,
    ];
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error("Mouth geometry contains a non-finite value");
    }
    if (w <= 0 || upperBottom - upperTop < 2 || lowerBottom - lowerTop < 2) {
      throw new Error("Mouth geometry has invalid lip dimensions");
    }
    if (lowerTop < upperBottom) {
      throw new Error("Mouth geometry has intersecting inner lip edges");
    }

    const bowDepth = mouthState.upperLipCurve * 3;
    const lowerCurveDepth = mouthState.lowerLipCurve * 4;
    const openingHeight = lowerTop - upperBottom;
    const innerCurveDepth = Math.min(1.5, openingHeight * 0.35);
    const upperInnerControlY = upperBottom + innerCurveDepth;
    const lowerInnerControlY = lowerTop - innerCurveDepth;
    const commissureY = Math.max(
      upperTop + 1,
      Math.min(lowerBottom - 1, cornerY),
    );

    const upperLip = `
      M ${-w} ${commissureY}
      Q ${-w * 0.5} ${upperTop - 2} ${-w * 0.15} ${upperTop}
      Q 0 ${upperTop + bowDepth} ${w * 0.15} ${upperTop}
      Q ${w * 0.5} ${upperTop - 2} ${w} ${commissureY}
      L ${w * 0.82} ${commissureY}
      Q ${w * 0.4} ${upperBottom} 0 ${upperInnerControlY}
      Q ${-w * 0.4} ${upperBottom} ${-w * 0.82} ${commissureY}
      Z
    `;

    const lowerLip = `
      M ${-w * 0.82} ${commissureY}
      Q ${-w * 0.4} ${lowerTop} 0 ${lowerInnerControlY}
      Q ${w * 0.4} ${lowerTop} ${w * 0.82} ${commissureY}
      L ${w} ${commissureY}
      Q ${w * 0.5} ${lowerBottom + lowerCurveDepth} 0 ${lowerBottom}
      Q ${-w * 0.5} ${lowerBottom + lowerCurveDepth} ${-w} ${commissureY}
      Z
    `;

    const opening =
      openingHeight > 1
        ? `
      M ${-w * 0.82} ${commissureY}
      Q ${-w * 0.4} ${upperBottom} 0 ${upperInnerControlY}
      Q ${w * 0.4} ${upperBottom} ${w * 0.82} ${commissureY}
      Q ${w * 0.4} ${lowerTop} 0 ${lowerInnerControlY}
      Q ${-w * 0.4} ${lowerTop} ${-w * 0.82} ${commissureY}
      Z
    `
        : "";

    return { upperLip, lowerLip, opening, openingHeight, commissureY };
  }

  /**
   * Generate SVG path for the nose
   */
  public getNosePath(scrunch: number = 0): string {
    const d = this.dimensions;
    const cy = d.noseY;
    const w = d.noseWidth / 2;
    const h = d.noseHeight;

    // Scrunch affects nose width at bridge
    const bridgeW = w * 0.3 * (1 - scrunch * 0.3);

    return `
      M ${-bridgeW} ${cy - h * 0.4}
      L ${-bridgeW * 0.8} ${cy + h * 0.2}
      Q ${-w} ${cy + h * 0.4} ${-w * 0.8} ${cy + h * 0.5}
      Q ${-w * 0.3} ${cy + h * 0.55} 0 ${cy + h * 0.45}
      Q ${w * 0.3} ${cy + h * 0.55} ${w * 0.8} ${cy + h * 0.5}
      Q ${w} ${cy + h * 0.4} ${bridgeW * 0.8} ${cy + h * 0.2}
      L ${bridgeW} ${cy - h * 0.4}
    `;
  }

  /**
   * Generate SVG path for an ear
   */
  public getEarPath(isLeft: boolean): string {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const x = sign * (d.headWidth / 2 - 5);
    const y = d.eyeY + 10;
    const w = d.earWidth;
    const h = d.earHeight;

    return `
      M ${x} ${y - h * 0.4}
      Q ${x + sign * w * 0.8} ${y - h * 0.3} ${x + sign * w} ${y}
      Q ${x + sign * w * 1.1} ${y + h * 0.3} ${x + sign * w * 0.7} ${y + h * 0.5}
      Q ${x + sign * w * 0.3} ${y + h * 0.4} ${x} ${y + h * 0.3}
    `;
  }

  /**
   * Generate hair path based on variant hair style
   */
  public getHairPath(): string {
    const d = this.dimensions;
    const hw = d.headWidth / 2;
    const hh = d.headHeight / 2;
    const hairStyle = this.variant.hairStyle || "default";

    if (hairStyle === "wild") {
      // Wild Einstein-style hair - bushy and extends outward
      return `
        M ${-hw * 0.85} ${-hh * 0.4}
        Q ${-hw * 1.1} ${-hh * 0.95} ${-hw * 0.7} ${-hh * 1.2}
        Q ${-hw * 0.4} ${-hh * 1.25} 0 ${-hh * 1.15}
        Q ${hw * 0.4} ${-hh * 1.25} ${hw * 0.7} ${-hh * 1.2}
        Q ${hw * 1.1} ${-hh * 0.95} ${hw * 0.85} ${-hh * 0.4}
        Q ${hw * 0.7} ${-hh * 0.6} ${hw * 0.4} ${-hh * 0.55}
        Q 0 ${-hh * 0.5} ${-hw * 0.4} ${-hh * 0.55}
        Q ${-hw * 0.7} ${-hh * 0.6} ${-hw * 0.85} ${-hh * 0.4}
        Z
      `;
    }

    if (hairStyle === "short") {
      // Short cropped hair - stays close to head
      return `
        M ${-hw * 0.85} ${-hh * 0.4}
        Q ${-hw * 0.88} ${-hh * 0.85} ${-hw * 0.5} ${-hh * 0.95}
        Q 0 ${-hh * 1.0} ${hw * 0.5} ${-hh * 0.95}
        Q ${hw * 0.88} ${-hh * 0.85} ${hw * 0.85} ${-hh * 0.4}
        Q ${hw * 0.7} ${-hh * 0.55} ${hw * 0.4} ${-hh * 0.5}
        Q 0 ${-hh * 0.45} ${-hw * 0.4} ${-hh * 0.5}
        Q ${-hw * 0.7} ${-hh * 0.55} ${-hw * 0.85} ${-hh * 0.4}
        Z
      `;
    }

    if (hairStyle === "bald") {
      // No hair - empty path
      return "";
    }

    // Default hair style
    return `
      M ${-hw * 0.85} ${-hh * 0.4}
      Q ${-hw * 0.9} ${-hh * 0.9} ${-hw * 0.5} ${-hh * 1.05}
      Q 0 ${-hh * 1.15} ${hw * 0.5} ${-hh * 1.05}
      Q ${hw * 0.9} ${-hh * 0.9} ${hw * 0.85} ${-hh * 0.4}
      Q ${hw * 0.7} ${-hh * 0.6} ${hw * 0.4} ${-hh * 0.55}
      Q 0 ${-hh * 0.5} ${-hw * 0.4} ${-hh * 0.55}
      Q ${-hw * 0.7} ${-hh * 0.6} ${-hw * 0.85} ${-hh * 0.4}
      Z
    `;
  }

  /**
   * Generate mustache path based on variant mustache style
   */
  public getMustachePath(): string {
    const mustacheStyle = this.variant.mustacheStyle || "none";

    if (mustacheStyle === "none") {
      return "";
    }

    const d = this.dimensions;
    const w = d.mouthWidth * 0.7;
    const y = d.mouthY - 8; // Just above upper lip

    if (mustacheStyle === "bushy") {
      // Bushy Einstein-style mustache
      return `
        M ${-w} ${y + 2}
        Q ${-w * 0.5} ${y - 3} 0 ${y - 2}
        Q ${w * 0.5} ${y - 3} ${w} ${y + 2}
        Q ${w * 0.7} ${y + 6} ${w * 0.3} ${y + 5}
        Q 0 ${y + 6} ${-w * 0.3} ${y + 5}
        Q ${-w * 0.7} ${y + 6} ${-w} ${y + 2}
        Z
      `;
    }

    if (mustacheStyle === "thin") {
      // Thin pencil mustache
      return `
        M ${-w * 0.6} ${y + 1}
        Q ${-w * 0.3} ${y} 0 ${y}
        Q ${w * 0.3} ${y} ${w * 0.6} ${y + 1}
        L ${w * 0.6} ${y + 2}
        Q ${w * 0.3} ${y + 1} 0 ${y + 1}
        Q ${-w * 0.3} ${y + 1} ${-w * 0.6} ${y + 2}
        Z
      `;
    }

    if (mustacheStyle === "handlebar") {
      // Handlebar mustache with curled ends
      return `
        M ${-w} ${y - 2}
        Q ${-w * 0.9} ${y - 5} ${-w * 0.7} ${y - 3}
        Q ${-w * 0.4} ${y + 1} 0 ${y}
        Q ${w * 0.4} ${y + 1} ${w * 0.7} ${y - 3}
        Q ${w * 0.9} ${y - 5} ${w} ${y - 2}
        Q ${w * 0.85} ${y + 2} ${w * 0.6} ${y + 3}
        Q ${w * 0.3} ${y + 4} 0 ${y + 3}
        Q ${-w * 0.3} ${y + 4} ${-w * 0.6} ${y + 3}
        Q ${-w * 0.85} ${y + 2} ${-w} ${y - 2}
        Z
      `;
    }

    return "";
  }

  public setExpression(expression: ExpressionConfig): void {
    this.currentExpression = expression;
  }

  /**
   * Interpolate between two expressions
   */
  public static interpolateExpression(
    from: ExpressionConfig,
    to: ExpressionConfig,
    t: number,
  ): ExpressionConfig {
    const lerp = (a: number, b: number): number => a + (b - a) * t;
    const lerpPoint = (a: Point, b: Point): Point => ({
      x: lerp(a.x, b.x),
      y: lerp(a.y, b.y),
    });

    const lerpEye = (a: EyeState, b: EyeState): EyeState => ({
      openness: lerp(a.openness, b.openness),
      pupilSize: lerp(a.pupilSize, b.pupilSize),
      pupilOffset: lerpPoint(a.pupilOffset, b.pupilOffset),
      squint: lerp(a.squint, b.squint),
    });

    const lerpEyebrow = (a: EyebrowState, b: EyebrowState): EyebrowState => ({
      innerY: lerp(a.innerY, b.innerY),
      arcY: lerp(a.arcY, b.arcY),
      outerY: lerp(a.outerY, b.outerY),
      rotation: lerp(a.rotation, b.rotation),
    });

    const lerpMouth = (a: MouthState, b: MouthState): MouthState => ({
      upperLipTop: lerp(a.upperLipTop, b.upperLipTop),
      upperLipBottom: lerp(a.upperLipBottom, b.upperLipBottom),
      upperLipCurve: lerp(a.upperLipCurve, b.upperLipCurve),
      lowerLipTop: lerp(a.lowerLipTop, b.lowerLipTop),
      lowerLipBottom: lerp(a.lowerLipBottom, b.lowerLipBottom),
      lowerLipCurve: lerp(a.lowerLipCurve, b.lowerLipCurve),
      width: lerp(a.width, b.width),
      cornerPull: lerp(a.cornerPull, b.cornerPull),
    });

    return {
      leftEye: lerpEye(from.leftEye, to.leftEye),
      rightEye: lerpEye(from.rightEye, to.rightEye),
      leftEyebrow: lerpEyebrow(from.leftEyebrow, to.leftEyebrow),
      rightEyebrow: lerpEyebrow(from.rightEyebrow, to.rightEyebrow),
      mouth: lerpMouth(from.mouth, to.mouth),
      cheekPuff: lerp(from.cheekPuff, to.cheekPuff),
      noseScrunch: lerp(from.noseScrunch, to.noseScrunch),
    };
  }
}
