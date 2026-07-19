/**
 * Character Extension - Provides facial expression and animation tools.
 *
 * Tools:
 * - setMood: Set the character's facial mood/expression
 * - triggerAction: Trigger actions like wink, talk, shake
 * - setHeadPose: Rotate the character's head
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

export type CharacterMood = (typeof VALID_MOODS)[number];
export type CharacterAction = (typeof VALID_ACTIONS)[number];

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
      return {
        valid: false,
        error: "duration must be a number between 0 and 5",
      };
    }
  }
  return { valid: true };
}

function validateTriggerAction(
  args: Record<string, unknown>,
): ValidationResult {
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
      return {
        valid: false,
        error: "duration must be a number between 0.2 and 5",
      };
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
      handler: (args: Record<string, unknown>, _ctx) =>
        handler.setMood(args as unknown as SetMoodArgs),
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
      handler: (args, _ctx) =>
        handler.triggerAction(args as unknown as TriggerActionArgs),
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
      handler: (args, _ctx) =>
        handler.setHeadPose(args as unknown as SetHeadPoseArgs),
      validate: validateSetHeadPose,
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

import {
  createExtension as defineExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions";

const DEFAULT_EXTENSION_ID = "character";
const CHARACTER_IPC_CHANNEL = `extension-tool:${DEFAULT_EXTENSION_ID}`;

/**
 * Create runtime contributions for the character extension.
 */
function createRuntime(
  host: ExtensionHostEnvironment,
): ExtensionRuntimeContribution {
  const ipc = host.ipc;
  if (!ipc) throw new Error("Character requires the host IPC capability");

  const forward = (
    methodName: string,
    args: Record<string, unknown>,
  ): ToolResult => {
    ipc.publish(CHARACTER_IPC_CHANNEL, {
      extensionId: DEFAULT_EXTENSION_ID,
      tool: methodName,
      args,
    });
    return { success: true, data: { forwarded: true } };
  };

  const handler: CharacterToolHandler = {
    setMood: (args) =>
      forward("setMood", args as unknown as Record<string, unknown>),
    triggerAction: (args) =>
      forward("triggerAction", args as unknown as Record<string, unknown>),
    setHeadPose: (args) =>
      forward("setHeadPose", args as unknown as Record<string, unknown>),
  };

  return {
    tools: createCharacterTools(handler),
  };
}

/**
 * Create the character extension.
 */
export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Character",
    version: "0.1.0",
    description: "Facial expressions and animations",
    requiredCapabilities: ["ipc"],
    optionalCapabilities: [],
    createRuntime: (host) => createRuntime(host),
  });
}
