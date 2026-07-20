import type { FacialAction, FacialMood } from "@vokality/ragdoll" with {
  "resolution-mode": "import",
};

export type { FacialMood };
export type BubbleTone = "default" | "whisper" | "shout";

export const VALID_MOODS = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
  "confusion",
  "thinking",
] as const satisfies readonly FacialMood[];
export const VALID_ACTIONS = [
  "wink",
  "talk",
  "shake",
] as const satisfies readonly Exclude<FacialAction, "none">[];
export const VALID_TONES = [
  "default",
  "whisper",
  "shout",
] as const satisfies readonly BubbleTone[];
export const VALID_THEMES = [
  "default",
  "robot",
  "alien",
  "monochrome",
] as const;
export const VALID_VARIANTS = ["human", "einstein"] as const;

export type ActionId = (typeof VALID_ACTIONS)[number];
export type ThemeId = (typeof VALID_THEMES)[number];
export type VariantId = (typeof VALID_VARIANTS)[number];

export type ExtensionMessage =
  | { type: "setMood"; mood: FacialMood; duration?: number }
  | {
      type: "triggerAction";
      action: ActionId;
      duration?: number;
    }
  | { type: "clearAction" }
  | {
      type: "setHeadPose";
      yaw?: number;
      pitch?: number;
      duration?: number;
    }
  | {
      type: "setSpeechBubble";
      text: string | null;
      tone: BubbleTone;
    }
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "setVariant"; variantId: VariantId };

export type WebviewMessage =
  { type: "ready" } | { type: "error"; message: string };
