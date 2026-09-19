/**
 * Character Extension - Provides facial expression and animation tools.
 *
 * Tools:
 * - setMood: Set the character's facial mood/expression
 * - triggerAction: Trigger actions like wink, talk, shake
 * - setHeadPose: Rotate the character's head
 * - setExpression: Patch facial axes on top of the current mood
 */

import {
  createExtension as defineExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions";
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

export interface SetExpressionArgs {
  smile?: number;
  frown?: number;
  brows?: number;
  eyesOpen?: number;
  jaw?: number;
  gazeX?: number;
  gazeY?: number;
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
  setExpression(args: SetExpressionArgs): Promise<ToolResult> | ToolResult;
}

// =============================================================================
// Validators
// =============================================================================

function optionalNumber(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be a finite number between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function parseSetMood(args: Record<string, unknown>): SetMoodArgs {
  const mood = VALID_MOODS.find((candidate) => candidate === args.mood);
  if (!mood) throw new Error(`Invalid mood. Valid: ${VALID_MOODS.join(", ")}`);
  return { mood, duration: optionalNumber(args.duration, "duration", 0, 5) };
}

function parseTriggerAction(args: Record<string, unknown>): TriggerActionArgs {
  const action = VALID_ACTIONS.find((candidate) => candidate === args.action);
  if (!action)
    throw new Error(`Invalid action. Valid: ${VALID_ACTIONS.join(", ")}`);
  return {
    action,
    duration: optionalNumber(args.duration, "duration", 0.2, 5),
  };
}

function parseSetHeadPose(args: Record<string, unknown>): SetHeadPoseArgs {
  return {
    yawDegrees: optionalNumber(args.yawDegrees, "yawDegrees", -35, 35),
    pitchDegrees: optionalNumber(args.pitchDegrees, "pitchDegrees", -20, 20),
    duration: optionalNumber(args.duration, "duration", 0.1, 2),
  };
}

const SET_EXPRESSION_FIELDS = [
  ["smile", 0, 1],
  ["frown", 0, 1],
  ["brows", -1, 1],
  ["eyesOpen", 0, 1.3],
  ["jaw", 0, 1],
  ["gazeX", -1, 1],
  ["gazeY", -1, 1],
  ["duration", 0, 5],
] as const satisfies ReadonlyArray<
  readonly [keyof SetExpressionArgs, number, number]
>;

function parseSetExpression(args: Record<string, unknown>): SetExpressionArgs {
  const parsed: SetExpressionArgs = {};
  for (const [name, minimum, maximum] of SET_EXPRESSION_FIELDS) {
    const value = optionalNumber(args[name], name, minimum, maximum);
    if (value !== undefined) parsed[name] = value;
  }
  return parsed;
}

function validateArguments<T>(
  parse: (args: Record<string, unknown>) => T,
  args: Record<string, unknown>,
): ValidationResult {
  try {
    parse(args);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
        handler.setMood(parseSetMood(args)),
      validate: (args) => validateArguments(parseSetMood, args),
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
      handler: (args, _ctx) => handler.triggerAction(parseTriggerAction(args)),
      validate: (args) => validateArguments(parseTriggerAction, args),
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
      handler: (args, _ctx) => handler.setHeadPose(parseSetHeadPose(args)),
      validate: (args) => validateArguments(parseSetHeadPose, args),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "setExpression",
          description:
            "Patch facial axes on top of the current mood. Owned axes replace mapped face channels; they are not added to the mood. Omit a field to leave that channel unchanged; pass 0 for none (gaze 0 is look-center, not inherit mood). Does not replace the named mood. Use setMood for named moods. If you also call setMood this turn, call setMood first. gazeX/gazeY move the eyes only and stay until the next gaze write; use setHeadPose to turn the skull. Host auto-thinking at the start of a turn clears smile/frown/brows/eyes/jaw — re-apply intensity this turn if it should persist. Do not pass morph names.",
          parameters: {
            type: "object",
            properties: {
              smile: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description:
                  "Smile intensity. Omit to leave unchanged; 0 is none.",
              },
              frown: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description:
                  "Frown intensity. Omit to leave unchanged; 0 is none.",
              },
              brows: {
                type: "number",
                minimum: -1,
                maximum: 1,
                description:
                  "Brow raise. -1 down, 0 rest, 1 up. Omit to leave unchanged.",
              },
              eyesOpen: {
                type: "number",
                minimum: 0,
                maximum: 1.3,
                description:
                  "Eyelid openness. 0 closed, 1 normal, 1.3 wide. Omit to leave unchanged.",
              },
              jaw: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description:
                  "Jaw opening. 0 closed, 1 fully open. Omit to leave unchanged.",
              },
              gazeX: {
                type: "number",
                minimum: -1,
                maximum: 1,
                description:
                  "Eye look, character's left to right. 0 is look-center (sticky until the next gaze write). Does not turn the skull or restore a mood-baked glance. Omit to leave unchanged.",
              },
              gazeY: {
                type: "number",
                minimum: -1,
                maximum: 1,
                description:
                  "Eye look, down to up. 0 is look-center (sticky). Does not turn the skull. Omit to leave unchanged.",
              },
              duration: {
                type: "number",
                minimum: 0,
                maximum: 5,
                description: "Transition seconds. 0 snaps. Omit for ~0.35s.",
              },
            },
          },
        },
      },
      handler: (args, _ctx) => handler.setExpression(parseSetExpression(args)),
      validate: (args) => validateArguments(parseSetExpression, args),
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

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
    setMood: (args) => forward("setMood", { ...args }),
    triggerAction: (args) => forward("triggerAction", { ...args }),
    setHeadPose: (args) => forward("setHeadPose", { ...args }),
    setExpression: (args) => forward("setExpression", { ...args }),
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
