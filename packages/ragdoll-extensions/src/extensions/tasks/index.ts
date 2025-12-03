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

import { createExtension } from "../../create-extension.js";
import type {
  RagdollExtension,
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "../../types.js";
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

export interface TaskExtensionOptions {
  /** Handler that executes the task tools */
  handler: TaskToolHandler;
  /** Optional extension ID override (default: "tasks") */
  id?: string;
}

/**
 * Create a tasks extension with the provided handler.
 *
 * @example
 * ```ts
 * const tasksExtension = createTaskExtension({
 *   handler: {
 *     addTask: async ({ text, status }) => {
 *       const task = taskController.addTask(text, status);
 *       return { success: true, data: task };
 *     },
 *     // ... other handlers
 *   },
 * });
 *
 * await registry.register(tasksExtension);
 * ```
 */
export function createTaskExtension(
  options: TaskExtensionOptions
): RagdollExtension {
  const { handler, id = "tasks" } = options;

  return createExtension({
    id,
    name: "Task Manager",
    version: "1.0.0",
    tools: createTaskTools(handler),
  });
}

// =============================================================================
// Stateful Extension Factory
// =============================================================================

export interface StatefulTaskExtensionOptions {
  /** Optional extension ID override (default: "tasks") */
  id?: string;
  /** Initial task state to load */
  initialState?: TaskState;
  /** Callback when task state changes (for persistence/sync) */
  onStateChange?: TaskEventCallback;
}

/**
 * Create a stateful tasks extension with built-in TaskManager.
 *
 * This version manages task state internally and provides callbacks
 * for persistence and UI sync.
 *
 * @example
 * ```ts
 * const { extension, manager } = createStatefulTaskExtension({
 *   initialState: await loadTasksFromStorage(),
 *   onStateChange: (event) => {
 *     saveTasksToStorage(event.state);
 *   },
 * });
 *
 * await registry.register(extension);
 * ```
 */
export function createStatefulTaskExtension(
  options: StatefulTaskExtensionOptions = {}
): { extension: RagdollExtension; manager: TaskManager } {
  const { id = "tasks", initialState, onStateChange } = options;

  // Create the manager
  const manager = createTaskManager(initialState);

  // Subscribe to state changes if callback provided
  if (onStateChange) {
    manager.onStateChange(onStateChange);
  }

  // Create handler that uses the manager
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

  const extension = createExtension({
    id,
    name: "Task Manager",
    version: "1.0.0",
    tools: createTaskTools(handler),
    onDestroy: () => {
      manager.removeAllListeners();
    },
  });

  return { extension, manager };
}

// Re-export for convenience
export { createExtension };
