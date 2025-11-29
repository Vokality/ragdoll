/**
 * Gradient stop definition for SVG gradients
 */
export interface GradientStop {
  offset: string;
  stopColor: string;
}

/**
 * Linear gradient definition
 */
export interface LinearGradient {
  type: 'linear';
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  stops: GradientStop[];
}

/**
 * Radial gradient definition
 */
export interface RadialGradient {
  type: 'radial';
  cx: string;
  cy: string;
  r: string;
  stops: GradientStop[];
}

export type GradientDef = LinearGradient | RadialGradient;

/**
 * Color palette for a ragdoll theme
 */
export interface ThemeColors {
  skin: {
    light: string;
    mid: string;
    dark: string;
    radial: string;
  };
  hair: {
    light: string;
    mid: string;
    dark: string;
  };
  eyes: {
    iris: string;
    irisMid: string;
    irisDark: string;
    pupil: string;
    white: string;
  };
  lips: {
    upper: string;
    upperDark: string;
    lower: string;
    lowerDark: string;
  };
  lids: {
    light: string;
    dark: string;
  };
  blush: {
    color: string;
    transparent: string;
  };
  shadow: {
    color: string;
    transparent: string;
  };
  stroke: string;
}

/**
 * Complete ragdoll theme definition
 */
export interface RagdollTheme {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
  gradients: {
    skinGradient: LinearGradient;
    skinRadial: RadialGradient;
    hairGradient: LinearGradient;
    upperLipGradient: LinearGradient;
    lowerLipGradient: LinearGradient;
    irisGradient: RadialGradient;
    blushGradient: RadialGradient;
    lidGradient: LinearGradient;
    faceShadowLeft: LinearGradient;
    faceShadowRight: LinearGradient;
  };
}

