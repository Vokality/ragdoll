import { createSlotState, type ExtensionUISlot, type SlotState, type ListPanelSection, type ItemStatus } from "../index.js";
import type { TaskState, TaskEvent } from "../../extensions/tasks/index.js";

export interface ExecuteToolFn {
  (toolName: string, args?: Record<string, unknown>): Promise<{ success?: boolean; error?: string } | void>;
}

export interface TaskSlotSource {
  getInitialState: () => Promise<TaskState | null>;
  subscribe: (callback: (event: TaskEvent) => void) => () => void;
}

export interface TaskSlotOptions {
  source: TaskSlotSource;
  executeTool?: ExecuteToolFn;
}

export interface TaskSlotHandle {
  slot: ExtensionUISlot;
  dispose: () => void;
}

const EMPTY_STATE: SlotState = {
  badge: null,
  visible: true,
  panel: {
    type: "list",
    title: "Tasks",
    emptyMessage: "No tasks yet",
    sections: [],
  },
};

export function createTaskSlot(options: TaskSlotOptions): TaskSlotHandle {
  const { source, executeTool } = options;
  const store = createSlotState(EMPTY_STATE);

  const slot: ExtensionUISlot = {
    id: "tasks.main",
    label: "Tasks",
    icon: "checklist",
    priority: 100,
    state: store,
  };

  let disposed = false;

  const applyState = (state: TaskState | null): void => {
    if (disposed) return;
    store.replaceState(deriveSlotState(state, executeTool));
  };

  void source
    .getInitialState()
    .then((initial) => applyState(initial))
    .catch((error) => {
      console.error("[TaskSlot] Failed to load initial task state", error);
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

function deriveSlotState(state: TaskState | null, executeTool?: ExecuteToolFn): SlotState {
  if (!state || state.tasks.length === 0) {
    return EMPTY_STATE;
  }

  const runTool = (tool: string, args?: Record<string, unknown>) => {
    if (!executeTool) return;
    void executeTool(tool, args).catch((error) => {
      console.error(`[TaskSlot] Tool ${tool} failed`, error);
    });
  };

  const { tasks, activeTaskId } = state;
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");

  const sections: ListPanelSection[] = [];

  if (activeTasks.length > 0) {
    sections.push({
      id: "active",
      title: "Active",
      items: activeTasks.map((task) => {
        const isDone = task.status === "done";
        const isActive = task.id === activeTaskId;

        let status: ItemStatus = "default";
        if (isActive) status = "active";
        else if (task.status === "blocked") status = "error";
        else if (task.status === "in_progress") status = "active";

        return {
          id: task.id,
          label: task.text,
          sublabel: task.blockedReason,
          status,
          checkable: true,
          checked: isDone,
          onToggle: () =>
            runTool("updateTaskStatus", {
              taskId: task.id,
              status: isDone ? "todo" : "done",
            }),
          onClick: !isDone ? () => runTool("setActiveTask", { taskId: task.id }) : undefined,
        };
      }),
    });
  }

  if (completedTasks.length > 0) {
    sections.push({
      id: "completed",
      title: "Completed",
      items: completedTasks.map((task) => ({
        id: task.id,
        label: task.text,
        status: "success" as ItemStatus,
        checkable: true,
        checked: true,
        onToggle: () =>
          runTool("updateTaskStatus", {
            taskId: task.id,
            status: "todo",
          }),
      })),
      collapsible: true,
      defaultCollapsed: activeTasks.length > 3,
      actions: [
        {
          id: "clear-completed",
          label: "Clear all",
          onClick: () => runTool("clearCompletedTasks"),
        },
      ],
    });
  }

  return {
    badge: activeTasks.length > 0 ? activeTasks.length : null,
    visible: true,
    panel: {
      type: "list",
      title: "Tasks",
      emptyMessage: "No tasks yet",
      sections,
    },
  };
}
