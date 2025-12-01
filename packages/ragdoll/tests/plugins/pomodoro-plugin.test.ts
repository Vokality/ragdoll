import { describe, it, expect, beforeEach } from "bun:test";
import { PomodoroPlugin } from "../../src/plugins/pomodoro-plugin";
import { CharacterController } from "../../src/controllers/character-controller";

describe("PomodoroPlugin", () => {
  let plugin: PomodoroPlugin;
  let controller: CharacterController;

  beforeEach(() => {
    plugin = new PomodoroPlugin();
    controller = new CharacterController();
  });

  describe("plugin interface implementation", () => {
    it("should have name property", () => {
      expect(plugin.name).toBe("pomodoro");
    });

    it("should initialize with controller", () => {
      plugin.initialize(controller);
      expect(plugin.getPomodoroController()).toBeDefined();
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
    it("should get pomodoro controller from character controller", () => {
      plugin.initialize(controller);
      const pomodoroController = plugin.getPomodoroController();
      expect(pomodoroController).toBeDefined();
      expect(pomodoroController).toBe(controller.getPomodoroController());
    });

    it("should reset pomodoro on destroy", () => {
      plugin.initialize(controller);
      const pomodoroController = plugin.getPomodoroController();
      pomodoroController?.start(5, 1);
      plugin.destroy();
      const state = pomodoroController?.getState();
      expect(state?.state).toBe("idle");
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

