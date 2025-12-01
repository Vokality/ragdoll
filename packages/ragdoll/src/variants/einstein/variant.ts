import type { CharacterVariant } from "../types";

/**
 * Einstein variant - caricature of Albert Einstein
 * Large forehead, bushy eyebrows, prominent nose, wild hair, mustache
 */
export const einsteinVariant: CharacterVariant = {
  id: "einstein",
  name: "Einstein",
  description: "Albert Einstein caricature with wild hair and mustache",

  colorOverrides: {
    hair: {
      light: "#d0d0d0", // Light gray/white
      mid: "#a8a8a8", // Medium gray
      dark: "#808080", // Dark gray
    },
    eyes: {
      iris: "#8b7355", // Brown eyes
      irisMid: "#6b5335",
      irisDark: "#4b3315",
    },
  },

  dimensions: {
    // Larger forehead/head (big brain!)
    headWidth: 145,
    headHeight: 180,

    // Aged features - eyes lower on face
    eyeWidth: 26,
    eyeHeight: 16,
    eyeSpacing: 60,
    eyeY: -10, // Lower due to larger forehead

    // Bushier eyebrows
    eyebrowWidth: 40, // Wider than default (34)
    eyebrowThickness: 6, // Thicker than default (4)
    eyebrowY: 20,

    // Prominent nose
    noseWidth: 24, // Wider than default (20)
    noseHeight: 40, // Longer than default (35)
    noseY: 18,

    // Older mouth features
    mouthWidth: 38,
    mouthY: 55, // Lower on face
    lipThickness: 6, // Thinner lips

    // Ears stick out more
    earWidth: 22,
    earHeight: 45,
  },

  hairStyle: "wild",
  mustacheStyle: "bushy",
  ageModifier: 0.85, // Elderly
};

