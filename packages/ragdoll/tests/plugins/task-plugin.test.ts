import { describe, it, expect, beforeEach } from "bun:test";
import { TaskPlugin } from "../../src/plugins/task-plugin";
import { CharacterController } from "../../src/controllers/character-controller";

describe("TaskPlugin", () => {
  let plugin: TaskPlugin;
  let controller: CharacterController;

  beforeEach(() => {
    plugin = new TaskPlugin();
    controller = new CharacterController();
  });

  describe("plugin interface implementation", () => {
    it("should have name property", () => {
      expect(plugin.name).toBe("tasks");
    });

    it("should initialize with controller", () => {
      plugin.initialize(controller);
      expect(plugin.getTaskController()).toBeDefined();
    });

    it("should update without errors", () => {
      plugin.initialize(controller);
      expect(() => plugin.update(0.1)).not.toThrow();
    });

    it("should destroy without errors", () => {
      plugin.initialize(controller);
      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  describe("integration with CharacterController", () => {
    it("should get task controller from character controller", () => {
      plugin.initialize(controller);
      const taskController = plugin.getTaskController();
      expect(taskController).toBeDefined();
      expect(taskController).toBe(controller.getTaskController());
    });

    it("should clear all tasks on destroy", () => {
      plugin.initialize(controller);
      const taskController = plugin.getTaskController();
      taskController?.addTask("Test task 1");
      taskController?.addTask("Test task 2");
      plugin.destroy();
      const state = taskController?.getState();
      expect(state?.tasks.length).toBe(0);
    });
  });

  describe("state updates", () => {
    it("should not require per-frame updates", () => {
      plugin.initialize(controller);
      // Update should not throw
      expect(() => plugin.update(0.1)).not.toThrow();
    });

    it("should handle multiple update calls", () => {
      plugin.initialize(controller);
      for (let i = 0; i < 10; i++) {
        expect(() => plugin.update(0.1)).not.toThrow();
      }
    });
  });
});

