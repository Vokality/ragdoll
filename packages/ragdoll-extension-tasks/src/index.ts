/**
 * Tasks Extension - Provides task management tools.
 *
 * Tools:
 * - addTask: Add a new task to the task list
 * - updateTaskStatus: Update a task's status
 * - setActiveTask: Set a task as the currently active task
 * - removeTask: Remove a task from the list
 * - completeActiveTask: Mark the currently active task as done
 * - clearCompletedTasks: Remove all completed tasks
 * - clearAllTasks: Remove all tasks
 * - listTasks: Get all tasks with their IDs, status, and text
 */

import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionStateChannel,
  ExtensionTool,
  HostLoggerCapability,
  HostStorageCapability,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type ListPanelSection,
} from "@vokality/ragdoll-extensions/slots";
import {
  TaskManager,
  type Task,
  type TaskState,
  type TaskStatus,
  type TaskEvent,
  type TaskEventCallback,
} from "./task-manager.js";

// =============================================================================
// Constants
// =============================================================================

export const VALID_TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "done",
] as const;

// Re-export types from task-manager
export type { Task, TaskState, TaskStatus, TaskEvent, TaskEventCallback };
export { TaskManager };

// =============================================================================
// Tool Argument Types
// =============================================================================

export interface AddTaskArgs {
  text: string;
  status?: TaskStatus;
}

export interface UpdateTaskStatusArgs {
  taskId: string;
  status: TaskStatus;
  blockedReason?: string;
}

export interface SetActiveTaskArgs {
  taskId: string;
}

export interface RemoveTaskArgs {
  taskId: string;
}

// No-argument tools
export type CompleteActiveTaskArgs = Record<string, never>;
export type ClearCompletedTasksArgs = Record<string, never>;
export type ClearAllTasksArgs = Record<string, never>;
export type ListTasksArgs = Record<string, never>;

// =============================================================================
// Handler Type
// =============================================================================

/**
 * Handler interface for task tool execution.
 * Consumers must provide this to actually manage tasks.
 */
export interface TaskToolHandler {
  addTask(args: AddTaskArgs): Promise<ToolResult> | ToolResult;
  updateTaskStatus(
    args: UpdateTaskStatusArgs,
  ): Promise<ToolResult> | ToolResult;
  setActiveTask(args: SetActiveTaskArgs): Promise<ToolResult> | ToolResult;
  removeTask(args: RemoveTaskArgs): Promise<ToolResult> | ToolResult;
  completeActiveTask(
    args: CompleteActiveTaskArgs,
  ): Promise<ToolResult> | ToolResult;
  clearCompletedTasks(
    args: ClearCompletedTasksArgs,
  ): Promise<ToolResult> | ToolResult;
  clearAllTasks(args: ClearAllTasksArgs): Promise<ToolResult> | ToolResult;
  listTasks(args: ListTasksArgs): Promise<ToolResult> | ToolResult;
}

// =============================================================================
// Validators
// =============================================================================

function validateAddTask(args: Record<string, unknown>): ValidationResult {
  if (!args.text || typeof args.text !== "string") {
    return { valid: false, error: "text is required and must be a string" };
  }
  if (args.text.trim().length === 0) {
    return { valid: false, error: "text cannot be empty" };
  }
  if (args.status !== undefined) {
    if (!VALID_TASK_STATUSES.includes(args.status as TaskStatus)) {
      return {
        valid: false,
        error: `Invalid status '${args.status}'. Valid: ${VALID_TASK_STATUSES.join(", ")}`,
      };
    }
  }
  return { valid: true };
}

function validateUpdateTaskStatus(
  args: Record<string, unknown>,
): ValidationResult {
  if (!args.taskId || typeof args.taskId !== "string") {
    return { valid: false, error: "taskId is required and must be a string" };
  }
  if (!args.status || typeof args.status !== "string") {
    return { valid: false, error: "status is required and must be a string" };
  }
  if (!VALID_TASK_STATUSES.includes(args.status as TaskStatus)) {
    return {
      valid: false,
      error: `Invalid status '${args.status}'. Valid: ${VALID_TASK_STATUSES.join(", ")}`,
    };
  }
  if (
    args.blockedReason !== undefined &&
    typeof args.blockedReason !== "string"
  ) {
    return { valid: false, error: "blockedReason must be a string" };
  }
  return { valid: true };
}

function validateTaskId(args: Record<string, unknown>): ValidationResult {
  if (!args.taskId || typeof args.taskId !== "string") {
    return { valid: false, error: "taskId is required and must be a string" };
  }
  return { valid: true };
}

