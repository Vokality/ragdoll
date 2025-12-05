import { useState, useEffect, useMemo } from "react";
import type { ExtensionUISlot, ListPanelSection } from "@vokality/ragdoll-extensions";
import { createSlotState } from "@vokality/ragdoll-extensions";

// Local type definitions (matching extension types but safe for renderer)
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type PomodoroPhase = "idle" | "running" | "paused";

interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  blockedReason?: string;
  createdAt: number;
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  isExpanded: boolean;
}

interface LocalPomodoroState {
  phase: PomodoroPhase;
  remainingMs: number;
  isBreak: boolean;
  sessionsCompleted: number;
}

/**
 * Hook that creates and manages extension slots for the chat app.
 * 
 * This hook:
 * 1. Subscribes to extension state changes from the main process via IPC
 * 2. Creates UI slots that render the extension state
 * 3. Forwards slot actions to main process via IPC
 * 
 * @returns Array of extension UI slots ready to render
 */
export function useExtensionSlots(): ExtensionUISlot[] {
  // Task state
  const [taskState, setTaskState] = useState<TaskState>({ tasks: [], activeTaskId: null, isExpanded: false });
  
  // Pomodoro state
  const [pomodoroState, setPomodoroState] = useState<LocalPomodoroState>({
    phase: "idle",
    remainingMs: 30 * 60 * 1000,
    isBreak: false,
    sessionsCompleted: 0,
  });

  // Load initial state and subscribe to changes
  useEffect(() => {
    // Load task state
    window.electronAPI.getTaskState().then((state) => {
      setTaskState(state);
    });

    // Load pomodoro state (from IPC snapshot format)
    window.electronAPI.getPomodoroState().then((snapshot) => {
      if (snapshot) {
        setPomodoroState({
          phase: snapshot.phase as PomodoroPhase,
          remainingMs: snapshot.remainingSeconds * 1000,
          isBreak: snapshot.isBreak,
          sessionsCompleted: snapshot.sessionsCompleted,
        });
      }
    });

    // Subscribe to task state changes
    const unsubscribeTask = window.electronAPI.onTaskStateChanged((event) => {
      setTaskState(event.state);
    });

    // Subscribe to pomodoro state changes
    const unsubscribePomodoro = window.electronAPI.onPomodoroStateChanged((event) => {
      const state = event.state;
      setPomodoroState({
        phase: state.phase as PomodoroPhase,
        remainingMs: state.remainingMs,
        isBreak: state.isBreak,
        sessionsCompleted: state.sessionsCompleted,
      });
    });

    return () => {
      unsubscribeTask();
      unsubscribePomodoro();
    };
  }, []);

  // Helper functions for task actions
  const taskActions = useMemo(() => ({
    addTask: (text: string, status?: TaskStatus) => {
      window.electronAPI.executeExtensionTool("addTask", { text, status });
    },
    updateTaskStatus: (taskId: string, status: TaskStatus, blockedReason?: string) => {
      window.electronAPI.executeExtensionTool("updateTaskStatus", { taskId, status, blockedReason });
    },
    setActiveTask: (taskId: string) => {
      window.electronAPI.executeExtensionTool("setActiveTask", { taskId });
    },
    removeTask: (taskId: string) => {
      window.electronAPI.executeExtensionTool("removeTask", { taskId });
    },
    clearCompletedTasks: () => {
      window.electronAPI.executeExtensionTool("clearCompletedTasks", {});
    },
  }), []);

  // Helper functions for pomodoro actions
  const pomodoroActions = useMemo(() => ({
    start: () => {
      window.electronAPI.executeExtensionTool("startPomodoro", {});
    },
    pause: () => {
      window.electronAPI.executeExtensionTool("pausePomodoro", {});
    },
    reset: () => {
      window.electronAPI.executeExtensionTool("resetPomodoro", {});
    },
  }), []);

  // Create task slot
  const taskSlot = useMemo((): ExtensionUISlot => {
    const activeTasks = taskState.tasks.filter((t: any) => t.status !== "done");
    const state = createSlotState({
      badge: activeTasks.length || null,
      visible: taskState.tasks.length > 0,
      panel: {
        type: "list",
        title: "Tasks",
        emptyMessage: "No tasks yet",
        sections: createTaskSections(taskState, taskActions),
      },
    });

    return {
      id: "tasks.main",
      label: "Tasks",
      icon: "checklist",
      priority: 100,
      state,
    };
  }, [taskState, taskActions]);

  // Create pomodoro slot
  const pomodoroSlot = useMemo((): ExtensionUISlot => {
    const visible = pomodoroState.phase !== "idle";
    const badge = (pomodoroState.phase === "running" || pomodoroState.phase === "paused")
      ? formatTime(pomodoroState.remainingMs)
      : null;

    const state = createSlotState({
      badge,
      visible,
      panel: {
        type: "list",
        title: pomodoroState.isBreak ? "Break Time" : "Focus Timer",
        items: createPomodoroItems(pomodoroState),
        actions: createPomodoroActions(pomodoroState, pomodoroActions),
      },
    });

    return {
      id: "pomodoro.main",
      label: "Timer",
      icon: "timer",
      priority: 90,
      state,
    };
  }, [pomodoroState, pomodoroActions]);

  return [taskSlot, pomodoroSlot];
}

