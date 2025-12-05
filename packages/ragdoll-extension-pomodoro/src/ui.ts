/**
 * Pomodoro Extension UI Slot
 *
 * Provides a UI slot for the pomodoro extension that displays timer status
 * and controls in a panel.
 */

import {
  createDerivedSlotState,
  type ExtensionUISlot,
  type PanelAction,
  type SlotStateStore,
} from "@vokality/ragdoll-extensions/ui";
import type { PomodoroManager, PomodoroState, PomodoroPhase } from "./pomodoro-manager.js";

// =============================================================================
// Types
// =============================================================================

export interface PomodoroUISlotOptions {
  /** The pomodoro manager instance to derive state from */
  manager: PomodoroManager;
  /** Optional slot ID (default: "pomodoro.main") */
  id?: string;
  /** Optional slot label (default: "Timer") */
  label?: string;
  /** Optional slot priority (default: 90) */
  priority?: number;
  /** Whether to show the slot when idle (default: false) */
  showWhenIdle?: boolean;
}

export interface PomodoroUISlotResult {
  /** The UI slot definition */
  slot: ExtensionUISlot;
  /** The slot state store (for external subscriptions) */
  state: SlotStateStore;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getPhaseLabel(phase: PomodoroPhase, isBreak: boolean): string {
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
}

function getPhaseStatus(phase: PomodoroPhase, isBreak: boolean): "default" | "active" | "success" | "warning" {
  if (phase === "running") {
    return isBreak ? "success" : "active";
  }
  if (phase === "paused") {
    return "warning";
  }
  return "default";
}

// =============================================================================
// State Derivation
// =============================================================================

function deriveSlotState(
  pomodoroState: PomodoroState,
  manager: PomodoroManager,
  showWhenIdle: boolean
): {
  badge: number | string | null;
  visible: boolean;
  panel: {
    type: "list";
    title: string;
    emptyMessage?: string;
    items: Array<{
      id: string;
      label: string;
      sublabel?: string;
      status?: "default" | "active" | "success" | "warning" | "error";
    }>;
    actions?: PanelAction[];
  };
} {
  const { phase, remainingMs, isBreak, sessionsCompleted } = pomodoroState;

  // Badge shows time remaining when active
  const badge = phase === "running" || phase === "paused"
    ? formatTime(remainingMs)
    : null;

  // Visible when active or when showWhenIdle is true
  const visible = showWhenIdle || phase !== "idle";

  // Build panel items
  const items: Array<{
    id: string;
    label: string;
    sublabel?: string;
    status?: "default" | "active" | "success" | "warning" | "error";
  }> = [];

  // Current status item
  items.push({
    id: "status",
    label: getPhaseLabel(phase, isBreak),
    sublabel: phase !== "idle"
      ? `${formatTime(remainingMs)} remaining`
      : `${manager.getSessionDurationMinutes()} min session`,
    status: getPhaseStatus(phase, isBreak),
  });

  // Sessions completed
  if (sessionsCompleted > 0) {
    items.push({
      id: "sessions",
      label: `${sessionsCompleted} session${sessionsCompleted === 1 ? "" : "s"} completed`,
      status: "success",
    });
  }

  // Build actions based on state
  const actions: PanelAction[] = [];

  if (phase === "idle") {
    actions.push({
      id: "start",
      label: "Start Focus",
      variant: "primary",
      onClick: () => manager.start(),
    });
  } else if (phase === "running") {
    actions.push({
      id: "pause",
      label: "Pause",
      variant: "secondary",
      onClick: () => manager.pause(),
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => manager.reset(),
    });
  } else if (phase === "paused") {
    actions.push({
      id: "resume",
      label: "Resume",
      variant: "primary",
      onClick: () => manager.start(),
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => manager.reset(),
    });
  }

  return {
    badge,
    visible,
    panel: {
      type: "list" as const,
      title: isBreak ? "Break Time" : "Focus Timer",
      items,
      actions,
    },
  };
}

// =============================================================================
// UI Slot Factory
// =============================================================================

/**
 * Create a UI slot for the pomodoro extension.
 *
 * The slot displays a timer icon with remaining time as the badge when active.
 * When clicked, it opens a panel with timer status and controls.
 *
 * @example
 * ```ts
 * const { extension, manager } = createStatefulPomodoroExtension({
 *   sessionDuration: 30,
 *   breakDuration: 5,
 * });
 *
 * const { slot } = createPomodoroUISlot({ manager });
 *
 * // Use in your app
 * <SlotBar slots={[slot]} />
 * ```
 */
export function createPomodoroUISlot(options: PomodoroUISlotOptions): PomodoroUISlotResult {
  const {
    manager,
    id = "pomodoro.main",
    label = "Timer",
    priority = 90,
    showWhenIdle = false,
  } = options;

  // Create derived state that recomputes when manager state changes
  const state = createDerivedSlotState({
    getSourceState: () => manager.getState(),
    subscribeToSource: (callback) => manager.onStateChange(() => callback()),
    deriveState: (pomodoroState) => deriveSlotState(pomodoroState, manager, showWhenIdle),
  });

  const slot: ExtensionUISlot = {
    id,
    label,
    icon: "timer",
    priority,
    state,
  };

  return { slot, state };
}

// =============================================================================
// Convenience Export
// =============================================================================

export { createPomodoroUISlot as createPomodoroSlot };