function validateNoArgs(): ValidationResult {
  return { valid: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

function createTaskTools(handler: TaskToolHandler): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "addTask",
          description: "Add a new task to the task list",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The task description",
              },
              status: {
                type: "string",
                enum: VALID_TASK_STATUSES,
                description: "Initial status (default: todo)",
              },
            },
            required: ["text"],
          },
        },
      },
      handler: (args, _ctx) => handler.addTask(args as unknown as AddTaskArgs),
      validate: validateAddTask,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "updateTaskStatus",
          description: "Update a task's status",
          parameters: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "The task ID to update",
              },
              status: {
                type: "string",
                enum: VALID_TASK_STATUSES,
                description: "New status",
              },
              blockedReason: {
                type: "string",
                description:
                  "Reason for blocking (only when status is blocked)",
              },
            },
            required: ["taskId", "status"],
          },
        },
      },
      handler: (args, _ctx) =>
        handler.updateTaskStatus(args as unknown as UpdateTaskStatusArgs),
      validate: validateUpdateTaskStatus,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "setActiveTask",
          description: "Set a task as the currently active (in_progress) task",
          parameters: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "The task ID to make active",
              },
            },
            required: ["taskId"],
          },
        },
      },
      handler: (args, _ctx) =>
        handler.setActiveTask(args as unknown as SetActiveTaskArgs),
      validate: validateTaskId,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "removeTask",
          description: "Remove a task from the list",
          parameters: {
            type: "object",
            properties: {
              taskId: {
                type: "string",
                description: "The task ID to remove",
              },
            },
            required: ["taskId"],
          },
        },
      },
      handler: (args, _ctx) =>
        handler.removeTask(args as unknown as RemoveTaskArgs),
      validate: validateTaskId,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "completeActiveTask",
          description: "Mark the currently active task as done",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.completeActiveTask({}),
      validate: validateNoArgs,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "clearCompletedTasks",
          description: "Remove all completed tasks from the list",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.clearCompletedTasks({}),
      validate: validateNoArgs,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "clearAllTasks",
          description: "Remove all tasks from the list",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.clearAllTasks({}),
      validate: validateNoArgs,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "listTasks",
          description: "Get all tasks with their IDs, status, and text",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: (_args, _ctx) => handler.listTasks({}),
      validate: validateNoArgs,
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

const DEFAULT_TASK_STATE: TaskState = {
  tasks: [],
  activeTaskId: null,
  isExpanded: false,
};

const DEFAULT_EXTENSION_ID = "tasks";
const DEFAULT_STORAGE_KEY = "state";
const REQUIRED_HOST_CAPABILITIES = ["storage", "logger"] as const;

function requireHostCapabilities(host: ExtensionHostEnvironment): {
  storage: HostStorageCapability;
  logger: HostLoggerCapability;
} {
  if (!host.storage || !host.logger) {
    throw new Error("Tasks requires host storage and logger capabilities");
  }
  return { storage: host.storage, logger: host.logger };
}

async function loadTaskState(
  storage: HostStorageCapability,
): Promise<TaskState> {
  return (
    (await storage.read<TaskState>(
      DEFAULT_EXTENSION_ID,
      DEFAULT_STORAGE_KEY,
    )) ?? DEFAULT_TASK_STATE
  );
}

