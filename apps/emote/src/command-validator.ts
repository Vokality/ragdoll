import {
  VALID_ACTIONS,
  VALID_MOODS,
  VALID_THEMES,
  VALID_TONES,
  VALID_VARIANTS,
} from "./types";
import type {
  ActionId,
  BubbleTone,
  FacialMood,
  ThemeId,
  VariantId,
} from "./types";

const MAX_BUBBLE_CHARACTERS = 240;

export interface RawCommand {
  type?: unknown;
  mood?: unknown;
  action?: unknown;
  duration?: unknown;
  yawDegrees?: unknown;
  pitchDegrees?: unknown;
  text?: unknown;
  tone?: unknown;
  themeId?: unknown;
  variantId?: unknown;
}

export type ValidatedCommand =
  | { type: "show" | "hide" | "clearAction" }
  | { type: "setMood"; mood: FacialMood; duration?: number }
  | { type: "triggerAction"; action: ActionId; duration?: number }
  | {
      type: "setHeadPose";
      yawDegrees?: number;
      pitchDegrees?: number;
      duration?: number;
    }
  | { type: "setSpeechBubble"; text: string | null; tone: BubbleTone }
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "setVariant"; variantId: VariantId };

export type CommandValidationResult =
  { ok: true; command: ValidatedCommand } | { ok: false; reason: string };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function duration(value: unknown, min: number, max: number) {
  const numeric = finiteNumber(value);
  return numeric === undefined ? undefined : clamp(numeric, min, max);
}

function isAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export function validateCommand(raw: RawCommand): CommandValidationResult {
  if (typeof raw.type !== "string") {
    return { ok: false, reason: "Command missing type" };
  }

  switch (raw.type) {
    case "show":
    case "hide":
    case "clearAction":
      return { ok: true, command: { type: raw.type } };
    case "setMood":
      if (!isAllowed(raw.mood, VALID_MOODS)) {
        return { ok: false, reason: `Unknown mood "${String(raw.mood)}"` };
      }
      return {
        ok: true,
        command: {
          type: "setMood",
          mood: raw.mood,
          duration: duration(raw.duration, 0, 5),
        },
      };
    case "triggerAction":
      if (!isAllowed(raw.action, VALID_ACTIONS)) {
        return {
          ok: false,
          reason: `Unknown action "${String(raw.action)}"`,
        };
      }
      return {
        ok: true,
        command: {
          type: "triggerAction",
          action: raw.action,
          duration: duration(raw.duration, 0.2, 5),
        },
      };
    case "setHeadPose": {
      const yaw = finiteNumber(raw.yawDegrees);
      const pitch = finiteNumber(raw.pitchDegrees);
      return {
        ok: true,
        command: {
          type: "setHeadPose",
          yawDegrees: yaw === undefined ? undefined : clamp(yaw, -35, 35),
          pitchDegrees: pitch === undefined ? undefined : clamp(pitch, -20, 20),
          duration: duration(raw.duration, 0.05, 2),
        },
      };
    }
    case "setSpeechBubble": {
      if (raw.tone !== undefined && !isAllowed(raw.tone, VALID_TONES)) {
        return { ok: false, reason: `Unknown tone "${String(raw.tone)}"` };
      }
      const text =
        typeof raw.text === "string"
          ? raw.text.trim().slice(0, MAX_BUBBLE_CHARACTERS)
          : "";
      return {
        ok: true,
        command: {
          type: "setSpeechBubble",
          text: text.length > 0 ? text : null,
          tone: raw.tone ?? "default",
        },
      };
    }
    case "setTheme":
      if (!isAllowed(raw.themeId, VALID_THEMES)) {
        return {
          ok: false,
          reason: `Unknown theme "${String(raw.themeId)}"`,
        };
      }
      return { ok: true, command: { type: "setTheme", themeId: raw.themeId } };
    case "setVariant":
      if (!isAllowed(raw.variantId, VALID_VARIANTS)) {
        return {
          ok: false,
          reason: `Unknown variant "${String(raw.variantId)}"`,
        };
      }
      return {
        ok: true,
        command: { type: "setVariant", variantId: raw.variantId },
      };
    default:
      return { ok: false, reason: `Unknown command type "${raw.type}"` };
  }
}
