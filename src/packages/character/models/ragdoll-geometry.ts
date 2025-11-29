import type { FacialMood, FacialAction } from '../types';

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
  
  // Human-like facial proportions
  public readonly dimensions: FaceDimensions = {
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

  constructor() {
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
      case 'smile':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.9, squint: 0.2 },
          rightEye: { ...base.rightEye, openness: 0.9, squint: 0.2 },
          leftEyebrow: { ...base.leftEyebrow, arcY: 3, outerY: 2 },
          rightEyebrow: { ...base.rightEyebrow, arcY: 3, outerY: 2 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 4,
            lowerLipTop: 8,
            width: 1.2,
            cornerPull: 0.7,
          },
          cheekPuff: 0.15,
        };

      case 'frown':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.85 },
          rightEye: { ...base.rightEye, openness: 0.85 },
          leftEyebrow: { ...base.leftEyebrow, innerY: -4, arcY: -2, rotation: 0.15 },
          rightEyebrow: { ...base.rightEyebrow, innerY: -4, arcY: -2, rotation: -0.15 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 1,
            lowerLipTop: 3,
            width: 0.85,
            cornerPull: -0.5,
          },
        };

      case 'laugh':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.5, squint: 0.6 },
          rightEye: { ...base.rightEye, openness: 0.5, squint: 0.6 },
          leftEyebrow: { ...base.leftEyebrow, arcY: 6, outerY: 4 },
          rightEyebrow: { ...base.rightEyebrow, arcY: 6, outerY: 4 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 8,
            lowerLipTop: 18,
            lowerLipBottom: 22,
            width: 1.3,
            cornerPull: 0.9,
          },
          cheekPuff: 0.3,
        };

      case 'angry':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.7, squint: 0.3 },
          rightEye: { ...base.rightEye, openness: 0.7, squint: 0.3 },
          leftEyebrow: { ...base.leftEyebrow, innerY: -8, arcY: -4, outerY: 2, rotation: 0.25 },
          rightEyebrow: { ...base.rightEyebrow, innerY: -8, arcY: -4, outerY: 2, rotation: -0.25 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 2,
            lowerLipTop: 5,
            width: 0.9,
            cornerPull: -0.4,
          },
          noseScrunch: 0.4,
        };

      case 'sad':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.75, pupilOffset: { x: 0, y: 2 } },
          rightEye: { ...base.rightEye, openness: 0.75, pupilOffset: { x: 0, y: 2 } },
          leftEyebrow: { ...base.leftEyebrow, innerY: 6, arcY: -2, outerY: -4, rotation: -0.2 },
          rightEyebrow: { ...base.rightEyebrow, innerY: 6, arcY: -2, outerY: -4, rotation: 0.2 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 1,
            lowerLipTop: 2,
            lowerLipBottom: 7,
            width: 0.8,
            cornerPull: -0.6,
          },
        };

      case 'surprise':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 1.3, pupilSize: 1.3 },
          rightEye: { ...base.rightEye, openness: 1.3, pupilSize: 1.3 },
          leftEyebrow: { ...base.leftEyebrow, innerY: 10, arcY: 12, outerY: 8 },
          rightEyebrow: { ...base.rightEyebrow, innerY: 10, arcY: 12, outerY: 8 },
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

      case 'confusion':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.95, pupilOffset: { x: 2, y: -1 } },
          rightEye: { ...base.rightEye, openness: 0.8, pupilOffset: { x: -2, y: 1 } },
          leftEyebrow: { ...base.leftEyebrow, innerY: 4, arcY: 6, outerY: 2 },
          rightEyebrow: { ...base.rightEyebrow, innerY: -2, arcY: -1, outerY: -3, rotation: -0.1 },
          mouth: {
            ...base.mouth,
            upperLipBottom: 2,
            lowerLipTop: 4,
            width: 0.85,
            cornerPull: -0.15,
          },
        };

      case 'thinking':
        return {
          ...base,
          leftEye: { ...base.leftEye, openness: 0.85, pupilOffset: { x: 4, y: -3 } },
          rightEye: { ...base.rightEye, openness: 0.85, pupilOffset: { x: 4, y: -3 } },
          leftEyebrow: { ...base.leftEyebrow, innerY: 2, arcY: 5, outerY: 3 },
          rightEyebrow: { ...base.rightEyebrow, innerY: -1, arcY: 2, outerY: 0 },
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

  public getActionOverlay(
    action: FacialAction | null,
    elapsed: number,
    currentExpression: ExpressionConfig
  ): Partial<ExpressionConfig> {
    if (!action || action === 'none') {
      return {};
    }

    if (action === 'wink') {
      // Wink affects only the right eye (character's left from viewer)
      const progress = Math.min(1, elapsed / 0.4);
      // Quick close, slower open
      const winkCurve = progress < 0.3 
        ? Math.sin((progress / 0.3) * Math.PI / 2) 
        : Math.cos(((progress - 0.3) / 0.7) * Math.PI / 2);
      
      return {
        rightEye: {
          ...currentExpression.rightEye,
          openness: 1 - winkCurve * 0.95,
        },
        // Slight cheek raise on winking side
        cheekPuff: winkCurve * 0.2,
      };
    }

    if (action === 'talk') {
      // Organic talking animation with varied mouth shapes
      const baseFreq = 6;
      const variation = Math.sin(elapsed * 1.7) * 0.3;
      const cycle = Math.sin(elapsed * baseFreq + variation);
      const cycle2 = Math.sin(elapsed * baseFreq * 1.3);
      
      const openAmount = Math.abs(cycle) * 0.7 + Math.abs(cycle2) * 0.3;
      
      return {
        mouth: {
          ...currentExpression.mouth,
          upperLipBottom: currentExpression.mouth.upperLipBottom + openAmount * 4,
          lowerLipTop: currentExpression.mouth.lowerLipTop + openAmount * 10,
          lowerLipBottom: currentExpression.mouth.lowerLipBottom + openAmount * 6,
          width: currentExpression.mouth.width * (1 + Math.sin(elapsed * 4) * 0.08),
        },
      };
    }

    return {};
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
  public getEyePath(isLeft: boolean, eyeState: EyeState): { sclera: string; upperLid: string; lowerLid: string } {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const cx = sign * d.eyeSpacing / 2;
    const cy = d.eyeY;
    const w = d.eyeWidth / 2;
    const h = d.eyeHeight / 2;
    
    const openness = Math.max(0, Math.min(1.3, eyeState.openness));
    const squint = eyeState.squint;
    
    // Eye sclera (white) - almond shape
    const sclera = `
      M ${cx - w} ${cy}
      Q ${cx - w * 0.5} ${cy - h} ${cx} ${cy - h}
      Q ${cx + w * 0.5} ${cy - h} ${cx + w} ${cy}
      Q ${cx + w * 0.5} ${cy + h} ${cx} ${cy + h}
      Q ${cx - w * 0.5} ${cy + h} ${cx - w} ${cy}
      Z
    `;
    
    // Upper eyelid - covers eye based on openness
    const upperLidY = cy - h + (1 - openness) * h * 1.5;
    const upperLid = `
      M ${cx - w - 2} ${cy - h - 4}
      L ${cx + w + 2} ${cy - h - 4}
      L ${cx + w + 2} ${upperLidY}
      Q ${cx} ${upperLidY + (openness > 0.5 ? 2 : -2)} ${cx - w - 2} ${upperLidY}
      Z
    `;
    
    // Lower eyelid - rises with squint
    const lowerLidY = cy + h - squint * h * 0.6;
    const lowerLid = `
      M ${cx - w - 2} ${cy + h + 4}
      L ${cx + w + 2} ${cy + h + 4}
      L ${cx + w + 2} ${lowerLidY}
      Q ${cx} ${lowerLidY - 2} ${cx - w - 2} ${lowerLidY}
      Z
    `;
    
    return { sclera, upperLid, lowerLid };
  }

  /**
   * Get iris and pupil positions
   */
  public getIrisPosition(isLeft: boolean, eyeState: EyeState): { cx: number; cy: number; irisR: number; pupilR: number } {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const baseCx = sign * d.eyeSpacing / 2;
    const baseCy = d.eyeY;
    
    // Clamp pupil offset to stay within eye
    const maxOffset = d.eyeWidth / 2 - d.irisRadius;
    const offsetX = Math.max(-maxOffset, Math.min(maxOffset, eyeState.pupilOffset.x));
    const offsetY = Math.max(-5, Math.min(5, eyeState.pupilOffset.y));
    
    return {
      cx: baseCx + offsetX,
      cy: baseCy + offsetY,
      irisR: d.irisRadius * eyeState.pupilSize,
      pupilR: d.pupilRadius * eyeState.pupilSize,
    };
  }

  /**
   * Generate SVG path for an eyebrow
   */
  public getEyebrowPath(isLeft: boolean, eyebrowState: EyebrowState): string {
    const d = this.dimensions;
    const sign = isLeft ? 1 : -1;
    const cx = sign * d.eyeSpacing / 2;
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
    
    // Curved eyebrow path
    return `
      M ${innerX} ${innerY}
      Q ${cx} ${arcY - t} ${outerX} ${outerY}
      L ${outerX} ${outerY + t}
      Q ${cx} ${arcY + t * 0.5} ${innerX} ${innerY + t * 1.2}
      Z
    `;
  }

  /**
   * Generate SVG path for the mouth/lips
   */
  public getMouthPath(mouthState: MouthState): { upperLip: string; lowerLip: string; opening: string } {
    const d = this.dimensions;
    const cy = d.mouthY;
    const w = (d.mouthWidth / 2) * mouthState.width;
    
    const pull = mouthState.cornerPull;
    const cornerY = cy - pull * 6; // Corners go up for smile, down for frown
    
    // Upper lip with cupid's bow
    const upperTop = cy - d.lipThickness + mouthState.upperLipTop;
    const upperBottom = cy + mouthState.upperLipBottom;
    const bowDepth = mouthState.upperLipCurve * 3;
    
    const upperLip = `
      M ${-w} ${cornerY}
      Q ${-w * 0.5} ${upperTop - 2} ${-w * 0.15} ${upperTop}
      Q 0 ${upperTop + bowDepth} ${w * 0.15} ${upperTop}
      Q ${w * 0.5} ${upperTop - 2} ${w} ${cornerY}
      L ${w * 0.8} ${upperBottom + pull * 2}
      Q 0 ${upperBottom + 2} ${-w * 0.8} ${upperBottom + pull * 2}
      Z
    `;
    
    // Lower lip - fuller curve
    const lowerTop = cy + mouthState.lowerLipTop;
    const lowerBottom = cy + mouthState.lowerLipBottom;
    
    const lowerLip = `
      M ${-w * 0.8} ${lowerTop - pull * 2}
      Q 0 ${lowerTop - 2} ${w * 0.8} ${lowerTop - pull * 2}
      L ${w} ${cornerY + d.lipThickness * 0.5}
      Q ${w * 0.5} ${lowerBottom + 2} 0 ${lowerBottom}
      Q ${-w * 0.5} ${lowerBottom + 2} ${-w} ${cornerY + d.lipThickness * 0.5}
      Z
    `;
    
    // Mouth opening (dark inside)
    const openingTop = upperBottom;
    const openingBottom = lowerTop;
    const hasOpening = openingBottom > openingTop + 1;
    
    const opening = hasOpening ? `
      M ${-w * 0.75} ${openingTop + pull * 2}
      Q 0 ${openingTop + 1} ${w * 0.75} ${openingTop + pull * 2}
      Q ${w * 0.6} ${(openingTop + openingBottom) / 2} ${w * 0.7} ${openingBottom - pull * 2}
      Q 0 ${openingBottom - 1} ${-w * 0.7} ${openingBottom - pull * 2}
      Q ${-w * 0.6} ${(openingTop + openingBottom) / 2} ${-w * 0.75} ${openingTop + pull * 2}
      Z
    ` : '';
    
    return { upperLip, lowerLip, opening };
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
   * Generate hair path
   */
  public getHairPath(): string {
    const d = this.dimensions;
    const hw = d.headWidth / 2;
    const hh = d.headHeight / 2;
    
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

  public setExpression(expression: ExpressionConfig): void {
    this.currentExpression = expression;
  }

  /**
   * Interpolate between two expressions
   */
  public static interpolateExpression(
    from: ExpressionConfig,
    to: ExpressionConfig,
    t: number
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
