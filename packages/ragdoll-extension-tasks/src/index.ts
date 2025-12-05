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

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionStateChannel,
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions/core";
import { createSlotState } from "@vokality/ragdoll-extensions/ui/state";
import {
  TaskManager,
  createTaskManager,
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
export { TaskManager, createTaskManager };

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
  updateTaskStatus(args: UpdateTaskStatusArgs): Promise<ToolResult> | ToolResult;
  setActiveTask(args: SetActiveTaskArgs): Promise<ToolResult> | ToolResult;
  removeTask(args: RemoveTaskArgs): Promise<ToolResult> | ToolResult;
  completeActiveTask(args: CompleteActiveTaskArgs): Promise<ToolResult> | ToolResult;
  clearCompletedTasks(args: ClearCompletedTasksArgs): Promise<ToolResult> | ToolResult;
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

function validateUpdateTaskStatus(args: Record<string, unknown>): ValidationResult {
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
  if (args.blockedReason !== undefined && typeof args.blockedReason !== "string") {
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
                description: "Reason for blocking (only when status is blocked)",
              },
            },
            required: ["taskId", "status"],
          },
        },
      },
      handler: (args, _ctx) => handler.updateTaskStatus(args as unknown as UpdateTaskStatusArgs),
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
      handler: (args, _ctx) => handler.setActiveTask(args as unknown as SetActiveTaskArgs),
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
      handler: (args, _ctx) => handler.removeTask(args as unknown as RemoveTaskArgs),
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
const STATE_FILENAME = "tasks-state.json";

async function resolveStateFilePath(
  host: ExtensionHostEnvironment,
  extensionId: string
): Promise<string | null> {
  if (!host.getDataPath) {
    return null;
  }
  try {
    const basePath = await host.getDataPath(extensionId);
    if (!basePath) {
      return null;
    }
    const filePath = join(basePath, STATE_FILENAME);
    await mkdir(dirname(filePath), { recursive: true });
    return filePath;
  } catch (error) {
    host.logger?.warn?.(`[${extensionId}] Failed to resolve task data path`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readStateFromFile(filePath: string): Promise<TaskState | undefined> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as TaskState;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function loadPersistedTaskState(
  host: ExtensionHostEnvironment,
  extensionId: string,
  filePath: string | null,
  storageKey: string,
  fallback?: TaskState
): Promise<TaskState> {
  if (filePath) {
    try {
      const state = await readStateFromFile(filePath);
      if (state) {
        return state;
      }
    } catch (error) {
      host.logger?.warn?.(`[${extensionId}] Failed to read task state file`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (host.storage) {
    try {
      const stored = await host.storage.read<TaskState>(extensionId, storageKey);
      if (stored) {
        return stored;
      }
    } catch (error) {
      host.logger?.warn?.(`[${extensionId}] Failed to load task state from storage`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return fallback ?? DEFAULT_TASK_STATE;
}

export interface TaskRuntimeOptions {
  /** Provide a fallback state when no persisted data exists */
  initialState?: TaskState;
  /** Custom storage key when falling back to host storage */
  storageKey?: string;
  /** Override the extension identifier used for persistence */
  extensionId?: string;
}

export async function createRuntime(
  options: TaskRuntimeOptions | undefined,
  host: ExtensionHostEnvironment
): Promise<ExtensionRuntimeContribution> {
  const extensionId = options?.extensionId ?? DEFAULT_EXTENSION_ID;
  const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
  const stateFilePath = await resolveStateFilePath(host, extensionId);
  const startingState = await loadPersistedTaskState(
    host,
    extensionId,
    stateFilePath,
    storageKey,
    options?.initialState
  );

  const manager = createTaskManager(startingState);
  const stateListeners = new Set<(state: TaskState) => void>();

  const persistState = async (state: TaskState): Promise<void> => {
    try {
      let persisted = false;
      if (stateFilePath) {
        await mkdir(dirname(stateFilePath), { recursive: true });
        await writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf-8");
        persisted = true;
      } else if (host.storage) {
        await host.storage.write(extensionId, storageKey, state);
        persisted = true;
      }

      if (persisted) {
        await host.schedulePersistence?.(extensionId, "tasks-state-changed");
      }
    } catch (error) {
      host.logger?.error?.(`[${extensionId}] Failed to persist task state`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const unsubscribeManager = manager.onStateChange((event) => {
    void persistState(event.state);
    for (const listener of stateListeners) {
      try {
        listener(event.state);
      } catch (error) {
        host.logger?.warn?.(`[${extensionId}] State channel listener error`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  const handler: TaskToolHandler = {
    addTask: ({ text, status }) => {
      const task = manager.addTask(text, status);
      return { success: true, data: task };
    },

    updateTaskStatus: ({ taskId, status, blockedReason }) => {
      const task = manager.updateTaskStatus(taskId, status, blockedReason);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true, data: task };
    },

    setActiveTask: ({ taskId }) => {
      const task = manager.setActiveTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true, data: task };
    },

    removeTask: ({ taskId }) => {
      const removed = manager.removeTask(taskId);
      if (!removed) {
        return { success: false, error: `Task not found: ${taskId}` };
      }
      return { success: true };
    },

    completeActiveTask: () => {
      const task = manager.completeActiveTask();
      if (!task) {
        return { success: false, error: "No active task to complete" };
      }
      return { success: true, data: task };
    },

    clearCompletedTasks: () => {
      const count = manager.clearCompletedTasks();
      return { success: true, data: { cleared: count } };
    },

    clearAllTasks: () => {
      const count = manager.clearAllTasks();
      return { success: true, data: { cleared: count } };
    },

    listTasks: () => {
      const state = manager.getState();
      return { success: true, data: state };
    },
  };

  const stateChannel: ExtensionStateChannel<TaskState> = {
    id: `${extensionId}:state`,
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

    const sections: any[] = [];

    if (activeTasks.length > 0) {
      sections.push({
        id: "active",
        title: "Active",
        items: activeTasks.map((task) => ({
          id: task.id,
          label: task.text,
          sublabel: task.blockedReason,
          status: task.id === activeTaskId ? "active" : task.status === "blocked" ? "error" : "default",
          checkable: true,
          checked: false,
          onToggle: () => {
            manager.updateTaskStatus(task.id, "done");
          },
          onClick: () => {
            manager.setActiveTask(task.id);
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
          onToggle: () => {
            manager.updateTaskStatus(task.id, "todo");
          },
        })),
        collapsible: true,
        defaultCollapsed: activeTasks.length > 3,
        actions: [
          {
            id: "clear-completed",
            label: "Clear all",
            onClick: () => {
              manager.clearCompletedTasks();
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

  const slotState = createSlotState(deriveSlotState(manager.getState()));
  const unsubscribeSlot = manager.onStateChange((event) => {
    slotState.replaceState(deriveSlotState(event.state));
  });

  return {
    tools: createTaskTools(handler),
    stateChannels: [stateChannel],
    slots: [
      {
        id: `${extensionId}.main`,
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

export { createRuntime as createTaskRuntime };
// NOTE: UI exports removed to avoid pulling React into main process
// export { createTaskUISlot, type TaskUISlotOptions } from "./ui.js";

import {
  createExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions/core";

/**
 * Create the tasks extension.
 */
function createTasksExtension(config?: Record<string, unknown>): RagdollExtension {
  return createExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Task Manager",
    version: "0.1.0",
    description: "Task tracking and management tools",
    createRuntime: (host, _context) => createRuntime(config as TaskRuntimeOptions | undefined, host),
  });
}

export { createTasksExtension as createExtension };
export default createTasksExtension;
