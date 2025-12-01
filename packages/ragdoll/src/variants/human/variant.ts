import type { CharacterVariant } from "../types";

/**
 * Human variant - standard character with balanced proportions
 * This is the base variant with no dimension overrides
 */
export const humanVariant: CharacterVariant = {
  id: "human",
  name: "Human",
  description: "Standard human character with balanced proportions",
  hairStyle: "default",
  mustacheStyle: "none",
  ageModifier: 0.5, // Adult
};

