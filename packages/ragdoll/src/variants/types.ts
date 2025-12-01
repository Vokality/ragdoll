import type { FaceDimensions } from "../models/ragdoll-geometry";
import type { ThemeColors } from "../themes/types";

/**
 * Hair style variants
 */
export type HairStyle = "default" | "wild" | "short" | "bald";

/**
 * Mustache style variants
 */
export type MustacheStyle = "none" | "bushy" | "thin" | "handlebar";

/**
 * Partial dimensions that can override defaults
 */
export type DimensionOverrides = Partial<FaceDimensions>;

/**
 * Partial color overrides that can override theme colors
 */
export type ColorOverrides = {
  hair?: Partial<ThemeColors["hair"]>;
  eyes?: Partial<ThemeColors["eyes"]>;
  skin?: Partial<ThemeColors["skin"]>;
  lips?: Partial<ThemeColors["lips"]>;
};

/**
 * Character variant definition
 * Defines the structural/geometric characteristics of a character
 */
export interface CharacterVariant {
  id: string;
  name: string;
  description?: string;

  // Dimension overrides (only specify what's different from base)
  dimensions?: DimensionOverrides;

  // Color overrides (variant-specific colors that override theme)
  colorOverrides?: ColorOverrides;

  // Facial feature variations
  hairStyle?: HairStyle;
  mustacheStyle?: MustacheStyle;

  // Age and feature modifiers
  ageModifier?: number; // 0 = child, 0.5 = adult, 1 = elderly
}
