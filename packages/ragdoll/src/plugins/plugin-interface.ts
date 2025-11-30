import type { CharacterController } from "../controllers/character-controller";

/**
 * Interface for feature plugins that extend CharacterController
 */
export interface FeaturePlugin {
  /**
   * Plugin name/identifier
   */
  readonly name: string;

  /**
   * Initialize the plugin with the character controller
   */
  initialize(controller: CharacterController): void;

  /**
   * Update plugin state (called every frame)
   */
  update?(deltaTime: number): void;

  /**
   * Cleanup when plugin is removed
   */
  destroy?(): void;
}

