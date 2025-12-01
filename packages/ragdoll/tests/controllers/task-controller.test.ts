import { describe, it, expect, beforeEach } from "bun:test";
import { TaskController } from "../../src/controllers/task-controller";

describe("TaskController", () => {
  let controller: TaskController;

  beforeEach(() => {
    controller = new TaskController();
  });

  describe("addTask", () => {
    it("should add task with default todo status", () => {
      const task = controller.addTask("Test task");
      expect(task.text).toBe("Test task");
      expect(task.status).toBe("todo");
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
    });

    it("should add task with specified status", () => {
      const task = controller.addTask("Test task", "in_progress");
      expect(task.status).toBe("in_progress");
    });

    it("should make in_progress task active", () => {
      const task = controller.addTask("Test task", "in_progress");
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task.id);
    });

    it("should activate existing task when adding duplicate as in_progress", () => {
      const task1 = controller.addTask("Test task", "todo");
      const task2 = controller.addTask("Test task", "in_progress");
      expect(task2.id).toBe(task1.id);
      expect(task2.status).toBe("in_progress");
    });

    it("should not activate done task when adding duplicate", () => {
      const task1 = controller.addTask("Test task", "done");
      const task2 = controller.addTask("Test task", "in_progress");
      expect(task2.id).not.toBe(task1.id);
    });

    it("should reset other in_progress tasks when adding new one", () => {
      const task1 = controller.addTask("Task 1", "in_progress");
      const task2 = controller.addTask("Task 2", "in_progress");
      const state = controller.getState();
      const t1 = state.tasks.find((t) => t.id === task1.id);
      const t2 = state.tasks.find((t) => t.id === task2.id);
      expect(t1?.status).toBe("todo");
      expect(t2?.status).toBe("in_progress");
      expect(state.activeTaskId).toBe(task2.id);
    });
  });

  describe("removeTask", () => {
    it("should remove task by id", () => {
      const task = controller.addTask("Test task");
      controller.removeTask(task.id);
      const state = controller.getState();
      expect(state.tasks.find((t) => t.id === task.id)).toBeUndefined();
    });

    it("should clear active task if removed", () => {
      const task = controller.addTask("Test task", "in_progress");
      controller.removeTask(task.id);
      const state = controller.getState();
      expect(state.activeTaskId).toBeNull();
    });

    it("should activate next todo task when active task is removed", () => {
      const task1 = controller.addTask("Task 1", "todo");
      const task2 = controller.addTask("Task 2", "in_progress");
      controller.removeTask(task2.id);
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task1.id);
      const t1 = state.tasks.find((t) => t.id === task1.id);
      expect(t1?.status).toBe("in_progress");
    });

    it("should do nothing if task doesn't exist", () => {
      const initialState = controller.getState();
      controller.removeTask("nonexistent");
      const finalState = controller.getState();
      expect(finalState.tasks.length).toBe(initialState.tasks.length);
    });
  });

  describe("updateTaskStatus", () => {
    it("should update task status", () => {
      const task = controller.addTask("Test task", "todo");
      controller.updateTaskStatus(task.id, "in_progress");
      const state = controller.getState();
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.status).toBe("in_progress");
    });

    it("should set blocked reason when blocking task", () => {
      const task = controller.addTask("Test task");
      controller.updateTaskStatus(task.id, "blocked", "Waiting for dependency");
      const state = controller.getState();
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.status).toBe("blocked");
      expect(updatedTask?.blockedReason).toBe("Waiting for dependency");
    });

    it("should clear blocked reason when unblocking", () => {
      const task = controller.addTask("Test task");
      controller.updateTaskStatus(task.id, "blocked", "Reason");
      controller.updateTaskStatus(task.id, "todo");
      const state = controller.getState();
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.blockedReason).toBeUndefined();
    });

    it("should make task active when setting to in_progress", () => {
      const task = controller.addTask("Test task", "todo");
      controller.updateTaskStatus(task.id, "in_progress");
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task.id);
    });

    it("should reset other in_progress tasks when updating to in_progress", () => {
      const task1 = controller.addTask("Task 1", "in_progress");
      const task2 = controller.addTask("Task 2", "todo");
      controller.updateTaskStatus(task2.id, "in_progress");
      const state = controller.getState();
      const t1 = state.tasks.find((t) => t.id === task1.id);
      expect(t1?.status).toBe("todo");
      expect(state.activeTaskId).toBe(task2.id);
    });

    it("should clear active task when marking as done", () => {
      const task = controller.addTask("Test task", "in_progress");
      controller.updateTaskStatus(task.id, "done");
      const state = controller.getState();
      expect(state.activeTaskId).toBeNull();
    });

    it("should activate next todo task when active task is done", () => {
      const task1 = controller.addTask("Task 1", "todo");
      const task2 = controller.addTask("Task 2", "in_progress");
      controller.updateTaskStatus(task2.id, "done");
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task1.id);
      const t1 = state.tasks.find((t) => t.id === task1.id);
      expect(t1?.status).toBe("in_progress");
    });

    it("should clear active task when blocking", () => {
      const task = controller.addTask("Test task", "in_progress");
      controller.updateTaskStatus(task.id, "blocked", "Reason");
      const state = controller.getState();
      expect(state.activeTaskId).toBeNull();
    });

    it("should do nothing if task doesn't exist", () => {
      const initialState = controller.getState();
      controller.updateTaskStatus("nonexistent", "done");
      const finalState = controller.getState();
      expect(finalState.tasks.length).toBe(initialState.tasks.length);
    });
  });

  describe("setActiveTask", () => {
    it("should set task as active", () => {
      const task = controller.addTask("Test task", "todo");
      controller.setActiveTask(task.id);
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task.id);
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.status).toBe("in_progress");
    });

    it("should reset other in_progress tasks", () => {
      const task1 = controller.addTask("Task 1", "in_progress");
      const task2 = controller.addTask("Task 2", "todo");
      controller.setActiveTask(task2.id);
      const state = controller.getState();
      const t1 = state.tasks.find((t) => t.id === task1.id);
      expect(t1?.status).toBe("todo");
    });

    it("should clear blocked reason when activating", () => {
      const task = controller.addTask("Test task", "blocked");
      controller.setActiveTask(task.id);
      const state = controller.getState();
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.blockedReason).toBeUndefined();
    });

    it("should not activate done task", () => {
      const task = controller.addTask("Test task", "done");
      controller.setActiveTask(task.id);
      const state = controller.getState();
      expect(state.activeTaskId).not.toBe(task.id);
    });

    it("should do nothing if task doesn't exist", () => {
      const initialState = controller.getState();
      controller.setActiveTask("nonexistent");
      const finalState = controller.getState();
      expect(finalState.activeTaskId).toBe(initialState.activeTaskId);
    });
  });

  describe("completeActiveTask", () => {
    it("should complete active task", () => {
      const task = controller.addTask("Test task", "in_progress");
      controller.completeActiveTask();
      const state = controller.getState();
      const updatedTask = state.tasks.find((t) => t.id === task.id);
      expect(updatedTask?.status).toBe("done");
    });

    it("should do nothing if no active task", () => {
      controller.completeActiveTask();
      const state = controller.getState();
      expect(state.activeTaskId).toBeNull();
    });
  });

  describe("clearCompleted", () => {
    it("should remove all done tasks", () => {
      controller.addTask("Task 1", "done");
      controller.addTask("Task 2", "todo");
      controller.addTask("Task 3", "done");
      controller.clearCompleted();
      const state = controller.getState();
      expect(state.tasks.length).toBe(1);
      expect(state.tasks[0].status).toBe("todo");
    });

    it("should preserve active task if not done", () => {
      const task = controller.addTask("Task 1", "in_progress");
      controller.addTask("Task 2", "done");
      controller.clearCompleted();
      const state = controller.getState();
      expect(state.activeTaskId).toBe(task.id);
    });
  });

  describe("clearAll", () => {
    it("should remove all tasks", () => {
      controller.addTask("Task 1");
      controller.addTask("Task 2");
      controller.clearAll();
      const state = controller.getState();
      expect(state.tasks.length).toBe(0);
      expect(state.activeTaskId).toBeNull();
    });
  });

  describe("expand/collapse/toggle", () => {
    it("should expand task drawer", () => {
      controller.expand();
      const state = controller.getState();
      expect(state.isExpanded).toBe(true);
    });

    it("should collapse task drawer", () => {
      controller.expand();
      controller.collapse();
      const state = controller.getState();
      expect(state.isExpanded).toBe(false);
    });

    it("should toggle task drawer", () => {
      const initialState = controller.getState();
      controller.toggle();
      const toggledState = controller.getState();
      expect(toggledState.isExpanded).toBe(!initialState.isExpanded);
      controller.toggle();
      const backState = controller.getState();
      expect(backState.isExpanded).toBe(initialState.isExpanded);
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = controller.getState();
      expect(state.tasks).toEqual([]);
      expect(state.activeTaskId).toBeNull();
      expect(state.isExpanded).toBe(false);
    });

    it("should return copy of tasks array", () => {
      controller.addTask("Test task");
      const state1 = controller.getState();
      const state2 = controller.getState();
      expect(state1.tasks).not.toBe(state2.tasks);
      expect(state1.tasks).toEqual(state2.tasks);
    });
  });

  describe("getActiveTask", () => {
    it("should return active task", () => {
      const task = controller.addTask("Test task", "in_progress");
      const activeTask = controller.getActiveTask();
      expect(activeTask?.id).toBe(task.id);
    });

    it("should return null if no active task", () => {
      expect(controller.getActiveTask()).toBeNull();
    });
  });

  describe("getCounts", () => {
    it("should return task counts by status", () => {
      controller.addTask("Task 1", "todo");
      controller.addTask("Task 2", "todo");
      controller.addTask("Task 3", "in_progress");
      controller.addTask("Task 4", "blocked");
      controller.addTask("Task 5", "done");
      controller.addTask("Task 6", "done");
      const counts = controller.getCounts();
      expect(counts.todo).toBe(2);
      expect(counts.in_progress).toBe(1);
      expect(counts.blocked).toBe(1);
      expect(counts.done).toBe(2);
    });

    it("should return zero counts for empty list", () => {
      const counts = controller.getCounts();
      expect(counts.todo).toBe(0);
      expect(counts.in_progress).toBe(0);
      expect(counts.blocked).toBe(0);
      expect(counts.done).toBe(0);
    });
  });

  describe("findTaskByText", () => {
    it("should find task by text", () => {
      const task = controller.addTask("Test task");
      const found = controller.findTaskByText("Test task");
      expect(found?.id).toBe(task.id);
    });

    it("should be case-insensitive", () => {
      const task = controller.addTask("Test Task");
      const found = controller.findTaskByText("test task");
      expect(found?.id).toBe(task.id);
    });

    it("should trim whitespace", () => {
      const task = controller.addTask("Test task");
      const found = controller.findTaskByText("  Test task  ");
      expect(found?.id).toBe(task.id);
    });

    it("should return null if not found", () => {
      expect(controller.findTaskByText("Nonexistent")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty task list", () => {
      const state = controller.getState();
      expect(state.tasks.length).toBe(0);
      expect(state.activeTaskId).toBeNull();
    });

    it("should handle duplicate task IDs (should not happen, but test robustness)", () => {
      // This tests the system's behavior with edge cases
      const task1 = controller.addTask("Task 1");
      const task2 = controller.addTask("Task 2");
      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe("update callbacks", () => {
    it("should register update callback", () => {
      let callbackCalled = false;
      const unsubscribe = controller.onUpdate(() => {
        callbackCalled = true;
      });
      controller.addTask("Test task");
      expect(callbackCalled).toBe(true);
      unsubscribe();
    });

    it("should unregister update callback", () => {
      let callbackCalled = false;
      const unsubscribe = controller.onUpdate(() => {
        callbackCalled = true;
      });
      unsubscribe();
      controller.addTask("Test task");
      // Callback should not be called after unsubscribe
      expect(callbackCalled).toBe(false);
    });

    it("should call multiple callbacks", () => {
      let callCount = 0;
      controller.onUpdate(() => {
        callCount++;
      });
      controller.onUpdate(() => {
        callCount++;
      });
      controller.addTask("Test task");
      expect(callCount).toBe(2);
    });

    it("should handle callback errors gracefully", () => {
      controller.onUpdate(() => {
        throw new Error("Test error");
      });
      controller.onUpdate(() => {
        // Should still be called
      });
      // Should not throw
      expect(() => controller.addTask("Test task")).not.toThrow();
    });
  });
});

