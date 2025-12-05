/**
 * TaskManager - Manages task state in the main process.
 *
 * This provides the actual implementation for task operations,
 * storing state and emitting events when changes occur.
 */

// Browser-compatible UUID generation
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 19+)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// Types
// =============================================================================

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: number;
  blockedReason?: string;
}

export interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  isExpanded: boolean;
}

export type TaskEventType =
  | "task:added"
  | "task:updated"
  | "task:removed"
  | "task:active-changed"
  | "tasks:cleared"
  | "state:changed";

export interface TaskEvent {
  type: TaskEventType;
  task?: Task;
  taskId?: string;
  state: TaskState;
  timestamp: number;
}

export type TaskEventCallback = (event: TaskEvent) => void;

// =============================================================================
// TaskManager
// =============================================================================

/**
 * Manages task state with event emission for state changes.
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private activeTaskId: string | null = null;
  private isExpanded: boolean = false;
  private listeners: Set<TaskEventCallback> = new Set();

  constructor(initialState?: TaskState) {
    if (initialState) {
      this.loadState(initialState);
    }
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Load state from a serialized TaskState object.
   */
  loadState(state: TaskState): void {
    this.tasks.clear();
    for (const task of state.tasks) {
      this.tasks.set(task.id, { ...task });
    }
    this.activeTaskId = state.activeTaskId;
    this.isExpanded = state.isExpanded ?? false;
    this.emit("state:changed");
  }

  /**
   * Get the current state as a serializable object.
   */
  getState(): TaskState {
    return {
      tasks: Array.from(this.tasks.values()),
      activeTaskId: this.activeTaskId,
      isExpanded: this.isExpanded,
    };
  }

  /**
   * Get all tasks.
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get the currently active task.
   */
  getActiveTask(): Task | undefined {
    if (!this.activeTaskId) return undefined;
    return this.tasks.get(this.activeTaskId);
  }

  /**
   * Get the active task ID.
   */
  getActiveTaskId(): string | null {
    return this.activeTaskId;
  }

  // ===========================================================================
  // Task Operations
  // ===========================================================================

  /**
   * Add a new task.
   */
  addTask(text: string, status: TaskStatus = "todo"): Task {
    const task: Task = {
      id: generateUUID(),
      text: text.trim(),
      status,
      createdAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    this.emit("task:added", task);

    return task;
  }

  /**
   * Update a task's status.
   */
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    blockedReason?: string
  ): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask: Task = {
      ...task,
      status,
      blockedReason: status === "blocked" ? blockedReason : undefined,
    };

    this.tasks.set(taskId, updatedTask);

    // If completing the active task, clear active
    if (status === "done" && this.activeTaskId === taskId) {
      this.activeTaskId = null;
    }

    this.emit("task:updated", updatedTask);

    return updatedTask;
  }

  /**
   * Set the active task.
   */
  setActiveTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Also set status to in_progress if it was todo
    if (task.status === "todo") {
      task.status = "in_progress";
      this.tasks.set(taskId, task);
    }

    const previousActiveId = this.activeTaskId;
    this.activeTaskId = taskId;

    if (previousActiveId !== taskId) {
      this.emit("task:active-changed", task);
    }

    return task;
  }

  /**
   * Remove a task.
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.tasks.delete(taskId);

    // Clear active if it was this task
    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
    }

    this.emit("task:removed", task);

    return true;
  }

  /**
   * Complete the currently active task.
   */
  completeActiveTask(): Task | null {
    if (!this.activeTaskId) return null;

    const task = this.updateTaskStatus(this.activeTaskId, "done");
    this.activeTaskId = null;

    return task;
  }

  /**
   * Clear all completed tasks.
   */
  clearCompletedTasks(): number {
    const completedIds: string[] = [];

    for (const [id, task] of this.tasks) {
      if (task.status === "done") {
        completedIds.push(id);
      }
    }

    for (const id of completedIds) {
      this.tasks.delete(id);
    }

    if (completedIds.length > 0) {
      this.emit("tasks:cleared");
    }

    return completedIds.length;
  }

  /**
   * Clear all tasks.
   */
  clearAllTasks(): number {
    const count = this.tasks.size;
    this.tasks.clear();
    this.activeTaskId = null;

    if (count > 0) {
      this.emit("tasks:cleared");
    }

    return count;
  }

  /**
   * Find a task by text (case-insensitive partial match).
   */
  findTaskByText(searchText: string): Task | undefined {
    const needle = searchText.toLowerCase().trim();
    for (const task of this.tasks.values()) {
      if (task.text.toLowerCase().includes(needle)) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Find or create a task, then set it as active.
   */
  findOrCreateAndStart(text: string): Task {
    let task = this.findTaskByText(text);

    if (!task) {
      task = this.addTask(text, "in_progress");
    }

    this.setActiveTask(task.id);

    return task;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to task events.
   */
  onStateChange(callback: TaskEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(type: TaskEventType, task?: Task): void {
    const event: TaskEvent = {
      type,
      task,
      taskId: task?.id,
      state: this.getState(),
      timestamp: Date.now(),
    };

    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch (error) {
        console.error("[TaskManager] Error in event listener:", error);
      }
    }
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get statistics about tasks.
   */
  getStats(): {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
  } {
    let todo = 0;
    let inProgress = 0;
    let blocked = 0;
    let done = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case "todo":
          todo++;
          break;
        case "in_progress":
          inProgress++;
          break;
        case "blocked":
          blocked++;
          break;
        case "done":
          done++;
          break;
      }
    }

    return {
      total: this.tasks.size,
      todo,
      inProgress,
      blocked,
      done,
    };
  }
}

/**
 * Create a new TaskManager instance.
 */
export function createTaskManager(initialState?: TaskState): TaskManager {
  return new TaskManager(initialState);
}
