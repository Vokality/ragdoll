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
      light: "#f3f0e8", // Light gray/white
      mid: "#d9d5cd", // Medium gray
      dark: "#96948f", // Dark gray
    },
    skin: {
      light: "#edd2b8",
      mid: "#d4b295",
      dark: "#a98168",
      radial: "#e1bea1",
    },
    lips: {
      upper: "#9a7063",
      upperDark: "#644b42",
      lower: "#b98c7d",
      lowerDark: "#8a6557",
    },
    eyes: {
      iris: "#8b7355", // Brown eyes
      irisMid: "#6b5335",
      irisDark: "#4b3315",
    },
  },

  dimensions: {
    // Larger forehead/head (big brain!)
    headWidth: 148,
    headHeight: 186,
    jawWidth: 114,
    chinHeight: 39,

    // Aged features - eyes lower on face
    eyeWidth: 29,
    eyeHeight: 12,
    irisRadius: 6,
    pupilRadius: 3,
    eyeSpacing: 58,
    eyeY: -4, // Lower due to larger forehead

    // Bushier eyebrows
    eyebrowWidth: 40, // Wider than default (34)
    eyebrowThickness: 6, // Thicker than default (4)
    eyebrowY: 12,

    // Prominent nose
    noseWidth: 28, // Wider than default (20)
    noseHeight: 43, // Longer than default (35)
    noseY: 19,

    // Older mouth features
    mouthWidth: 44,
    mouthY: 56, // Lower on face
    lipThickness: 4, // Thinner lips

    // Ears stick out more
    earWidth: 20,
    earHeight: 45,
  },

  hairStyle: "wild",
  mustacheStyle: "bushy",
  ageModifier: 0.85, // Elderly
};
