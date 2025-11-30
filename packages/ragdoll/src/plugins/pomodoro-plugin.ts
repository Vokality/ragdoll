import type { FeaturePlugin } from "./plugin-interface";
import type { CharacterController } from "../controllers/character-controller";
import { PomodoroController } from "../controllers/pomodoro-controller";

/**
 * Pomodoro timer as a feature plugin
 */
export class PomodoroPlugin implements FeaturePlugin {
  readonly name = "pomodoro";
  private pomodoroController: PomodoroController | null = null;

  initialize(controller: CharacterController): void {
    this.pomodoroController = controller.getPomodoroController();
  }

  update(_deltaTime: number): void {
    // PomodoroController manages its own update loop via setInterval
    // No per-frame update needed
  }

  destroy(): void {
    if (this.pomodoroController) {
      this.pomodoroController.reset();
    }
  }

  /**
   * Get the pomodoro controller instance
   */
  public getPomodoroController(): PomodoroController | null {
    return this.pomodoroController;
  }
}

