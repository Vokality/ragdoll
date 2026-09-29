import { RagdollSkeleton } from "../models/ragdoll-skeleton";
import { RagdollGeometry } from "../models/ragdoll-geometry";
import type { ExpressionConfig, HeadOffset } from "../models/ragdoll-geometry";
import { ExpressionController } from "./expression-controller";
import { HeadPoseController } from "./head-pose-controller";
import { ActionController } from "./action-controller";
import { IdleController } from "./idle-controller";
import type { IdleState } from "./idle-controller";
import { StateManager } from "../state/state-manager";
import { EventBus } from "../state/event-bus";
import type { FeaturePlugin } from "../plugins/plugin-interface";
import type { RagdollTheme } from "../themes/types";
import { getTheme } from "../themes";
import { getVariant } from "../variants";
import type { CharacterVariant } from "../variants/types";
import type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  JointName,
  HeadPose,
  ExpressionAxes,
  ExpressionAxis,
  ExpressionPatch,
} from "../types";

export class CharacterController {
  private skeleton: RagdollSkeleton;
  private geometry: RagdollGeometry;
  private actionController: ActionController;
  private expressionController: ExpressionController;
  private headPoseController: HeadPoseController;
  private idleController: IdleController;
  private theme: RagdollTheme;
  // The theme with variant color overrides applied; read every frame.
  private resolvedTheme: RagdollTheme;
  private variant: CharacterVariant;
  private stateManager: StateManager;
  private eventBus: EventBus;
  private plugins: Map<string, FeaturePlugin> = new Map();

  constructor(config: {
    themeId: string;
    variantId: string;
    onEventSubscriberError: (error: unknown) => void;
  }) {
    this.skeleton = new RagdollSkeleton();
    this.variant = getVariant(config.variantId);
    this.geometry = new RagdollGeometry(this.variant);
    this.theme = getTheme(config.themeId);
    this.resolvedTheme = this.resolveTheme(this.theme);
    this.headPoseController = new HeadPoseController(this.skeleton);
    this.actionController = new ActionController(this.headPoseController);
    this.expressionController = new ExpressionController(
      this.geometry,
      this.actionController,
    );
    this.idleController = new IdleController();

    // Initialize state management
    this.eventBus = new EventBus(config.onEventSubscriberError);
    const joints: Record<JointName, { x: number; y: number; z: number }> = {
      headPivot: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
    };
    const initialState: CharacterState = {
      headPose: { yaw: 0, pitch: 0 },
      joints,
      mood: "neutral",
      action: null,
      animation: {
        action: null,
        actionProgress: 0,
        isTalking: false,
      },
    };
    this.stateManager = new StateManager(initialState, this.eventBus);
  }

  public executeCommand(command: FacialCommand): void {
    switch (command.action) {
      case "setMood":
        this.setMood(command.params.mood, command.params.duration);
        break;
      case "triggerAction":
        this.triggerAction(command.params.action, command.params.duration);
        break;
      case "clearAction":
        this.clearAction();
        break;
      case "setHeadPose":
        this.setHeadPose(command.params, command.params.duration);
        break;
      case "setExpression": {
        const { duration, ...patch } = command.params;
        this.setExpression(patch, duration);
        break;
      }
      case "resetExpression":
        this.resetExpression(command.params.axes, command.params.duration);
        break;
    }
  }

  public setMood(mood: FacialMood, duration?: number): void {
    const previousMood = this.expressionController.getCurrentMood();
    this.expressionController.setMood(mood, duration);
    this.stateManager.setMood(mood, previousMood);
  }

  public setExpression(patch: ExpressionPatch, duration?: number): void {
    this.expressionController.setExpression(patch, duration);
  }

  public resetExpression(
    axes?: readonly ExpressionAxis[],
    duration?: number,
  ): void {
    this.expressionController.resetExpression(axes, duration);
  }

  public triggerAction(
    action: Exclude<FacialAction, "none">,
    duration?: number,
  ): void {
    this.actionController.triggerAction(action, duration);
    this.stateManager.setAction(action, duration);
  }

  public clearAction(): void {
    this.actionController.clearAction();
    this.stateManager.setAction(null);
  }

  public setHeadPose(pose: Partial<HeadPose>, duration?: number): void {
    // The state manager picks up the pose as it moves in the update loop.
    this.headPoseController.setTargetPose(pose, duration);
  }

