import type { RagdollTheme } from "./types";

/**
 * Default theme - warm human-like appearance
 */
export const defaultTheme: RagdollTheme = {
  id: "default",
  name: "Default",
  description: "Warm, human-like appearance",
  colors: {
    skin: {
      light: "#ffe0c4",
      mid: "#ffd4b0",
    },
    hair: {
      light: "#4a3628",
      mid: "#3d2a1e",
      dark: "#2a1d14",
    },
    eyes: {
      iris: "#5a9bc4",
      irisDark: "#2a5a7a",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#d4707a",
      upperDark: "#c45c66",
    },
    teeth: "#f8f8f0",
  },
};

/**
 * Robot theme - metallic, futuristic appearance
 */
export const robotTheme: RagdollTheme = {
  id: "robot",
  name: "Robot",
  description: "Metallic, futuristic robot",
  colors: {
    skin: {
      light: "#c0c0c0",
      mid: "#a0a0a0",
    },
    hair: {
      light: "#404040",
      mid: "#303030",
      dark: "#202020",
    },
    eyes: {
      iris: "#00ffff",
      irisDark: "#009999",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#606060",
      upperDark: "#505050",
    },
    teeth: "#e0e0e0",
  },
};

/**
 * Alien theme - green/blue otherworldly appearance
 */
export const alienTheme: RagdollTheme = {
  id: "alien",
  name: "Alien",
  description: "Green, otherworldly alien",
  colors: {
    skin: {
      light: "#a0e0a0",
      mid: "#80c080",
    },
    hair: {
      light: "#204020",
      mid: "#183018",
      dark: "#102010",
    },
    eyes: {
      iris: "#000000",
      irisDark: "#000000",
      pupil: "#ffff00",
      white: "#ffffff",
    },
    lips: {
      upper: "#408040",
      upperDark: "#306030",
    },
    teeth: "#e8f0e8",
  },
};

/**
 * Monochrome theme - grayscale appearance
 */
export const monochromeTheme: RagdollTheme = {
  id: "monochrome",
  name: "Monochrome",
  description: "Classic black and white",
  colors: {
    skin: {
      light: "#e0e0e0",
      mid: "#c0c0c0",
    },
    hair: {
      light: "#202020",
      mid: "#151515",
      dark: "#0a0a0a",
    },
    eyes: {
      iris: "#606060",
      irisDark: "#202020",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#808080",
      upperDark: "#606060",
    },
    teeth: "#f0f0f0",
  },
};
