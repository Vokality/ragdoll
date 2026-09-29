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
  // Sideways shift
  skew: number; // -1 = toward the character's right, 0 = centered, 1 = left
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
 * A small head movement added on top of the commanded head pose, in radians.
 * Positive yaw turns toward +X like a positive gaze x, negative pitch lifts
 * the chin, and positive roll tips the crown toward +X.
 */
export interface HeadOffset {
  yaw: number;
  pitch: number;
  roll: number;
}

export const NO_HEAD_OFFSET: Readonly<HeadOffset> = {
  yaw: 0,
  pitch: 0,
  roll: 0,
};

/** One held pose of a mood that moves, such as thinking. */
export interface MoodPose {
  expression: ExpressionConfig;
  /** Where the head drifts while the pose is held. */
  head: HeadOffset;
  /** Seconds to hold the pose once the face has reached it. */
  hold: number;
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
 * Geometry for the ragdoll character using outline paths
 */
export class RagdollGeometry {
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

  constructor(variant: CharacterVariant) {
    this.variant = variant;

    // Merge variant dimension overrides with base dimensions
    this.dimensions = {
      ...this.baseDimensions,
      ...this.variant.dimensions,
    };
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
        skew: 0,
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
        return this.getThinkingPoses()[0].expression;

      default:
        return base;
    }
  }

  /**
   * Poses a mood moves through while it is held, or null for a static mood.
   * The first pose is the one `getExpressionForMood` returns.
   */
  public getMoodSequence(mood: FacialMood): readonly MoodPose[] | null {
    return mood === "thinking" ? this.getThinkingPoses() : null;
  }

  /** Thinking wanders: up and away, down in concentration, away again. */
  private getThinkingPoses(): MoodPose[] {
    const base = this.createNeutralExpression();
    const cocked = { ...base.leftEyebrow, innerY: 3, arcY: 9, outerY: 10 };
    const lowered = { innerY: -6, arcY: -3, outerY: -1 };
    const pursed = {
      ...base.mouth,
      upperLipBottom: 1,
      lowerLipTop: 3,
      width: 0.6,
      cornerPull: -0.08,
    };
    const lookingUp = (x: number) => ({ pupilOffset: { x, y: -4 } });
    const degrees = (yaw: number, pitch: number, roll: number): HeadOffset => ({
      yaw: (yaw * Math.PI) / 180,
      pitch: (pitch * Math.PI) / 180,
      roll: (roll * Math.PI) / 180,
    });

    return [
      {
        // "Hmm": eyes up and away, one brow cocked, mouth pursed aside.
        hold: 2.4,
        // The head follows the eyes: turned and lifted, tipped to the side.
        head: degrees(4, -3, 4),
        expression: {
          ...base,
          leftEye: { ...base.leftEye, openness: 1.2, ...lookingUp(5) },
          rightEye: {
            ...base.rightEye,
            openness: 1.1,
            squint: 0.25,
            ...lookingUp(5),
          },
          leftEyebrow: cocked,
          rightEyebrow: { ...base.rightEyebrow, ...lowered, rotation: -0.12 },
          mouth: { ...pursed, skew: 0.5 },
        },
      },
      {
        // Concentrating: eyes down, brows knit, lips pressed.
        hold: 1.8,
        head: degrees(-2, 4, -1),
        expression: {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 0.8,
            squint: 0.3,
            pupilOffset: { x: -3, y: 4 },
          },
          rightEye: {
            ...base.rightEye,
            openness: 0.8,
            squint: 0.3,
            pupilOffset: { x: -3, y: 4 },
          },
          leftEyebrow: { ...base.leftEyebrow, ...lowered, rotation: 0.12 },
          rightEyebrow: { ...base.rightEyebrow, ...lowered, rotation: -0.12 },
          mouth: { ...pursed, width: 0.8, cornerPull: -0.15, skew: 0.15 },
        },
      },
      {
        // The first pose mirrored, a little smaller.
        hold: 2.2,
        head: degrees(-4, -3, -4),
        expression: {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 1.1,
            squint: 0.2,
            ...lookingUp(-5),
          },
          rightEye: { ...base.rightEye, openness: 1.2, ...lookingUp(-5) },
          leftEyebrow: { ...base.leftEyebrow, ...lowered, rotation: 0.1 },
          rightEyebrow: { ...cocked, outerY: 8 },
          mouth: { ...pursed, skew: -0.4 },
        },
      },
      {
        // Considering: both brows up, eyes ahead and slightly raised.
        hold: 1.4,
        head: degrees(0, -2, 0),
        expression: {
          ...base,
          leftEye: {
            ...base.leftEye,
            openness: 1.15,
            pupilOffset: { x: 0, y: -3 },
          },
          rightEye: {
            ...base.rightEye,
            openness: 1.15,
            pupilOffset: { x: 0, y: -3 },
          },
          leftEyebrow: { ...base.leftEyebrow, innerY: 7, arcY: 8, outerY: 7 },
          rightEyebrow: { ...base.rightEyebrow, innerY: 7, arcY: 8, outerY: 7 },
          mouth: { ...pursed, width: 0.75, cornerPull: 0 },
        },
      },
    ];
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
      skew: lerp(a.skew, b.skew),
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
