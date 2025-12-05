import { useState, useEffect } from "react";
import type { ExtensionUISlot } from "@vokality/ragdoll-extensions";
import { createSlotState } from "@vokality/ragdoll-extensions";

/**
 * Generic hook that manages extension slots by subscribing to state channel changes.
 *
 * This hook:
 * 1. Loads all state channels from extensions on mount
 * 2. Subscribes to generic state channel changes from the main process
 * 3. Creates UI slots dynamically based on state channel data
 * 4. Forwards all actions to main process via executeExtensionTool
 *
 * Extensions define their state shape and the hook renders based on that shape.
 *
 * @returns Array of extension UI slots ready to render
 */
export function useExtensionSlots(): ExtensionUISlot[] {
  // Map of state channels: channelId -> state
  const [stateChannels, setStateChannels] = useState<Map<string, unknown>>(new Map());

  // Load initial state and subscribe to changes
  useEffect(() => {
    // Load all state channels on mount
    window.electronAPI.getAllStateChannels().then((channels) => {
      const channelMap = new Map<string, unknown>();
      channels.forEach(({ channelId, state }) => {
        channelMap.set(channelId, state);
      });
      setStateChannels(channelMap);
    });

    // Subscribe to state channel changes (generic)
    const unsubscribe = window.electronAPI.onStateChannelChanged((event) => {
      setStateChannels((prev) => {
        const next = new Map(prev);
        next.set(event.channelId, event.state);
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Build slots from state channels
  const slots: ExtensionUISlot[] = [];

  // Tasks slot (if tasks state channel exists)
  const tasksState = stateChannels.get("tasks:state") as any;
  if (tasksState) {
    slots.push(createTasksSlot(tasksState));
  }

  // Pomodoro slot (if pomodoro state channel exists)
  const pomodoroState = stateChannels.get("pomodoro:state") as any;
  if (pomodoroState) {
    slots.push(createPomodoroSlot(pomodoroState));
  }

  return slots;
}

// =============================================================================
// Slot Factories (Extension-Specific Rendering Logic)
// =============================================================================

/**
 * Creates a tasks slot from tasks state channel data.
 *
 * NOTE: This function contains extension-specific rendering logic.
 * In a future iteration, this could be moved to the extension package itself
 * and provided to the renderer as a browser-safe UI definition.
 */
function createTasksSlot(state: any): ExtensionUISlot {
  const { tasks = [], activeTaskId = null } = state;
  const activeTasks = tasks.filter((t: any) => t.status !== "done");
  const completedTasks = tasks.filter((t: any) => t.status === "done");

  const sections: any[] = [];

  if (activeTasks.length > 0) {
    sections.push({
      id: "active",
      title: "Active",
      items: activeTasks.map((task: any) => ({
        id: task.id,
        label: task.text,
        sublabel: task.blockedReason,
        status: task.id === activeTaskId ? "active" : task.status === "blocked" ? "error" : "default",
        checkable: true,
        checked: false,
        onToggle: () => {
          window.electronAPI.executeExtensionTool("updateTaskStatus", { taskId: task.id, status: "done" });
        },
        onClick: () => {
          window.electronAPI.executeExtensionTool("setActiveTask", { taskId: task.id });
        },
      })),
    });
  }

  if (completedTasks.length > 0) {
    sections.push({
      id: "completed",
      title: "Completed",
      items: completedTasks.map((task: any) => ({
        id: task.id,
        label: task.text,
        status: "success",
        checkable: true,
        checked: true,
        onToggle: () => {
          window.electronAPI.executeExtensionTool("updateTaskStatus", { taskId: task.id, status: "todo" });
        },
      })),
      collapsible: true,
      defaultCollapsed: activeTasks.length > 3,
      actions: [
        {
          id: "clear-completed",
          label: "Clear all",
          onClick: () => {
            window.electronAPI.executeExtensionTool("clearCompletedTasks", {});
          },
        },
      ],
    });
  }

  const slotState = createSlotState({
    badge: activeTasks.length || null,
    visible: tasks.length > 0,
    panel: {
      type: "list",
      title: "Tasks",
      emptyMessage: "No tasks yet",
      sections,
    },
  });

  return {
    id: "tasks.main",
    label: "Tasks",
    icon: "checklist",
    priority: 100,
    state: slotState,
  };
}

/**
 * Creates a pomodoro slot from pomodoro state channel data.
 *
 * NOTE: This function contains extension-specific rendering logic.
 * In a future iteration, this could be moved to the extension package itself
 * and provided to the renderer as a browser-safe UI definition.
 */
function createPomodoroSlot(state: any): ExtensionUISlot {
  const { state: phase = "idle", remainingTime = 30 * 60, isBreak = false, sessionsCompleted = 0 } = state;

  const visible = phase !== "idle";
  const remainingMs = remainingTime * 1000;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const badge = (phase === "running" || phase === "paused") ? formatTime(remainingMs) : null;

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
    sublabel: phase !== "idle" ? `${formatTime(remainingMs)} remaining` : "30 min session",
    status: getPhaseStatus(),
  });

  if (sessionsCompleted > 0) {
    items.push({
      id: "sessions",
      label: `${sessionsCompleted} session${sessionsCompleted === 1 ? "" : "s"} completed`,
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
        window.electronAPI.executeExtensionTool("startPomodoro", {});
      },
    });
  } else if (phase === "running") {
    actions.push({
      id: "pause",
      label: "Pause",
      variant: "secondary",
      onClick: () => {
        window.electronAPI.executeExtensionTool("pausePomodoro", {});
      },
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => {
        window.electronAPI.executeExtensionTool("resetPomodoro", {});
      },
    });
  } else if (phase === "paused") {
    actions.push({
      id: "resume",
      label: "Resume",
      variant: "primary",
      onClick: () => {
        window.electronAPI.executeExtensionTool("startPomodoro", {});
      },
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => {
        window.electronAPI.executeExtensionTool("resetPomodoro", {});
      },
    });
  }

  const slotState = createSlotState({
    badge,
    visible,
    panel: {
      type: "list",
      title: isBreak ? "Break Time" : "Focus Timer",
      items,
      actions,
    },
  });

  return {
    id: "pomodoro.main",
    label: "Timer",
    icon: "timer",
    priority: 90,
    state: slotState,
  };
}
