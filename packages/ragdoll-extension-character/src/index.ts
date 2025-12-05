/**
 * Character Extension - Provides facial expression and animation tools.
 *
 * Tools:
 * - setMood: Set the character's facial mood/expression
 * - triggerAction: Trigger actions like wink, talk, shake
 * - setHeadPose: Rotate the character's head
 * - setSpeechBubble: Show or clear speech bubble text
 */

import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions";

// =============================================================================
// Constants
// =============================================================================

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
] as const;

export const VALID_ACTIONS = ["wink", "talk", "shake"] as const;

export const VALID_TONES = ["default", "whisper", "shout"] as const;

export type CharacterMood = (typeof VALID_MOODS)[number];
export type CharacterAction = (typeof VALID_ACTIONS)[number];
export type BubbleTone = (typeof VALID_TONES)[number];

// =============================================================================
// Tool Argument Types
// =============================================================================

export interface SetMoodArgs {
  mood: CharacterMood;
  duration?: number;
}

export interface TriggerActionArgs {
  action: CharacterAction;
  duration?: number;
}

export interface SetHeadPoseArgs {
  yawDegrees?: number;
  pitchDegrees?: number;
  duration?: number;
}

export interface SetSpeechBubbleArgs {
  text?: string | null;
  tone?: BubbleTone;
}

// =============================================================================
// Handler Type
// =============================================================================

/**
 * Handler interface for character tool execution.
 * Consumers must provide this to actually control the character.
 */
export interface CharacterToolHandler {
  setMood(args: SetMoodArgs): Promise<ToolResult> | ToolResult;
  triggerAction(args: TriggerActionArgs): Promise<ToolResult> | ToolResult;
  setHeadPose(args: SetHeadPoseArgs): Promise<ToolResult> | ToolResult;
  setSpeechBubble(args: SetSpeechBubbleArgs): Promise<ToolResult> | ToolResult;
}

// =============================================================================
// Validators
// =============================================================================

function validateSetMood(args: Record<string, unknown>): ValidationResult {
  const mood = args.mood;
  if (!mood || typeof mood !== "string") {
    return { valid: false, error: "mood is required and must be a string" };
  }
  if (!VALID_MOODS.includes(mood as CharacterMood)) {
    return {
      valid: false,
      error: `Invalid mood '${mood}'. Valid: ${VALID_MOODS.join(", ")}`,
    };
  }
  if (args.duration !== undefined) {
    const d = args.duration;
    if (typeof d !== "number" || d < 0 || d > 5) {
      return { valid: false, error: "duration must be a number between 0 and 5" };
    }
  }
  return { valid: true };
}

function validateTriggerAction(args: Record<string, unknown>): ValidationResult {
  const action = args.action;
  if (!action || typeof action !== "string") {
    return { valid: false, error: "action is required and must be a string" };
  }
  if (!VALID_ACTIONS.includes(action as CharacterAction)) {
    return {
      valid: false,
      error: `Invalid action '${action}'. Valid: ${VALID_ACTIONS.join(", ")}`,
    };
  }
  if (args.duration !== undefined) {
    const d = args.duration;
    if (typeof d !== "number" || d < 0.2 || d > 5) {
      return { valid: false, error: "duration must be a number between 0.2 and 5" };
    }
  }
  return { valid: true };
}

function validateSetHeadPose(args: Record<string, unknown>): ValidationResult {
  if (args.yawDegrees !== undefined) {
    const y = args.yawDegrees;
    if (typeof y !== "number" || y < -35 || y > 35) {
      return { valid: false, error: "yawDegrees must be between -35 and 35" };
    }
  }
  if (args.pitchDegrees !== undefined) {
    const p = args.pitchDegrees;
    if (typeof p !== "number" || p < -20 || p > 20) {
      return { valid: false, error: "pitchDegrees must be between -20 and 20" };
    }
  }
  if (args.duration !== undefined) {
    const d = args.duration;
    if (typeof d !== "number" || d < 0.1 || d > 2) {
      return { valid: false, error: "duration must be between 0.1 and 2" };
    }
  }
  return { valid: true };
}

