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
} from "@vokality/ragdoll-extensions/core";
import {
  PomodoroManager,
  createPomodoroManager,
  type PomodoroState,
  type PomodoroPhase,
  type PomodoroEvent,
  type PomodoroEventCallback,
} from "./pomodoro-manager.js";
import { createSlotState } from "@vokality/ragdoll-extensions/ui/state";

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
  const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return undefined;
  };

  const sessionDuration = coerceNumber(args.sessionDuration);
  if (args.sessionDuration !== undefined) {
    if (sessionDuration === undefined || !VALID_SESSION_DURATIONS.includes(sessionDuration as SessionDuration)) {
      return {
        valid: false,
        error: `Invalid sessionDuration '${args.sessionDuration}'. Valid: ${VALID_SESSION_DURATIONS.join(", ")} minutes`,
      };
    }
    args.sessionDuration = sessionDuration;
  }

  const breakDuration = coerceNumber(args.breakDuration);
  if (args.breakDuration !== undefined) {
    if (breakDuration === undefined || !VALID_BREAK_DURATIONS.includes(breakDuration as BreakDuration)) {
      return {
        valid: false,
        error: `Invalid breakDuration '${args.breakDuration}'. Valid: ${VALID_BREAK_DURATIONS.join(", ")} minutes`,
      };
    }
    args.breakDuration = breakDuration;
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

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const deriveSlotState = (state: PomodoroStateData) => {
    const { state: phase, remainingTime, isBreak, sessionsCompleted: completed = 0 } = state;
    const remainingMs = remainingTime * 1000;
    const badge = phase === "running" || phase === "paused" ? formatTime(remainingMs) : null;

    const items: any[] = [];

    const getPhaseLabel = (): string => {
      if (isBreak) {
        return phase === "running" ? "Break time" : "Break paused";
      }
      switch (phase) {
        case "running":
          return "Focus time";
        case "paused":
          return "Paused";
        case "idle":
          return "Ready to start";
        default:
          return "Timer";
      }
    };

    const getPhaseStatus = (): string => {
      if (phase === "running") {
        return isBreak ? "success" : "active";
      }
      if (phase === "paused") {
        return "warning";
      }
      return "default";
    };

    items.push({
      id: "status",
      label: getPhaseLabel(),
      sublabel: phase !== "idle" ? `${formatTime(remainingMs)} remaining` : `${manager.getSessionDurationMinutes()} min session`,
      status: getPhaseStatus(),
    });

    if (completed > 0) {
      items.push({
        id: "sessions",
        label: `${completed} session${completed === 1 ? "" : "s"} completed`,
        status: "success",
      });
    }

    const actions: any[] = [];

    if (phase === "idle") {
      actions.push({
        id: "start",
        label: "Start Focus",
        variant: "primary",
        onClick: () => {
          manager.start();
        },
      });
    } else if (phase === "running") {
      actions.push({
        id: "pause",
        label: "Pause",
        variant: "secondary",
        onClick: () => {
          manager.pause();
        },
      });
      actions.push({
        id: "reset",
        label: "Reset",
        variant: "danger",
        onClick: () => {
          manager.reset();
        },
      });
    } else if (phase === "paused") {
      actions.push({
        id: "resume",
        label: "Resume",
        variant: "primary",
        onClick: () => {
          manager.start();
        },
      });
      actions.push({
        id: "reset",
        label: "Reset",
        variant: "danger",
        onClick: () => {
          manager.reset();
        },
      });
    }

    return {
      badge,
      visible: true,
      panel: {
        type: "list" as const,
        title: isBreak ? "Break Time" : "Focus Timer",
        items,
        actions,
      },
    };
  };

  const slotState = createSlotState(deriveSlotState(mapPomodoroState(manager)));
  const unsubscribeSlot = manager.onStateChange(() => {
    slotState.replaceState(deriveSlotState(mapPomodoroState(manager)));
  });

  return {
    tools: createPomodoroTools(handler),
    stateChannels: [stateChannel],
    slots: [
      {
        id: `${extensionId}.main`,
        label: "Timer",
        icon: "timer",
        priority: 90,
        state: slotState,
      },
    ],
    dispose: () => {
      unsubscribe();
      unsubscribeSlot();
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
