// Types
export type {
  CharacterVariant,
  DimensionOverrides,
  ColorOverrides,
  HairStyle,
  MustacheStyle,
} from "./types";

// Default variants
export { humanVariant } from "./human";
export { einsteinVariant } from "./einstein";

// Registry functions
export {
  getVariant,
  getDefaultVariant,
  registerVariant,
  getVariantIds,
  getAllVariants,
} from "./variant-registry";
