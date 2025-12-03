/**
 * Pomodoro Extension - Provides timer tools for focused work sessions.
 *
 * Tools:
 * - startPomodoro: Start a pomodoro timer session
 * - pausePomodoro: Pause the active pomodoro timer
 * - resetPomodoro: Reset/stop the pomodoro timer
 * - getPomodoroState: Get the current pomodoro timer state
 */

import { createExtension } from "../../create-extension.js";
import type {
  RagdollExtension,
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "../../types.js";
import {
  PomodoroManager,
  createPomodoroManager,
  type PomodoroState,
  type PomodoroPhase,
  type PomodoroEvent,
  type PomodoroEventCallback,
} from "./pomodoro-manager.js";

// =============================================================================
// Constants
// =============================================================================

export const VALID_SESSION_DURATIONS = [5, 15, 30, 60, 120] as const;
export const VALID_BREAK_DURATIONS = [5, 10, 15, 30] as const;

export type SessionDuration = (typeof VALID_SESSION_DURATIONS)[number];
export type BreakDuration = (typeof VALID_BREAK_DURATIONS)[number];

// Re-export types from pomodoro-manager
export type { PomodoroState, PomodoroPhase, PomodoroEvent, PomodoroEventCallback };
export { PomodoroManager, createPomodoroManager };

// =============================================================================
// Tool Argument Types
// =============================================================================

export interface StartPomodoroArgs {
  sessionDuration?: SessionDuration;
  breakDuration?: BreakDuration;
}

// pausePomodoro, resetPomodoro, getPomodoroState have no arguments
export type PausePomodoroArgs = Record<string, never>;
export type ResetPomodoroArgs = Record<string, never>;
export type GetPomodoroStateArgs = Record<string, never>;

// =============================================================================
// State Types
// =============================================================================

export interface PomodoroStateData {
  state: "idle" | "running" | "paused" | "break";
  remainingTime: number;
  sessionDuration: number;
  breakDuration: number;
  isBreak: boolean;
  sessionsCompleted?: number;
}

// =============================================================================
// Handler Type
// =============================================================================

/**
 * Handler interface for pomodoro tool execution.
 * Consumers must provide this to actually control the timer.
 */
export interface PomodoroToolHandler {
  startPomodoro(args: StartPomodoroArgs): Promise<ToolResult> | ToolResult;
  pausePomodoro(args: PausePomodoroArgs): Promise<ToolResult> | ToolResult;
  resetPomodoro(args: ResetPomodoroArgs): Promise<ToolResult> | ToolResult;
  getPomodoroState(args: GetPomodoroStateArgs): Promise<ToolResult> | ToolResult;
}

// =============================================================================
// Validators
// =============================================================================

function validateStartPomodoro(args: Record<string, unknown>): ValidationResult {
  if (args.sessionDuration !== undefined) {
    const sd = args.sessionDuration;
    if (
      typeof sd !== "number" ||
      !VALID_SESSION_DURATIONS.includes(sd as SessionDuration)
    ) {
      return {
        valid: false,
        error: `Invalid sessionDuration '${sd}'. Valid: ${VALID_SESSION_DURATIONS.join(", ")} minutes`,
      };
    }
  }
  if (args.breakDuration !== undefined) {
    const bd = args.breakDuration;
    if (
      typeof bd !== "number" ||
      !VALID_BREAK_DURATIONS.includes(bd as BreakDuration)
    ) {
      return {
        valid: false,
        error: `Invalid breakDuration '${bd}'. Valid: ${VALID_BREAK_DURATIONS.join(", ")} minutes`,
      };
    }
  }
  return { valid: true };
}

// No validation needed for no-arg tools
function validateNoArgs(): ValidationResult {
  return { valid: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

function createPomodoroTools(handler: PomodoroToolHandler): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "startPomodoro",
          description: "Start a pomodoro timer session for focused work",
          parameters: {
            type: "object",
            properties: {
              sessionDuration: {
                type: "number",
                enum: VALID_SESSION_DURATIONS,
                description: "Session duration in minutes",
              },
              breakDuration: {
                type: "number",
                enum: VALID_BREAK_DURATIONS,
                description: "Break duration in minutes",
              },
            },
          },
        },
      },
      handler: (args, _ctx) => handler.startPomodoro(args as StartPomodoroArgs),
      validate: validateStartPomodoro,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "pausePomodoro",
          description: "Pause the active pomodoro timer",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.pausePomodoro({}),
      validate: validateNoArgs,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "resetPomodoro",
          description: "Reset/stop the pomodoro timer",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.resetPomodoro({}),
      validate: validateNoArgs,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "getPomodoroState",
          description: "Get the current pomodoro timer state",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.getPomodoroState({}),
      validate: validateNoArgs,
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

export interface PomodoroExtensionOptions {
  /** Handler that executes the pomodoro tools */
  handler: PomodoroToolHandler;
  /** Optional extension ID override (default: "pomodoro") */
  id?: string;
}

/**
 * Create a pomodoro extension with the provided handler.
 *
 * @example
 * ```ts
 * const pomodoroExtension = createPomodoroExtension({
 *   handler: {
 *     startPomodoro: async ({ sessionDuration, breakDuration }) => {
 *       pomodoroController.start(sessionDuration, breakDuration);
 *       return { success: true };
 *     },
 *     pausePomodoro: async () => {
 *       pomodoroController.pause();
 *       return { success: true };
 *     },
 *     resetPomodoro: async () => {
 *       pomodoroController.reset();
 *       return { success: true };
 *     },
 *     getPomodoroState: async () => {
 *       const state = pomodoroController.getState();
 *       return { success: true, data: state };
 *     },
 *   },
 * });
 *
 * await registry.register(pomodoroExtension);
 * ```
 */
export function createPomodoroExtension(
  options: PomodoroExtensionOptions
): RagdollExtension {
  const { handler, id = "pomodoro" } = options;

  return createExtension({
    id,
    name: "Pomodoro Timer",
    version: "1.0.0",
    tools: createPomodoroTools(handler),
  });
}

// =============================================================================
// Stateful Extension Factory
// =============================================================================

export interface StatefulPomodoroExtensionOptions {
  /** Optional extension ID override (default: "pomodoro") */
  id?: string;
  /** Initial session duration in minutes */
  sessionDuration?: SessionDuration;
  /** Initial break duration in minutes */
  breakDuration?: BreakDuration;
  /** Callback when pomodoro state changes (for persistence/sync) */
  onStateChange?: PomodoroEventCallback;
}

/**
 * Create a stateful pomodoro extension with built-in PomodoroManager.
 *
 * This version manages timer state internally and provides callbacks
 * for UI sync and notifications.
 *
 * @example
 * ```ts
 * const { extension, manager } = createStatefulPomodoroExtension({
 *   sessionDuration: 30,
 *   breakDuration: 5,
 *   onStateChange: (event) => {
 *     // Notify renderer of state change
 *     mainWindow?.webContents.send("pomodoro:state-changed", event.state);
 *
 *     // Show notification on session complete
 *     if (event.type === "pomodoro:session-complete") {
 *       new Notification({ title: "Pomodoro Complete!" }).show();
 *     }
 *   },
 * });
 *
 * await registry.register(extension);
 * ```
 */
export function createStatefulPomodoroExtension(
  options: StatefulPomodoroExtensionOptions = {}
): { extension: RagdollExtension; manager: PomodoroManager } {
  const {
    id = "pomodoro",
    sessionDuration = 30,
    breakDuration = 5,
    onStateChange,
  } = options;

  // Create the manager
  const manager = createPomodoroManager(sessionDuration, breakDuration);

  // Subscribe to state changes if callback provided
  if (onStateChange) {
    manager.onStateChange(onStateChange);
  }

  // Create handler that uses the manager
  const handler: PomodoroToolHandler = {
    startPomodoro: ({ sessionDuration: sd, breakDuration: bd }) => {
      manager.start(sd, bd);
      const state = manager.getState();
      return {
        success: true,
        data: {
          state: state.phase,
          remainingTime: manager.getRemainingSeconds(),
          sessionDuration: manager.getSessionDurationMinutes(),
          breakDuration: manager.getBreakDurationMinutes(),
          isBreak: state.isBreak,
          sessionsCompleted: state.sessionsCompleted,
        } satisfies PomodoroStateData,
      };
    },

    pausePomodoro: () => {
      manager.pause();
      const state = manager.getState();
      return {
        success: true,
        data: {
          state: state.phase,
          remainingTime: manager.getRemainingSeconds(),
          sessionDuration: manager.getSessionDurationMinutes(),
          breakDuration: manager.getBreakDurationMinutes(),
          isBreak: state.isBreak,
          sessionsCompleted: state.sessionsCompleted,
        } satisfies PomodoroStateData,
      };
    },

    resetPomodoro: () => {
      manager.reset();
      const state = manager.getState();
      return {
        success: true,
        data: {
          state: state.phase,
          remainingTime: manager.getRemainingSeconds(),
          sessionDuration: manager.getSessionDurationMinutes(),
          breakDuration: manager.getBreakDurationMinutes(),
          isBreak: state.isBreak,
          sessionsCompleted: state.sessionsCompleted,
        } satisfies PomodoroStateData,
      };
    },

    getPomodoroState: () => {
      const state = manager.getState();
      return {
        success: true,
        data: {
          state: state.phase,
          remainingTime: manager.getRemainingSeconds(),
          sessionDuration: manager.getSessionDurationMinutes(),
          breakDuration: manager.getBreakDurationMinutes(),
          isBreak: state.isBreak,
          sessionsCompleted: state.sessionsCompleted,
        } satisfies PomodoroStateData,
      };
    },
  };

  const extension = createExtension({
    id,
    name: "Pomodoro Timer",
    version: "1.0.0",
    tools: createPomodoroTools(handler),
    onDestroy: () => {
      manager.destroy();
    },
  });

  return { extension, manager };
}

// Re-export for convenience
export { createExtension };
