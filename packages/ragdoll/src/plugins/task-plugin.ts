import type { FeaturePlugin } from "./plugin-interface";
import type { CharacterController } from "../controllers/character-controller";
import { TaskController } from "../controllers/task-controller";

/**
 * Task management as a feature plugin
 */
export class TaskPlugin implements FeaturePlugin {
  readonly name = "tasks";
  private taskController: TaskController | null = null;

  initialize(controller: CharacterController): void {
    this.taskController = controller.getTaskController();
  }

  update(_deltaTime: number): void {
    // TaskController doesn't need per-frame updates
  }

  destroy(): void {
    if (this.taskController) {
      // Clear all tasks on destroy
      this.taskController.clearAll();
    }
  }

  /**
   * Get the task controller instance
   */
  public getTaskController(): TaskController | null {
    return this.taskController;
  }
}

