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
      dark: "#f5c4a0",
      radial: "#ffe8d6",
    },
    hair: {
      light: "#4a3628",
      mid: "#3d2a1e",
      dark: "#2a1d14",
    },
    eyes: {
      iris: "#5a9bc4",
      irisMid: "#3d7a9f",
      irisDark: "#2a5a7a",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#d4707a",
      upperDark: "#c45c66",
      lower: "#e07882",
      lowerDark: "#c86872",
    },
    lids: {
      light: "#f5c4a0",
      dark: "#e8b494",
    },
    blush: {
      color: "rgba(255,140,140,0.4)",
      transparent: "rgba(255,140,140,0)",
    },
    shadow: {
      color: "rgba(120,80,50,0.2)",
      transparent: "rgba(120,80,50,0)",
    },
    stroke: "#e0a080",
    teeth: "#f8f8f0",
    highlight: "#ffffff",
  },
  gradients: {
    skinGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#ffe0c4" },
        { offset: "50%", stopColor: "#ffd4b0" },
        { offset: "100%", stopColor: "#f5c4a0" },
      ],
    },
    skinRadial: {
      type: "radial",
      cx: "40%",
      cy: "30%",
      r: "70%",
      stops: [
        { offset: "0%", stopColor: "#ffe8d6" },
        { offset: "100%", stopColor: "#f5c4a0" },
      ],
    },
    hairGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#4a3628" },
        { offset: "40%", stopColor: "#3d2a1e" },
        { offset: "100%", stopColor: "#2a1d14" },
      ],
    },
    upperLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#d4707a" },
        { offset: "100%", stopColor: "#c45c66" },
      ],
    },
    lowerLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#e07882" },
        { offset: "100%", stopColor: "#c86872" },
      ],
    },
    irisGradient: {
      type: "radial",
      cx: "35%",
      cy: "35%",
      r: "65%",
      stops: [
        { offset: "0%", stopColor: "#5a9bc4" },
        { offset: "50%", stopColor: "#3d7a9f" },
        { offset: "100%", stopColor: "#2a5a7a" },
      ],
    },
    blushGradient: {
      type: "radial",
      cx: "50%",
      cy: "50%",
      r: "50%",
      stops: [
        { offset: "0%", stopColor: "rgba(255,140,140,0.4)" },
        { offset: "100%", stopColor: "rgba(255,140,140,0)" },
      ],
    },
    lidGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#f5c4a0" },
        { offset: "100%", stopColor: "#e8b494" },
      ],
    },
    faceShadowLeft: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(120,80,50,0.2)" },
        { offset: "100%", stopColor: "rgba(120,80,50,0)" },
      ],
    },
    faceShadowRight: {
      type: "linear",
      x1: "100%",
      y1: "0%",
      x2: "0%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(120,80,50,0.2)" },
        { offset: "100%", stopColor: "rgba(120,80,50,0)" },
      ],
    },
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
      dark: "#808080",
      radial: "#d0d0d0",
    },
    hair: {
      light: "#404040",
      mid: "#303030",
      dark: "#202020",
    },
    eyes: {
      iris: "#00ffff",
      irisMid: "#00cccc",
      irisDark: "#009999",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#606060",
      upperDark: "#505050",
      lower: "#707070",
      lowerDark: "#606060",
    },
    lids: {
      light: "#808080",
      dark: "#707070",
    },
    blush: {
      color: "rgba(0,255,255,0.3)",
      transparent: "rgba(0,255,255,0)",
    },
    shadow: {
      color: "rgba(0,0,0,0.3)",
      transparent: "rgba(0,0,0,0)",
    },
    stroke: "#606060",
    teeth: "#e0e0e0",
    highlight: "#ffffff",
  },
  gradients: {
    skinGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#c0c0c0" },
        { offset: "50%", stopColor: "#a0a0a0" },
        { offset: "100%", stopColor: "#808080" },
      ],
    },
    skinRadial: {
      type: "radial",
      cx: "40%",
      cy: "30%",
      r: "70%",
      stops: [
        { offset: "0%", stopColor: "#d0d0d0" },
        { offset: "100%", stopColor: "#808080" },
      ],
    },
    hairGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#404040" },
        { offset: "40%", stopColor: "#303030" },
        { offset: "100%", stopColor: "#202020" },
      ],
    },
    upperLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#606060" },
        { offset: "100%", stopColor: "#505050" },
      ],
    },
    lowerLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#707070" },
        { offset: "100%", stopColor: "#606060" },
      ],
    },
    irisGradient: {
      type: "radial",
      cx: "35%",
      cy: "35%",
      r: "65%",
      stops: [
        { offset: "0%", stopColor: "#00ffff" },
        { offset: "50%", stopColor: "#00cccc" },
        { offset: "100%", stopColor: "#009999" },
      ],
    },
    blushGradient: {
      type: "radial",
      cx: "50%",
      cy: "50%",
      r: "50%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,255,255,0.3)" },
        { offset: "100%", stopColor: "rgba(0,255,255,0)" },
      ],
    },
    lidGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#808080" },
        { offset: "100%", stopColor: "#707070" },
      ],
    },
    faceShadowLeft: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,0,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,0,0,0)" },
      ],
    },
    faceShadowRight: {
      type: "linear",
      x1: "100%",
      y1: "0%",
      x2: "0%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,0,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,0,0,0)" },
      ],
    },
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
      dark: "#60a060",
      radial: "#b0f0b0",
    },
    hair: {
      light: "#204020",
      mid: "#183018",
      dark: "#102010",
    },
    eyes: {
      iris: "#000000",
      irisMid: "#000000",
      irisDark: "#000000",
      pupil: "#ffff00",
      white: "#ffffff",
    },
    lips: {
      upper: "#408040",
      upperDark: "#306030",
      lower: "#509050",
      lowerDark: "#408040",
    },
    lids: {
      light: "#60a060",
      dark: "#509050",
    },
    blush: {
      color: "rgba(0,255,0,0.3)",
      transparent: "rgba(0,255,0,0)",
    },
    shadow: {
      color: "rgba(0,80,0,0.3)",
      transparent: "rgba(0,80,0,0)",
    },
    stroke: "#408040",
    teeth: "#e8f0e8",
    highlight: "#ffffff",
  },
  gradients: {
    skinGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#a0e0a0" },
        { offset: "50%", stopColor: "#80c080" },
        { offset: "100%", stopColor: "#60a060" },
      ],
    },
    skinRadial: {
      type: "radial",
      cx: "40%",
      cy: "30%",
      r: "70%",
      stops: [
        { offset: "0%", stopColor: "#b0f0b0" },
        { offset: "100%", stopColor: "#60a060" },
      ],
    },
    hairGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#204020" },
        { offset: "40%", stopColor: "#183018" },
        { offset: "100%", stopColor: "#102010" },
      ],
    },
    upperLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#408040" },
        { offset: "100%", stopColor: "#306030" },
      ],
    },
    lowerLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#509050" },
        { offset: "100%", stopColor: "#408040" },
      ],
    },
    irisGradient: {
      type: "radial",
      cx: "35%",
      cy: "35%",
      r: "65%",
      stops: [
        { offset: "0%", stopColor: "#000000" },
        { offset: "50%", stopColor: "#000000" },
        { offset: "100%", stopColor: "#000000" },
      ],
    },
    blushGradient: {
      type: "radial",
      cx: "50%",
      cy: "50%",
      r: "50%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,255,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,255,0,0)" },
      ],
    },
    lidGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#60a060" },
        { offset: "100%", stopColor: "#509050" },
      ],
    },
    faceShadowLeft: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,80,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,80,0,0)" },
      ],
    },
    faceShadowRight: {
      type: "linear",
      x1: "100%",
      y1: "0%",
      x2: "0%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,80,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,80,0,0)" },
      ],
    },
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
      dark: "#a0a0a0",
      radial: "#f0f0f0",
    },
    hair: {
      light: "#202020",
      mid: "#151515",
      dark: "#0a0a0a",
    },
    eyes: {
      iris: "#606060",
      irisMid: "#404040",
      irisDark: "#202020",
      pupil: "#000000",
      white: "#ffffff",
    },
    lips: {
      upper: "#808080",
      upperDark: "#606060",
      lower: "#909090",
      lowerDark: "#808080",
    },
    lids: {
      light: "#a0a0a0",
      dark: "#909090",
    },
    blush: {
      color: "rgba(128,128,128,0.3)",
      transparent: "rgba(128,128,128,0)",
    },
    shadow: {
      color: "rgba(0,0,0,0.3)",
      transparent: "rgba(0,0,0,0)",
    },
    stroke: "#808080",
    teeth: "#f0f0f0",
    highlight: "#ffffff",
  },
  gradients: {
    skinGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#e0e0e0" },
        { offset: "50%", stopColor: "#c0c0c0" },
        { offset: "100%", stopColor: "#a0a0a0" },
      ],
    },
    skinRadial: {
      type: "radial",
      cx: "40%",
      cy: "30%",
      r: "70%",
      stops: [
        { offset: "0%", stopColor: "#f0f0f0" },
        { offset: "100%", stopColor: "#a0a0a0" },
      ],
    },
    hairGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#202020" },
        { offset: "40%", stopColor: "#151515" },
        { offset: "100%", stopColor: "#0a0a0a" },
      ],
    },
    upperLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#808080" },
        { offset: "100%", stopColor: "#606060" },
      ],
    },
    lowerLipGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#909090" },
        { offset: "100%", stopColor: "#808080" },
      ],
    },
    irisGradient: {
      type: "radial",
      cx: "35%",
      cy: "35%",
      r: "65%",
      stops: [
        { offset: "0%", stopColor: "#606060" },
        { offset: "50%", stopColor: "#404040" },
        { offset: "100%", stopColor: "#202020" },
      ],
    },
    blushGradient: {
      type: "radial",
      cx: "50%",
      cy: "50%",
      r: "50%",
      stops: [
        { offset: "0%", stopColor: "rgba(128,128,128,0.3)" },
        { offset: "100%", stopColor: "rgba(128,128,128,0)" },
      ],
    },
    lidGradient: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      stops: [
        { offset: "0%", stopColor: "#a0a0a0" },
        { offset: "100%", stopColor: "#909090" },
      ],
    },
    faceShadowLeft: {
      type: "linear",
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,0,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,0,0,0)" },
      ],
    },
    faceShadowRight: {
      type: "linear",
      x1: "100%",
      y1: "0%",
      x2: "0%",
      y2: "0%",
      stops: [
        { offset: "0%", stopColor: "rgba(0,0,0,0.3)" },
        { offset: "100%", stopColor: "rgba(0,0,0,0)" },
      ],
    },
  },
};
