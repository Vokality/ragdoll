import { createSlotState, type ExtensionUISlot, type SlotState, type PanelAction, type ItemStatus } from "../index.js";
import type { PomodoroEvent, PomodoroState } from "../../extensions/pomodoro/index.js";
import type { ExecuteToolFn } from "./task-slot.js";

export interface PomodoroSlotSource {
  getInitialState: () => Promise<PomodoroState | null>;
  subscribe: (callback: (event: PomodoroEvent) => void) => () => void;
}

export interface PomodoroSlotOptions {
  source: PomodoroSlotSource;
  executeTool?: ExecuteToolFn;
}

export interface PomodoroSlotHandle {
  slot: ExtensionUISlot;
  dispose: () => void;
}

const EMPTY_STATE: SlotState = {
  badge: null,
  visible: true,
  panel: {
    type: "list",
    title: "Focus Timer",
    items: [],
  },
};

export function createPomodoroSlot(options: PomodoroSlotOptions): PomodoroSlotHandle {
  const { source, executeTool } = options;
  const store = createSlotState(EMPTY_STATE);

  const slot: ExtensionUISlot = {
    id: "pomodoro.main",
    label: "Timer",
    icon: "timer",
    priority: 90,
    state: store,
  };

  let disposed = false;

  const applyState = (state: PomodoroState | null): void => {
    if (disposed) return;
    store.replaceState(deriveSlotState(state, executeTool));
  };

  void source
    .getInitialState()
    .then((initial) => applyState(initial))
    .catch((error) => {
      console.error("[PomodoroSlot] Failed to load initial state", error);
    });

  const unsubscribe = source.subscribe((event) => {
    applyState(event.state);
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
  };

  return { slot, dispose };
}

function deriveSlotState(state: PomodoroState | null, executeTool?: ExecuteToolFn): SlotState {
  if (!state) {
    return EMPTY_STATE;
  }

  const badge = state.phase === "running" || state.phase === "paused"
    ? formatTime(Math.ceil(state.remainingMs / 1000))
    : null;

  const phaseLabel = state.isBreak
    ? state.phase === "running"
      ? "Break time"
      : "Break paused"
    : state.phase === "running"
      ? "Focus time"
      : state.phase === "paused"
        ? "Paused"
        : "Ready";

  const items: Array<{ id: string; label: string; sublabel?: string; status?: ItemStatus }> = [
    {
      id: "status",
      label: phaseLabel,
      sublabel: state.phase !== "idle" ? `${formatTime(Math.ceil(state.remainingMs / 1000))} remaining` : undefined,
      status:
        state.phase === "running"
          ? state.isBreak
            ? "success"
            : "active"
          : state.phase === "paused"
            ? "warning"
            : "default",
    },
  ];

  if ((state.sessionsCompleted ?? 0) > 0) {
    const count = state.sessionsCompleted ?? 0;
    items.push({
      id: "sessions",
      label: `${count} session${count === 1 ? "" : "s"} completed`,
      status: "success",
    });
  }

  const actions: PanelAction[] = buildActions(state.phase, executeTool);

  return {
    badge,
    visible: true,
    panel: {
      type: "list",
      title: state.isBreak ? "Break Time" : "Focus Timer",
      items,
      actions,
    },
  };
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function buildActions(phase: PomodoroState["phase"], executeTool?: ExecuteToolFn): PanelAction[] {
  if (!executeTool) {
    return [];
  }

  const run = (tool: string, args?: Record<string, unknown>) => {
    void executeTool(tool, args).catch((error) => {
      console.error(`[PomodoroSlot] Tool ${tool} failed`, error);
    });
  };

  if (phase === "idle") {
    return [
      {
        id: "start",
        label: "Start Focus",
        variant: "primary",
        onClick: () => run("startPomodoro"),
      },
    ];
  }

  if (phase === "running") {
    return [
      {
        id: "pause",
        label: "Pause",
        variant: "secondary",
        onClick: () => run("pausePomodoro"),
      },
      {
        id: "reset",
        label: "Reset",
        variant: "danger",
        onClick: () => run("resetPomodoro"),
      },
    ];
  }

  if (phase === "paused") {
    return [
      {
        id: "resume",
        label: "Resume",
        variant: "primary",
        onClick: () => run("startPomodoro"),
      },
      {
        id: "reset",
        label: "Reset",
        variant: "danger",
        onClick: () => run("resetPomodoro"),
      },
    ];
  }

  return [];
}