function validateSetSpeechBubble(args: Record<string, unknown>): ValidationResult {
  if (args.text !== undefined && args.text !== null) {
    if (typeof args.text !== "string") {
      return { valid: false, error: "text must be a string or null" };
    }
    if (args.text.length > 240) {
      return { valid: false, error: "text must be 240 characters or less" };
    }
  }
  if (args.tone !== undefined) {
    if (!VALID_TONES.includes(args.tone as BubbleTone)) {
      return {
        valid: false,
        error: `Invalid tone '${args.tone}'. Valid: ${VALID_TONES.join(", ")}`,
      };
    }
  }
  return { valid: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

function createCharacterTools(handler: CharacterToolHandler): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "setMood",
          description: "Set the character's facial mood/expression",
          parameters: {
            type: "object",
            properties: {
              mood: {
                type: "string",
                enum: VALID_MOODS,
                description: "The mood to set",
              },
              duration: {
                type: "number",
                description: "Transition duration in seconds (0-5)",
                minimum: 0,
                maximum: 5,
              },
            },
            required: ["mood"],
          },
        },
      },
      handler: (args: Record<string, unknown>, _ctx) => handler.setMood(args as unknown as SetMoodArgs),
      validate: validateSetMood,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "triggerAction",
          description:
            "Trigger a facial action like wink, talk animation, or shake head",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: VALID_ACTIONS,
                description: "The action to trigger",
              },
              duration: {
                type: "number",
                description: "Action duration in seconds (0.2-5)",
                minimum: 0.2,
                maximum: 5,
              },
            },
            required: ["action"],
          },
        },
      },
      handler: (args, _ctx) => handler.triggerAction(args as unknown as TriggerActionArgs),
      validate: validateTriggerAction,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "setHeadPose",
          description: "Rotate the character's head",
          parameters: {
            type: "object",
            properties: {
              yawDegrees: {
                type: "number",
                description: "Horizontal rotation in degrees (-35 to 35)",
                minimum: -35,
                maximum: 35,
              },
              pitchDegrees: {
                type: "number",
                description: "Vertical rotation in degrees (-20 to 20)",
                minimum: -20,
                maximum: 20,
              },
              duration: {
                type: "number",
                description: "Transition duration in seconds",
                minimum: 0.1,
                maximum: 2,
              },
            },
          },
        },
      },
      handler: (args, _ctx) => handler.setHeadPose(args as unknown as SetHeadPoseArgs),
      validate: validateSetHeadPose,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "setSpeechBubble",
          description:
            "Override the speech bubble with specific text and tone (use sparingly, normally the response text is shown)",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text to show (null to clear)",
                maxLength: 240,
              },
              tone: {
                type: "string",
                enum: VALID_TONES,
                description: "The tone of the bubble",
              },
            },
          },
        },
      },
      handler: (args, _ctx) => handler.setSpeechBubble(args as unknown as SetSpeechBubbleArgs),
      validate: validateSetSpeechBubble,
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

const DEFAULT_EXTENSION_ID = "character";

export interface CharacterRuntimeOptions {
  /** Override the channel used for IPC forwarding (default: extension-tool:<id>) */
  channelId?: string;
  /** Override the extension id included in forwarded payloads */
  extensionId?: string;
}

/**
 * Create runtime contributions for the character extension.
 */
export function createRuntime(
  options: CharacterRuntimeOptions | undefined,
  host: ExtensionHostEnvironment
): ExtensionRuntimeContribution {
  const extensionId = options?.extensionId ?? DEFAULT_EXTENSION_ID;
  const channelId = options?.channelId ?? `extension-tool:${extensionId}`;

  const forward = (methodName: string, args: Record<string, unknown>): ToolResult => {
    if (!host.ipc?.publish) {
      return { success: false, error: "Host IPC capability is not available" };
    }
    host.logger?.debug?.(`[${extensionId}] forwarding tool '${methodName}'`);
    host.ipc.publish(channelId, {
      extensionId,
      tool: methodName,
      args,
    });
    return { success: true, data: { forwarded: true } };
  };

  const handler: CharacterToolHandler = {
    setMood: (args) => forward("setMood", args as unknown as Record<string, unknown>),
    triggerAction: (args) =>
      forward("triggerAction", args as unknown as Record<string, unknown>),
    setHeadPose: (args) => forward("setHeadPose", args as unknown as Record<string, unknown>),
    setSpeechBubble: (args) =>
      forward("setSpeechBubble", args as unknown as Record<string, unknown>),
  };

  return {
    tools: createCharacterTools(handler),
  };
}

export { createRuntime as createCharacterRuntime };
export default createRuntime;