  public nudgeHead(delta: Partial<HeadPose>, duration?: number): void {
    this.headPoseController.nudge(delta, duration);
  }
  public update(deltaTime: number): void {
    // Update action controller (handles shake and other actions)
    this.actionController.update(deltaTime);
    this.expressionController.update(deltaTime);
    // People blink as their gaze shifts; it sells a moving mood like thinking.
    if (this.expressionController.consumePoseChange())
      this.idleController.triggerBlink();
    this.headPoseController.update(deltaTime);
    this.idleController.update(deltaTime);
    this.skeleton.update(deltaTime);

    // Update plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.update) {
        plugin.update(deltaTime);
      }
    }

    // Sync state manager with current controller states
    const currentPose = this.headPoseController.getPose();
    this.stateManager.setHeadPose(currentPose);
    // triggerAction/clearAction already announced explicit changes; only a
    // natural completion needs syncing here.
    if (
      this.actionController.getActiveAction() === null &&
      this.stateManager.getState().action !== null
    ) {
      this.stateManager.setAction(null);
    }
    this.stateManager.setActionProgress(
      this.actionController.getActionProgress(),
    );
    this.stateManager.setIsTalking(this.actionController.isTalking());
  }

  public getState(): CharacterState {
    // Update joints from skeleton
    const joint = (name: JointName) => ({
      x: 0,
      y: this.skeleton.getJointRotation(name),
      z: 0,
    });
    this.stateManager.setJoints({
      headPivot: joint("headPivot"),
      neck: joint("neck"),
    });

    // Get state from StateManager (single source of truth)
    return this.stateManager.getState();
  }

  /**
   * Get the event bus for subscribing to state changes
   */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getExpression(): ExpressionConfig {
    return this.expressionController.getExpression();
  }

  public getAxisOverlay(): Readonly<Partial<ExpressionAxes>> {
    return this.expressionController.getAxisOverlay();
  }

  public getMixedExpression(): ExpressionConfig {
    return this.expressionController.getMixedExpression();
  }

  public getExpressionWithAction(): ExpressionConfig {
    return this.expressionController.getExpressionWithAction();
  }

  /**
   * Head movement the current mood adds for rendering. It is not part of
   * `getState().headPose`, which stays the commanded pose.
   */
  public getMoodHeadOffset(): Readonly<HeadOffset> {
    return this.expressionController.getHeadOffset();
  }

  public getGeometry(): RagdollGeometry {
    return this.geometry;
  }

  public getIdleState(): IdleState {
    return this.idleController.getState();
  }

  public triggerBlink(): void {
    this.idleController.triggerBlink();
  }

  public setIdleEnabled(enabled: boolean): void {
    this.idleController.setEnabled(enabled);
  }

  public getTheme(): RagdollTheme {
    return this.resolvedTheme;
  }

  private resolveTheme(theme: RagdollTheme): RagdollTheme {
    const overrides = this.variant.colorOverrides;
    if (!overrides) {
      return theme;
    }
    const { colors } = theme;
    return {
      ...theme,
      colors: {
        ...colors,
        hair: { ...colors.hair, ...overrides.hair },
        eyes: { ...colors.eyes, ...overrides.eyes },
        skin: { ...colors.skin, ...overrides.skin },
        lips: { ...colors.lips, ...overrides.lips },
      },
    };
  }

  public setTheme(themeId: string): void {
    const theme = getTheme(themeId);
    if (theme === this.theme) return;
    this.theme = theme;
    this.resolvedTheme = this.resolveTheme(theme);
    this.eventBus.emit({ type: "themeChanged", themeId: theme.id });
  }

  public getThemeId(): string {
    return this.theme.id;
  }

  /**
   * Register a feature plugin
   */
  public registerPlugin(plugin: FeaturePlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    plugin.initialize(this);
  }

  /**
   * Unregister a feature plugin
   */
  public unregisterPlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      if (plugin.destroy) {
        plugin.destroy();
      }
      this.plugins.delete(pluginName);
    }
  }

  /**
   * Destroy registered plugins and drop event subscribers
   */
  public destroy(): void {
    this.idleController.reset();
    this.eventBus.clearSubscribers();

    // Destroy all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        plugin.destroy();
      }
    }
    this.plugins.clear();
  }
}
