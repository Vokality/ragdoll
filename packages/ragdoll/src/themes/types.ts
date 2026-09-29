/**
 * Color palette for a ragdoll theme
 */
export interface ThemeColors {
  skin: {
    light: string;
    mid: string;
  };
  hair: {
    light: string;
    mid: string;
    dark: string;
  };
  eyes: {
    iris: string;
    irisDark: string;
    pupil: string;
    white: string;
  };
  lips: {
    upper: string;
    upperDark: string;
  };
  teeth: string;
}

/**
 * Complete ragdoll theme definition
 */
export interface RagdollTheme {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
}
