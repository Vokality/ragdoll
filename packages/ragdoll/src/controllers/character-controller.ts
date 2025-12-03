import { RagdollSkeleton } from "../models/ragdoll-skeleton";
import { RagdollGeometry } from "../models/ragdoll-geometry";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import { ExpressionController } from "./expression-controller";
import { HeadPoseController } from "./head-pose-controller";
import { ActionController } from "./action-controller";
import { IdleController } from "./idle-controller";
import type { IdleState } from "./idle-controller";
import { PomodoroController } from "./pomodoro-controller";
import { TaskController } from "./task-controller";
import { StateManager } from "../state/state-manager";
import { EventBus } from "../state/event-bus";
import type { FeaturePlugin } from "../plugins/plugin-interface";
import type {
  PomodoroStateData,
  PomodoroDuration,
  TaskStatus,
  Task,
  TaskState,
} from "../types";
import type { RagdollTheme } from "../themes/types";
import { getTheme, getDefaultTheme } from "../themes";
import { getVariant, getDefaultVariant } from "../variants";
import type { CharacterVariant } from "../variants/types";
import type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  SpeechBubblePayload,
  SpeechBubbleState,
  JointCommand,
  JointName,
  HeadPose,
} from "../types";

export class CharacterController {
  private skeleton: RagdollSkeleton;
  private geometry: RagdollGeometry;
  private actionController: ActionController;
  private expressionController: ExpressionController;
  private headPoseController: HeadPoseController;
  private idleController: IdleController;
  private pomodoroController: PomodoroController;
  private taskController: TaskController;
  private speechBubble: SpeechBubbleState = { text: null, tone: "default" };
  private theme: RagdollTheme;
  private variant: CharacterVariant;
  private lastPomodoroState: PomodoroStateData | null = null;
  private lastReminderTime: number | null = null;
  private pomodoroUnsubscribe?: () => void;
  private stateManager: StateManager;
  private eventBus: EventBus;
  private plugins: Map<string, FeaturePlugin> = new Map();

