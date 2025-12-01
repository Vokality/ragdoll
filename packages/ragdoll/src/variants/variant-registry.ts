import type { CharacterVariant } from "./types";
import { humanVariant } from "./human";
import { einsteinVariant } from "./einstein";

/**
 * Registry of all available character variants
 */
const variantRegistry = new Map<string, CharacterVariant>([
  [humanVariant.id, humanVariant],
  [einsteinVariant.id, einsteinVariant],
]);

/**
 * Get a character variant by ID
 */
export function getVariant(id: string): CharacterVariant {
  const variant = variantRegistry.get(id);
  if (!variant) {
    console.warn(`Variant "${id}" not found, using default "human" variant`);
    return humanVariant;
  }
  return variant;
}

/**
 * Get the default character variant (human)
 */
export function getDefaultVariant(): CharacterVariant {
  return humanVariant;
}

/**
 * Register a custom character variant
 */
export function registerVariant(variant: CharacterVariant): void {
  variantRegistry.set(variant.id, variant);
}

/**
 * Get all registered variant IDs
 */
export function getVariantIds(): string[] {
  return Array.from(variantRegistry.keys());
}

/**
 * Get all registered variants
 */
export function getAllVariants(): CharacterVariant[] {
  return Array.from(variantRegistry.values());
}
