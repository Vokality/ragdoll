/**
 * Task controller
 * Manages task list state with todo, in_progress, blocked, done statuses
 */

import type { Task, TaskStatus, TaskState } from "../types";

type TaskCallback = (state: TaskState) => void;

let taskIdCounter = 0;

function generateTaskId(): string {
  taskIdCounter += 1;
  return `task-${Date.now()}-${taskIdCounter}`;
}

export class TaskController {
  private tasks: Task[] = [];
  private activeTaskId: string | null = null;
  private isExpanded = false;
  private updateCallbacks: TaskCallback[] = [];

  /**
   * Add a new task
   */
  public addTask(text: string, status: TaskStatus = "todo"): Task {
    const task: Task = {
      id: generateTaskId(),
      text,
      status,
      createdAt: Date.now(),
    };

    this.tasks.push(task);

    // If this is the first in_progress task, make it active
    if (status === "in_progress" && this.activeTaskId === null) {
      this.activeTaskId = task.id;
    }

    this.notifyCallbacks();
    return task;
  }

  /**
   * Update a task's status
   */
  public updateTaskStatus(taskId: string, status: TaskStatus, blockedReason?: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }

    task.status = status;

    if (status === "blocked" && blockedReason) {
      task.blockedReason = blockedReason;
    } else {
      delete task.blockedReason;
    }

    // If setting to in_progress, make it the active task
    if (status === "in_progress") {
      // Set any other in_progress tasks back to todo
      this.tasks.forEach((t) => {
        if (t.id !== taskId && t.status === "in_progress") {
          t.status = "todo";
        }
      });
      this.activeTaskId = taskId;
    }

    // If the active task is done or blocked, clear active
    if (this.activeTaskId === taskId && (status === "done" || status === "blocked")) {
      this.activeTaskId = null;
      // Find next todo task to make active
      const nextTodo = this.tasks.find((t) => t.status === "todo");
      if (nextTodo) {
        nextTodo.status = "in_progress";
        this.activeTaskId = nextTodo.id;
      }
    }

    this.notifyCallbacks();
  }

  /**
   * Set a task as the active (in_progress) task
   */
  public setActiveTask(taskId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || task.status === "done") {
      return;
    }

    // Reset current in_progress tasks
    this.tasks.forEach((t) => {
      if (t.status === "in_progress") {
        t.status = "todo";
      }
    });

    task.status = "in_progress";
    this.activeTaskId = taskId;
    this.notifyCallbacks();
  }

  /**
   * Remove a task
   */
  public removeTask(taskId: string): void {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      return;
    }

    this.tasks.splice(index, 1);

    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
      // Find next in_progress or todo task
      const next = this.tasks.find((t) => t.status === "in_progress" || t.status === "todo");
      if (next) {
        if (next.status === "todo") {
          next.status = "in_progress";
        }
        this.activeTaskId = next.id;
      }
    }

    this.notifyCallbacks();
  }

  /**
   * Complete the active task
   */
  public completeActiveTask(): void {
    if (this.activeTaskId) {
      this.updateTaskStatus(this.activeTaskId, "done");
    }
  }

  /**
   * Clear all completed tasks
   */
  public clearCompleted(): void {
    this.tasks = this.tasks.filter((t) => t.status !== "done");
    this.notifyCallbacks();
  }

  /**
   * Clear all tasks
   */
  public clearAll(): void {
    this.tasks = [];
    this.activeTaskId = null;
    this.notifyCallbacks();
  }

  /**
   * Expand the task drawer
   */
  public expand(): void {
    this.isExpanded = true;
    this.notifyCallbacks();
  }

  /**
   * Collapse the task drawer
   */
  public collapse(): void {
    this.isExpanded = false;
    this.notifyCallbacks();
  }

  /**
   * Toggle the task drawer
   */
  public toggle(): void {
    this.isExpanded = !this.isExpanded;
    this.notifyCallbacks();
  }

  /**
   * Get current state
   */
  public getState(): TaskState {
    return {
      tasks: [...this.tasks],
      activeTaskId: this.activeTaskId,
      isExpanded: this.isExpanded,
    };
  }

  /**
   * Get the active task
   */
  public getActiveTask(): Task | null {
    if (!this.activeTaskId) {
      return null;
    }
    return this.tasks.find((t) => t.id === this.activeTaskId) ?? null;
  }

  /**
   * Get task counts by status
   */
  public getCounts(): Record<TaskStatus, number> {
    const counts: Record<TaskStatus, number> = {
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    };

    this.tasks.forEach((t) => {
      counts[t.status] += 1;
    });

    return counts;
  }

  /**
   * Register callback for state updates
   */
  public onUpdate(callback: TaskCallback): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all callbacks of state change
   */
  private notifyCallbacks(): void {
    const state = this.getState();
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error("Task callback error:", error);
      }
    });
  }
}