async function createRuntime(
  host: ExtensionHostEnvironment,
): Promise<ExtensionRuntimeContribution> {
  const { storage, logger } = requireHostCapabilities(host);
  const startingState = await loadTaskState(storage);

  const manager = new TaskManager(startingState, {
    createId: () => globalThis.crypto.randomUUID(),
    now: Date.now,
    onListenerError: (error) => {
      logger.error("Task event listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const stateListeners = new Set<(state: TaskState) => void>();

  const mutate = async <T>(operation: () => T): Promise<T> => {
    const checkpoint = manager.getState();
    const result = operation();
    try {
      await storage.write(
        DEFAULT_EXTENSION_ID,
        DEFAULT_STORAGE_KEY,
        manager.getState(),
      );
      return result;
    } catch (error) {
      logger.error(`[${DEFAULT_EXTENSION_ID}] Failed to persist task state`, {
        error: error instanceof Error ? error.message : String(error),
      });
      manager.loadState(checkpoint);
      throw error;
    }
  };

  const unsubscribeManager = manager.onStateChange((event) => {
    for (const listener of stateListeners) {
      try {
        listener(event.state);
      } catch (error) {
        logger.warn(`[${DEFAULT_EXTENSION_ID}] State channel listener error`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  const handler: TaskToolHandler = {
    addTask: async ({ text, status }) => {
      const task = await mutate(() => manager.addTask(text, status));
      return { success: true, data: task };
    },

    updateTaskStatus: async ({ taskId, status, blockedReason }) => {
      const task = await mutate(() =>
        manager.updateTaskStatus(taskId, status, blockedReason),
      );
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true, data: task };
    },

    setActiveTask: async ({ taskId }) => {
      const task = await mutate(() => manager.setActiveTask(taskId));
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true, data: task };
    },

    removeTask: async ({ taskId }) => {
      const removed = await mutate(() => manager.removeTask(taskId));
      if (!removed) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true };
    },

    completeActiveTask: async () => {
      const task = await mutate(() => manager.completeActiveTask());
      if (!task) {
        return { success: false, error: "No active task to complete" };
      }
      return { success: true, data: task };
    },

    clearCompletedTasks: async () => {
      const count = await mutate(() => manager.clearCompletedTasks());
      return { success: true, data: { cleared: count } };
    },

    clearAllTasks: async () => {
      const count = await mutate(() => manager.clearAllTasks());
      return { success: true, data: { cleared: count } };
    },

    listTasks: () => {
      const state = manager.getState();
      return { success: true, data: state };
    },
  };

  const stateChannel: ExtensionStateChannel<TaskState> = {
    id: `${DEFAULT_EXTENSION_ID}:state`,
    description: "Live task state stream",
    getState: () => manager.getState(),
    subscribe: (listener: (state: TaskState) => void) => {
      stateListeners.add(listener);
      listener(manager.getState());
      return () => stateListeners.delete(listener);
    },
  };

  // Build UI slot state derived from manager state for generic hosts
  const deriveSlotState = (taskState: TaskState) => {
    const { tasks, activeTaskId } = taskState;
    const activeTasks = tasks.filter((t) => t.status !== "done");
    const completedTasks = tasks.filter((t) => t.status === "done");

    const sections: ListPanelSection[] = [];

    if (activeTasks.length > 0) {
      sections.push({
        id: "active",
        title: "Active",
        items: activeTasks.map((task) => ({
          id: task.id,
          label: task.text,
          sublabel: task.blockedReason,
          status:
            task.id === activeTaskId
              ? "active"
              : task.status === "blocked"
                ? "error"
                : "default",
          checkable: true,
          checked: false,
          onToggle: async () => {
            await mutate(() => manager.updateTaskStatus(task.id, "done"));
          },
          onClick: async () => {
            await mutate(() => manager.setActiveTask(task.id));
          },
        })),
      });
    }

    if (completedTasks.length > 0) {
      sections.push({
        id: "completed",
        title: "Completed",
        items: completedTasks.map((task) => ({
          id: task.id,
          label: task.text,
          status: "success",
          checkable: true,
          checked: true,
          onToggle: async () => {
            await mutate(() => manager.updateTaskStatus(task.id, "todo"));
          },
        })),
        collapsible: true,
        defaultCollapsed: activeTasks.length > 3,
        actions: [
          {
            id: "clear-completed",
            label: "Clear all",
            onClick: async () => {
              await mutate(() => manager.clearCompletedTasks());
            },
          },
        ],
      });
    }

    return {
      badge: activeTasks.length || null,
      visible: true,
      panel: {
        type: "list" as const,
        title: "Tasks",
        emptyMessage: "No tasks yet",
        sections,
      },
    };
  };

  const slotState = createSlotState(
    deriveSlotState(manager.getState()),
    (error) => {
      logger.error("Task slot listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
  const unsubscribeSlot = manager.onStateChange((event) => {
    slotState.replaceState(deriveSlotState(event.state));
  });

  return {
    tools: createTaskTools(handler),
    stateChannels: [stateChannel],
    slots: [
      {
        id: `${DEFAULT_EXTENSION_ID}.main`,
        label: "Tasks",
        icon: "checklist",
        priority: 100,
        state: slotState,
      },
    ],
    dispose: () => {
      unsubscribeManager();
      unsubscribeSlot();
      stateListeners.clear();
      manager.removeAllListeners();
    },
  };
}

import {
  createExtension as defineExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions";

/**
 * Create the tasks extension.
 */
export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Task Manager",
    version: "0.1.0",
    description: "Task tracking and management tools",
    requiredCapabilities: REQUIRED_HOST_CAPABILITIES,
    optionalCapabilities: [],
    createRuntime: (host) => createRuntime(host),
  });
}