// =============================================================================
// Helper Functions
// =============================================================================

function createTaskSections(state: TaskState, actions: any): ListPanelSection[] {
  const { tasks, activeTaskId } = state;
  const activeTasks = tasks.filter((t: any) => t.status !== "done");
  const completedTasks = tasks.filter((t: any) => t.status !== "done");

  const sections: ListPanelSection[] = [];

  if (activeTasks.length > 0) {
    sections.push({
      id: "active",
      title: "Active",
      items: activeTasks.map((task: any) => taskToListItem(task, task.id === activeTaskId, actions)),
    });
  }

  if (completedTasks.length > 0) {
    sections.push({
      id: "completed",
      title: "Completed",
      items: completedTasks.map((task: any) => taskToListItem(task, false, actions)),
      collapsible: true,
      defaultCollapsed: activeTasks.length > 3,
      actions: [
        {
          id: "clear-completed",
          label: "Clear all",
          onClick: () => actions.clearCompletedTasks(),
        },
      ],
    });
  }

  return sections;
}

function taskToListItem(task: Task, isActive: boolean, actions: any) {
  const isDone = task.status === "done";

  return {
    id: task.id,
    label: task.text,
    sublabel: task.blockedReason,
    status: taskStatusToItemStatus(task.status, isActive),
    checkable: true,
    checked: isDone,
    onToggle: () => {
      if (isDone) {
        actions.updateTaskStatus(task.id, "todo");
      } else {
        actions.updateTaskStatus(task.id, "done");
      }
    },
    onClick: !isDone
      ? () => {
          actions.setActiveTask(task.id);
        }
      : undefined,
  };
}

function taskStatusToItemStatus(status: TaskStatus, isActive: boolean): "default" | "active" | "success" | "warning" | "error" {
  if (isActive) return "active";
  switch (status) {
    case "done":
      return "success";
    case "blocked":
      return "error";
    case "in_progress":
      return "active";
    case "todo":
    default:
      return "default";
  }
}

function createPomodoroItems(state: LocalPomodoroState) {
  const items: any[] = [];

  items.push({
    id: "status",
    label: getPhaseLabel(state.phase, state.isBreak),
    sublabel: state.phase !== "idle"
      ? `${formatTime(state.remainingMs)} remaining`
      : "30 min session",
    status: getPhaseStatus(state.phase, state.isBreak),
  });

  if (state.sessionsCompleted > 0) {
    items.push({
      id: "sessions",
      label: `${state.sessionsCompleted} session${state.sessionsCompleted === 1 ? "" : "s"} completed`,
      status: "success",
    });
  }

  return items;
}

function createPomodoroActions(state: LocalPomodoroState, actions: any) {
  const pomodoroActions: any[] = [];

  if (state.phase === "idle") {
    pomodoroActions.push({
      id: "start",
      label: "Start Focus",
      variant: "primary",
      onClick: () => actions.start(),
    });
  } else if (state.phase === "running") {
    pomodoroActions.push({
      id: "pause",
      label: "Pause",
      variant: "secondary",
      onClick: () => actions.pause(),
    });
    pomodoroActions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => actions.reset(),
    });
  } else if (state.phase === "paused") {
    pomodoroActions.push({
      id: "resume",
      label: "Resume",
      variant: "primary",
      onClick: () => actions.start(),
    });
    pomodoroActions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => actions.reset(),
    });
  }

  return pomodoroActions;
}

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
