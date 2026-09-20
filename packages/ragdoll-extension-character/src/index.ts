/**
 * Character Extension - Provides facial expression and animation tools.
 *
 * Tools:
 * - setMood: Set the character's facial mood/expression
 * - triggerAction: Trigger actions like wink, talk, shake
 * - setHeadPose: Rotate the character's head
 * - setExpression: Patch facial axes on top of the current mood
 * - resetExpression: Hand patched axes back to the current mood
 * - clearAction: Stop the running action early
 * - getCharacterState: Read the mood, action, head pose, and patched axes
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

export const EXPRESSION_AXES = [
  "smile",
  "frown",
  "brows",
  "eyesOpen",
  "jaw",
  "gazeX",
  "gazeY",
] as const;

export type CharacterMood = (typeof VALID_MOODS)[number];
export type CharacterAction = (typeof VALID_ACTIONS)[number];
export type CharacterExpressionAxis = (typeof EXPRESSION_AXES)[number];

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

export interface ResetExpressionArgs {
  axes?: CharacterExpressionAxis[];
  duration?: number;
}

/** What the renderer reports back for getCharacterState. */
export interface CharacterStateSnapshot {
  mood: CharacterMood;
  action: CharacterAction | null;
  headPose: { yawDegrees: number; pitchDegrees: number };
  /** Axes currently patched by setExpression; everything else follows the mood. */
  expression: Partial<Record<CharacterExpressionAxis, number>>;
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
  resetExpression(args: ResetExpressionArgs): Promise<ToolResult> | ToolResult;
  clearAction(): Promise<ToolResult> | ToolResult;
  getCharacterState(): Promise<ToolResult> | ToolResult;
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

function parseResetExpression(
  args: Record<string, unknown>,
): ResetExpressionArgs {
  const parsed: ResetExpressionArgs = {};
  if (args.axes !== undefined) {
    if (!Array.isArray(args.axes)) throw new Error("axes must be an array");
    parsed.axes = args.axes.map((value) => {
      const axis = EXPRESSION_AXES.find((candidate) => candidate === value);
      if (!axis)
        throw new Error(`Invalid axis. Valid: ${EXPRESSION_AXES.join(", ")}`);
      return axis;
    });
  }
  const duration = optionalNumber(args.duration, "duration", 0, 5);
  if (duration !== undefined) parsed.duration = duration;
  return parsed;
}

/**
 * The command contract between the tools and whatever renders the character.
 * Hosts parse a forwarded call with `parseCharacterCommand` instead of
 * re-declaring the argument shapes and ranges.
 */
export type CharacterCommand =
  | { tool: "setMood"; args: SetMoodArgs }
  | { tool: "triggerAction"; args: TriggerActionArgs }
  | { tool: "setHeadPose"; args: SetHeadPoseArgs }
  | { tool: "setExpression"; args: SetExpressionArgs }
  | { tool: "resetExpression"; args: ResetExpressionArgs }
  | { tool: "clearAction"; args: Record<string, never> }
  | { tool: "getCharacterState"; args: { requestId: string } };

export function parseCharacterCommand(
  tool: string,
  args: Record<string, unknown>,
): CharacterCommand {
  switch (tool) {
    case "setMood":
      return { tool, args: parseSetMood(args) };
    case "triggerAction":
      return { tool, args: parseTriggerAction(args) };
    case "setHeadPose":
      return { tool, args: parseSetHeadPose(args) };
    case "setExpression":
      return { tool, args: parseSetExpression(args) };
    case "resetExpression":
      return { tool, args: parseResetExpression(args) };
    case "clearAction":
      return { tool, args: {} };
    case "getCharacterState": {
      const requestId = args.requestId;
      if (typeof requestId !== "string" || requestId.length === 0)
        throw new Error("requestId must be a non-empty string");
      return { tool, args: { requestId } };
    }
    default:
      throw new Error(`Unsupported character command: ${tool}`);
  }
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
    {
      definition: {
        type: "function",
        function: {
          name: "resetExpression",
          description:
            "Hand setExpression axes back to the current mood, so the mood's own face and baked glance show again. Omit axes to release all of them, including gaze. Use this instead of writing 0, which keeps owning the axis at none.",
          parameters: {
            type: "object",
            properties: {
              axes: {
                type: "array",
                items: { type: "string", enum: [...EXPRESSION_AXES] },
                description: "Axes to release. Omit to release every axis.",
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
      handler: (args, _ctx) =>
        handler.resetExpression(parseResetExpression(args)),
      validate: (args) => validateArguments(parseResetExpression, args),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "clearAction",
          description:
            "Stop the running wink, talk, or shake now instead of waiting for its duration. Does nothing when no action is running.",
          parameters: { type: "object", properties: {} },
        },
      },
      handler: () => handler.clearAction(),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "getCharacterState",
          description:
            "Read the character's current mood, running action, head pose in degrees, and the axes setExpression currently owns. Call it before adjusting a look you did not set this turn.",
          parameters: { type: "object", properties: {} },
        },
      },
      handler: () => handler.getCharacterState(),
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

const DEFAULT_EXTENSION_ID = "character";
const CHARACTER_IPC_CHANNEL = `extension-tool:${DEFAULT_EXTENSION_ID}`;
/** The host publishes the renderer's answer to a state request here. */
export const CHARACTER_STATE_TOPIC = `${DEFAULT_EXTENSION_ID}:state`;
const STATE_REPLY_TIMEOUT_MS = 2000;

function isStateReply(
  payload: unknown,
): payload is { requestId: string; state: CharacterStateSnapshot } {
  if (typeof payload !== "object" || payload === null) return false;
  const requestId = Reflect.get(payload, "requestId");
  const state = Reflect.get(payload, "state");
  return (
    typeof requestId === "string" && typeof state === "object" && state !== null
  );
}

/**
 * Create runtime contributions for the character extension.
 */
function createRuntime(
  host: ExtensionHostEnvironment,
): ExtensionRuntimeContribution {
  const ipc = host.ipc;
  const timers = host.timers;
  if (!ipc || !timers)
    throw new Error("Character requires the ipc and timers host capabilities");

  const forward = (command: CharacterCommand): ToolResult => {
    ipc.publish(CHARACTER_IPC_CHANNEL, {
      extensionId: DEFAULT_EXTENSION_ID,
      tool: command.tool,
      args: { ...command.args },
    });
    return { success: true, data: { forwarded: true } };
  };

  // The face lives in the renderer. A read travels the same ordered route as
  // the commands, so it sees every command issued before it.
  const pendingReads = new Map<string, (result: ToolResult) => void>();
  let reads = 0;
  const unsubscribe = ipc.subscribe(CHARACTER_STATE_TOPIC, (payload) => {
    if (!isStateReply(payload)) return;
    pendingReads.get(payload.requestId)?.({
      success: true,
      data: { ...payload.state },
    });
  });
  const readState = (): Promise<ToolResult> =>
    new Promise((resolve) => {
      const requestId = `state-${(reads += 1)}`;
      const timeout = timers.setTimeout(
        () =>
          settle({
            success: false,
            error: "The character is not on screen right now.",
            retryable: false,
          }),
        STATE_REPLY_TIMEOUT_MS,
      );
      const settle = (result: ToolResult): void => {
        if (!pendingReads.delete(requestId)) return;
        timers.clearTimeout(timeout);
        resolve(result);
      };
      pendingReads.set(requestId, settle);
      forward({ tool: "getCharacterState", args: { requestId } });
    });

  const handler: CharacterToolHandler = {
    setMood: (args) => forward({ tool: "setMood", args }),
    triggerAction: (args) => forward({ tool: "triggerAction", args }),
    setHeadPose: (args) => forward({ tool: "setHeadPose", args }),
    setExpression: (args) => forward({ tool: "setExpression", args }),
    resetExpression: (args) => forward({ tool: "resetExpression", args }),
    clearAction: () => forward({ tool: "clearAction", args: {} }),
    getCharacterState: readState,
  };

  return {
    tools: createCharacterTools(handler),
    dispose: () => {
      unsubscribe();
      for (const settle of [...pendingReads.values()]) {
        settle({
          success: false,
          error: "The character extension was unloaded.",
          retryable: false,
        });
      }
    },
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
    requiredCapabilities: ["ipc", "timers"],
    optionalCapabilities: [],
    createRuntime: (host) => createRuntime(host),
  });
}
