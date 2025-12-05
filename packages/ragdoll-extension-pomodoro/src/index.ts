/**
 * Pomodoro Extension - Provides timer tools for focused work sessions.
 *
 * Tools:
 * - startPomodoro: Start a pomodoro timer session
 * - pausePomodoro: Pause the active pomodoro timer
 * - resetPomodoro: Reset/stop the pomodoro timer
 * - getPomodoroState: Get the current pomodoro timer state
 */

import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionStateChannel,
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions";
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

const DEFAULT_SESSION_DURATION: SessionDuration = 30;
const DEFAULT_BREAK_DURATION: BreakDuration = 5;

function mapPomodoroState(manager: PomodoroManager): PomodoroStateData {
  const state = manager.getState();
  return {
    state: state.phase,
    remainingTime: manager.getRemainingSeconds(),
    sessionDuration: manager.getSessionDurationMinutes(),
    breakDuration: manager.getBreakDurationMinutes(),
    isBreak: state.isBreak,
    sessionsCompleted: state.sessionsCompleted,
  } satisfies PomodoroStateData;
}

const DEFAULT_EXTENSION_ID = "pomodoro";

export interface PomodoroRuntimeOptions {
  /** Override the extension identifier (default: "pomodoro") */
  extensionId?: string;
  /** Default focus session duration */
  sessionDuration?: SessionDuration;
  /** Default break duration */
  breakDuration?: BreakDuration;
}

export function createRuntime(
  options: PomodoroRuntimeOptions | undefined,
  host: ExtensionHostEnvironment
): ExtensionRuntimeContribution {
  const extensionId = options?.extensionId ?? DEFAULT_EXTENSION_ID;
  const sessionDuration = options?.sessionDuration ?? DEFAULT_SESSION_DURATION;
  const breakDuration = options?.breakDuration ?? DEFAULT_BREAK_DURATION;

  const manager = createPomodoroManager(sessionDuration, breakDuration);
  const stateListeners = new Set<(state: PomodoroStateData) => void>();

  const notify = (state: PomodoroStateData): void => {
    for (const listener of stateListeners) {
      listener(state);
    }
  };

  const unsubscribe = manager.onStateChange((event) => {
    const mapped = mapPomodoroState(manager);
    notify(mapped);
    if (event.type === "pomodoro:session-complete") {
      host.notifications?.({
        title: "🍅 Focus session complete",
        body: "Great work! Enjoy your break.",
      });
    } else if (event.type === "pomodoro:break-complete") {
      host.notifications?.({
        title: "🍅 Break over",
        body: "Ready for another session?",
      });
    }
  });

  const handler: PomodoroToolHandler = {
    startPomodoro: ({ sessionDuration: sd, breakDuration: bd }) => {
      manager.start(sd, bd);
      return { success: true, data: mapPomodoroState(manager) };
    },
    pausePomodoro: () => {
      manager.pause();
      return { success: true, data: mapPomodoroState(manager) };
    },
    resetPomodoro: () => {
      manager.reset();
      return { success: true, data: mapPomodoroState(manager) };
    },
    getPomodoroState: () => {
      return { success: true, data: mapPomodoroState(manager) };
    },
  };

  const stateChannel: ExtensionStateChannel<PomodoroStateData> = {
    id: `${extensionId}:state`,
    description: "Pomodoro timer state",
    getState: () => mapPomodoroState(manager),
    subscribe: (listener: (state: PomodoroStateData) => void) => {
      stateListeners.add(listener);
      listener(mapPomodoroState(manager));
      return () => stateListeners.delete(listener);
    },
  };

  return {
    tools: createPomodoroTools(handler),
    stateChannels: [stateChannel],
    dispose: () => {
      unsubscribe();
      stateListeners.clear();
      manager.destroy();
    },
  };
}

export { createRuntime as createPomodoroRuntime };
// NOTE: UI exports removed to avoid pulling React into main process
// export { createPomodoroUISlot, type PomodoroUISlotOptions } from "./ui.js";

import {
  createExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions/core";

/**
 * Create the pomodoro extension.
 */
function createPomodoroExtension(config?: Record<string, unknown>): RagdollExtension {
  return createExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Pomodoro Timer",
    version: "0.1.0",
    description: "Pomodoro-style focus sessions and notifications",
    createRuntime: (host, _context) => createRuntime(config as PomodoroRuntimeOptions | undefined, host),
  });
}

export { createPomodoroExtension as createExtension };
export default createPomodoroExtension;