  constructor(themeId?: string, variantId?: string) {
    this.skeleton = new RagdollSkeleton();
    this.variant = variantId ? getVariant(variantId) : getDefaultVariant();
    this.geometry = new RagdollGeometry(this.variant);
    this.theme = themeId ? getTheme(themeId) : getDefaultTheme();
    this.headPoseController = new HeadPoseController(this.skeleton);
    this.actionController = new ActionController(this.headPoseController);
    this.expressionController = new ExpressionController(
      this.geometry,
      this.actionController,
    );
    this.idleController = new IdleController();
    this.pomodoroController = new PomodoroController();
    this.taskController = new TaskController();

    // Initialize state management
    this.eventBus = new EventBus();
    const joints: Record<JointName, { x: number; y: number; z: number }> = {
      headPivot: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
    };
    const initialState: CharacterState = {
      headPose: { yaw: 0, pitch: 0 },
      joints,
      mood: "neutral",
      action: null,
      bubble: { text: null, tone: "default" },
      animation: {
        action: null,
        actionProgress: 0,
        isTalking: false,
      },
    };
    this.stateManager = new StateManager(initialState, this.eventBus);

    // Set up pomodoro reminders
    this.pomodoroUnsubscribe = this.pomodoroController.onUpdate((state) => {
      this.handlePomodoroUpdate(state);
    });
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
      case "setSpeechBubble":
        this.setSpeechBubble(command.params);
        break;
    }
  }

  public setMood(mood: FacialMood, duration?: number): void {
    const previousMood = this.expressionController.getCurrentMood();
    this.expressionController.setMood(mood, duration);
    this.stateManager.setMood(mood, previousMood);
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
    this.headPoseController.setTargetPose(pose, duration);
    // Update state manager with current pose (will be updated in update loop)
    const currentPose = this.headPoseController.getPose();
    this.stateManager.setHeadPose(currentPose);
  }

  public nudgeHead(delta: Partial<HeadPose>, duration?: number): void {
    this.headPoseController.nudge(delta, duration);
  }

  public setSpeechBubble(payload: SpeechBubblePayload): void {
    this.speechBubble = {
      text: payload.text,
      tone: payload.tone ?? "default",
    };
    this.stateManager.setSpeechBubble(this.speechBubble);

    if (payload.text) {
      const duration = this.calculateTalkDuration(payload.text);
      if (!this.actionController.isTalking()) {
        this.actionController.triggerAction("talk", duration);
      } else {
        // Update duration if already talking (restart with new duration)
        this.actionController.triggerAction("talk", duration);
      }
    } else {
      if (this.actionController.isTalking()) {
        this.actionController.clearAction();
      }
    }
  }

  /**
   * Calculate talk duration based on text length using average reading speed.
   * Uses ~3.5 words/second (200-250 words/minute) with a minimum duration.
   */
  private calculateTalkDuration(text: string): number {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const wordCount = words.length;
    // Average reading speed: ~3.5 words/second = ~0.29 seconds/word
    // Add 0.2s buffer for natural feel
    const duration = Math.max(0.5, wordCount / 3.5 + 0.2);
    return duration;
  }

  public setJointRotation(command: JointCommand): void {
    const angle = command.angle ?? command.rotation;
    if (!angle) return;

    const rotation = angle.y ?? angle.x ?? 0;
    this.skeleton.setJointRotation(command.joint, rotation);
  }

  public getJointRotation(joint: JointName): number | null {
    return this.skeleton.getJointRotation(joint);
  }

  public update(deltaTime: number): void {
    // Update action controller (handles shake and other actions)
    this.actionController.update(deltaTime);
    this.expressionController.update(deltaTime);
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
    this.stateManager.setAction(this.actionController.getActiveAction());
    this.stateManager.setActionProgress(
      this.actionController.getActionProgress(),
    );
    this.stateManager.setIsTalking(this.actionController.isTalking());
  }

  public getState(): CharacterState {
    // Update joints from skeleton
    const joints: Record<JointName, { x: number; y: number; z: number }> =
      {} as Record<JointName, { x: number; y: number; z: number }>;
    this.skeleton.skeleton.joints.forEach((_joint, name) => {
      const rotation = this.skeleton.getJointRotation(name);
      if (rotation !== null) {
        joints[name] = { x: 0, y: rotation, z: 0 };
      }
    });
    this.stateManager.setJoints(joints);

    // Get state from StateManager (single source of truth)
    return this.stateManager.getState();
  }

  /**
   * Get the event bus for subscribing to state changes
   */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getSpeechBubble(): SpeechBubbleState {
    return { ...this.speechBubble };
  }

  public getHeadWorldPosition(): { x: number; y: number; z: number } {
    return { x: 0, y: -200, z: 0 };
  }

  public getExpression(): ExpressionConfig {
    return this.expressionController.getExpression();
  }

  public getExpressionWithAction(): ExpressionConfig {
    return this.expressionController.getExpressionWithAction();
  }

  public getGeometry(): RagdollGeometry {
    return this.geometry;
  }

  public getIdleState(): IdleState {
    return this.idleController.getState();
  }

  public getIdleController(): IdleController {
    return this.idleController;
  }

  public triggerBlink(): void {
    this.idleController.triggerBlink();
  }

  public setIdleEnabled(enabled: boolean): void {
    this.idleController.setEnabled(enabled);
  }

  public getTheme(): RagdollTheme {
    // Merge variant color overrides into theme
    if (!this.variant.colorOverrides) {
      return this.theme;
    }

    // Merge color overrides
    const mergedColors = {
      ...this.theme.colors,
      ...(this.variant.colorOverrides.hair && {
        hair: {
          ...this.theme.colors.hair,
          ...this.variant.colorOverrides.hair,
        },
      }),
      ...(this.variant.colorOverrides.eyes && {
        eyes: {
          ...this.theme.colors.eyes,
          ...this.variant.colorOverrides.eyes,
        },
      }),
      ...(this.variant.colorOverrides.skin && {
        skin: {
          ...this.theme.colors.skin,
          ...this.variant.colorOverrides.skin,
        },
      }),
      ...(this.variant.colorOverrides.lips && {
        lips: {
          ...this.theme.colors.lips,
          ...this.variant.colorOverrides.lips,
        },
      }),
    };

    // Rebuild gradients that use overridden colors
    const mergedGradients = { ...this.theme.gradients };

    // Rebuild hair gradient if hair colors were overridden
    if (this.variant.colorOverrides.hair) {
      mergedGradients.hairGradient = {
        type: "linear",
        x1: "0%",
        y1: "0%",
        x2: "0%",
        y2: "100%",
        stops: [
          { offset: "0%", stopColor: mergedColors.hair.light },
          { offset: "40%", stopColor: mergedColors.hair.mid },
          { offset: "100%", stopColor: mergedColors.hair.dark },
        ],
      };
    }

    // Rebuild iris gradient if eye colors were overridden
    if (this.variant.colorOverrides.eyes) {
      mergedGradients.irisGradient = {
        type: "radial",
        cx: "50%",
        cy: "50%",
        r: "50%",
        stops: [
          { offset: "0%", stopColor: mergedColors.eyes.iris },
          { offset: "50%", stopColor: mergedColors.eyes.irisMid },
          { offset: "100%", stopColor: mergedColors.eyes.irisDark },
        ],
      };
    }

    // Rebuild skin gradients if skin colors were overridden
    if (this.variant.colorOverrides.skin) {
      mergedGradients.skinGradient = {
        type: "linear",
        x1: "0%",
        y1: "0%",
        x2: "0%",
        y2: "100%",
        stops: [
          { offset: "0%", stopColor: mergedColors.skin.light },
          { offset: "50%", stopColor: mergedColors.skin.mid },
          { offset: "100%", stopColor: mergedColors.skin.dark },
        ],
      };

      mergedGradients.skinRadial = {
        type: "radial",
        cx: "40%",
        cy: "30%",
        r: "70%",
        stops: [
          { offset: "0%", stopColor: mergedColors.skin.radial },
          { offset: "100%", stopColor: mergedColors.skin.dark },
        ],
      };
    }

    // Rebuild lip gradients if lip colors were overridden
    if (this.variant.colorOverrides.lips) {
      mergedGradients.upperLipGradient = {
        type: "linear",
        x1: "0%",
        y1: "0%",
        x2: "0%",
        y2: "100%",
        stops: [
          { offset: "0%", stopColor: mergedColors.lips.upper },
          { offset: "100%", stopColor: mergedColors.lips.upperDark },
        ],
      };

      mergedGradients.lowerLipGradient = {
        type: "linear",
        x1: "0%",
        y1: "0%",
        x2: "0%",
        y2: "100%",
        stops: [
          { offset: "0%", stopColor: mergedColors.lips.lower },
          { offset: "100%", stopColor: mergedColors.lips.lowerDark },
        ],
      };
    }

    const mergedTheme: RagdollTheme = {
      ...this.theme,
      colors: mergedColors,
      gradients: mergedGradients,
    };

    return mergedTheme;
  }

  public setTheme(themeId: string): void {
    this.theme = getTheme(themeId);
  }

  public getThemeId(): string {
    return this.theme.id;
  }

  public getPomodoroController(): PomodoroController {
    return this.pomodoroController;
  }

  /**
   * Get current pomodoro state
   */
  public getPomodoroState(): PomodoroStateData {
    return this.pomodoroController.getState();
  }

  /**
   * Start pomodoro session
   */
  public startPomodoro(
    sessionDuration?: PomodoroDuration,
    breakDuration?: PomodoroDuration,
  ): void {
    this.pomodoroController.start(sessionDuration, breakDuration);
  }

  /**
   * Pause pomodoro session
   */
  public pausePomodoro(): void {
    this.pomodoroController.pause();
  }

  /**
   * Reset pomodoro timer
   */
  public resetPomodoro(): void {
    this.pomodoroController.reset();
  }

  /**
   * Handle pomodoro state updates and show reminders
   */
  private handlePomodoroUpdate(state: PomodoroStateData): void {
    const now = Date.now();

    // Handle state transitions
    if (this.lastPomodoroState) {
      const prevState = this.lastPomodoroState.state;
      const prevIsBreak = this.lastPomodoroState.isBreak;

      // Session started
      if (prevState === "idle" && state.state === "running" && !state.isBreak) {
        const durationLabel = this.getDurationLabel(state.sessionDuration);
        this.setSpeechBubble({
          text: `Focus time started! 🍅 (${durationLabel})`,
          tone: "default",
        });
        this.lastReminderTime = now;
      }
      // Session completed, break started
      else if (
        prevState === "running" &&
        !prevIsBreak &&
        state.state === "running" &&
        state.isBreak
      ) {
        const breakLabel = this.getDurationLabel(state.breakDuration);
        this.setSpeechBubble({
          text: `Time for a break! ☕ (${breakLabel})`,
          tone: "default",
        });
        this.lastReminderTime = now;
      }
      // Break completed
      else if (
        prevState === "running" &&
        prevIsBreak &&
        state.state === "idle"
      ) {
        this.setSpeechBubble({
          text: "Break's over, back to work! 💪",
          tone: "default",
        });
        this.lastReminderTime = now;
      }
    }

    // Show 5-minute warning (only once per session)
    if (
      state.state === "running" &&
      state.remainingTime <= 300 && // 5 minutes
      state.remainingTime > 299 &&
      (!this.lastReminderTime || now - this.lastReminderTime > 60000) // Don't spam
    ) {
      this.setSpeechBubble({
        text: "5 minutes left in this session",
        tone: "whisper",
      });
      this.lastReminderTime = now;
    }

    this.lastPomodoroState = { ...state };
  }

  /**
   * Get human-readable duration label
   */
  private getDurationLabel(duration: PomodoroDuration): string {
    if (duration === 15) return "15 min";
    if (duration === 30) return "30 min";
    if (duration === 60) return "1 hour";
    if (duration === 120) return "2 hours";
    return `${duration} min`;
  }

  // Task management methods

  public getTaskController(): TaskController {
    return this.taskController;
  }

  /**
   * Replace the current task state
   */
  public loadTaskState(state: TaskState): void {
    this.taskController.loadState(state);
  }

  /**
   * Add a new task
   */
  public addTask(text: string, status: TaskStatus = "todo"): void {
    this.taskController.addTask(text, status);
  }

  /**
   * Update a task's status
   */
  public updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    blockedReason?: string,
  ): void {
    this.taskController.updateTaskStatus(taskId, status, blockedReason);
  }

  /**
   * Set a task as the active task
   */
  public setActiveTask(taskId: string): void {
    this.taskController.setActiveTask(taskId);
  }

  /**
   * Remove a task
   */
  public removeTask(taskId: string): void {
    this.taskController.removeTask(taskId);
  }

  /**
   * Complete the active task
   */
  public completeActiveTask(): void {
    this.taskController.completeActiveTask();
  }

  /**
   * Clear completed tasks
   */
  public clearCompletedTasks(): void {
    this.taskController.clearCompleted();
  }

  /**
   * Clear all tasks
   */
  public clearAllTasks(): void {
    this.taskController.clearAll();
  }

  /**
   * Expand task drawer
   */
  public expandTasks(): void {
    this.taskController.expand();
  }

  /**
   * Collapse task drawer
   */
  public collapseTasks(): void {
    this.taskController.collapse();
  }

  /**
   * Toggle task drawer
   */
  public toggleTasks(): void {
    this.taskController.toggle();
  }

  /**
   * Get all tasks with their IDs
   */
  public getTasks(): Task[] {
    return this.taskController.getState().tasks;
  }

  /**
   * Get a task by ID
   */
  public getTask(taskId: string): Task | null {
    const tasks = this.taskController.getState().tasks;
    return tasks.find((t) => t.id === taskId) ?? null;
  }

  /**
   * Find a task by text and set it as active
   */
  public findAndSetActiveTask(text: string): boolean {
    const task = this.taskController.findTaskByText(text);
    if (task && task.status !== "done") {
      this.taskController.setActiveTask(task.id);
      return true;
    }
    return false;
  }

  /**
   * Find or create a task and set it as active
   * Returns true if task was found and activated, false if created new
   */
  public findOrCreateAndStartTask(text: string): boolean {
    const existing = this.taskController.findTaskByText(text);
    if (existing && existing.status !== "done") {
      this.taskController.setActiveTask(existing.id);
      return true; // Found existing task
    }
    // Create new task with in_progress status
    this.taskController.addTask(text, "in_progress");
    return false; // Created new task
  }

  /**
   * Register a feature plugin
   */
  public registerPlugin(plugin: FeaturePlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already registered`);
      return;
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
   * Get a registered plugin by name
   */
  public getPlugin<T extends FeaturePlugin>(pluginName: string): T | undefined {
    return this.plugins.get(pluginName) as T | undefined;
  }

  /**
   * Cleanup resources (timers, subscriptions)
   */
  public destroy(): void {
    // Clean up pomodoro subscription
    if (this.pomodoroUnsubscribe) {
      this.pomodoroUnsubscribe();
      this.pomodoroUnsubscribe = undefined;
    }
    this.pomodoroController.destroy();
    this.idleController.reset();

    // Destroy all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        plugin.destroy();
      }
    }
    this.plugins.clear();
  }
}
