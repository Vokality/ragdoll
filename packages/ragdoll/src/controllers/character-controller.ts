import { RagdollSkeleton } from "../models/ragdoll-skeleton";
import { RagdollGeometry } from "../models/ragdoll-geometry";
import type { ExpressionConfig } from "../models/ragdoll-geometry";
import { ExpressionController } from "./expression-controller";
import { HeadPoseController } from "./head-pose-controller";
import { IdleController } from "./idle-controller";
import type { IdleState } from "./idle-controller";
import { PomodoroController } from "./pomodoro-controller";
import { TaskController } from "./task-controller";
import type {
  PomodoroStateData,
  PomodoroDuration,
  TaskStatus,
  Task,
} from "../types";
import type { RagdollTheme } from "../themes/types";
import { getTheme, getDefaultTheme } from "../themes";
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
  private expressionController: ExpressionController;
  private headPoseController: HeadPoseController;
  private idleController: IdleController;
  private pomodoroController: PomodoroController;
  private taskController: TaskController;
  private speechBubble: SpeechBubbleState = { text: null, tone: "default" };
  private theme: RagdollTheme;
  private lastPomodoroState: PomodoroStateData | null = null;
  private lastReminderTime: number | null = null;
  private pomodoroUnsubscribe?: () => void;
  private shakeState: { elapsed: number; duration: number } | null = null;

  constructor(themeId?: string) {
    this.skeleton = new RagdollSkeleton();
    this.geometry = new RagdollGeometry();
    this.theme = themeId ? getTheme(themeId) : getDefaultTheme();
    this.expressionController = new ExpressionController(this.geometry);
    this.headPoseController = new HeadPoseController(this.skeleton);
    this.idleController = new IdleController();
    this.pomodoroController = new PomodoroController();
    this.taskController = new TaskController();

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
    this.expressionController.setMood(mood, duration);
  }

  public triggerAction(
    action: Exclude<FacialAction, "none">,
    duration?: number,
  ): void {
    if (action === "shake") {
      // Shake affects head pose, not expression
      const shakeDuration = duration ?? 0.6;
      this.shakeState = { elapsed: 0, duration: shakeDuration };
    } else {
      this.expressionController.triggerAction(action, duration);
    }
  }

  public clearAction(): void {
    this.expressionController.clearAction();
    this.shakeState = null;
    // Return head to center when clearing shake
    if (this.headPoseController.getPose().yaw !== 0) {
      this.headPoseController.lookForward(0.2);
    }
  }

  public setHeadPose(pose: Partial<HeadPose>, duration?: number): void {
    this.headPoseController.setTargetPose(pose, duration);
  }

  public nudgeHead(delta: Partial<HeadPose>, duration?: number): void {
    this.headPoseController.nudge(delta, duration);
  }

  public setSpeechBubble(payload: SpeechBubblePayload): void {
    this.speechBubble = {
      text: payload.text,
      tone: payload.tone ?? "default",
    };

    if (payload.text) {
      const duration = this.calculateTalkDuration(payload.text);
      if (!this.expressionController.isTalking()) {
        this.expressionController.triggerAction("talk", duration);
      } else {
        // Update duration if already talking (restart with new duration)
        this.expressionController.triggerAction("talk", duration);
      }
    } else {
      if (this.expressionController.isTalking()) {
        this.expressionController.clearAction();
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
    // Update shake animation
    if (this.shakeState) {
      this.shakeState.elapsed += deltaTime;

      if (this.shakeState.elapsed >= this.shakeState.duration) {
        // Shake complete, return to center
        this.shakeState = null;
        this.headPoseController.lookForward(0.2);
      } else {
        // Oscillate head left-right during shake
        const progress = this.shakeState.elapsed / this.shakeState.duration;
        // Use a sine wave for smooth oscillation
        const frequency = 3; // Number of shakes per duration
        const amplitude = 0.6; // How far to shake (60% of max yaw in radians)
        const MAX_YAW_RAD = (35 * Math.PI) / 180;
        const yaw =
          Math.sin(progress * frequency * Math.PI * 2) *
          amplitude *
          MAX_YAW_RAD;
        // Apply easing to slow down at the end
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const finalYaw = yaw * easeOut;
        this.headPoseController.setTargetPose({ yaw: finalYaw }, 0.25); // Slower transition (increased from 0.05)
      }
    }

    this.expressionController.update(deltaTime);
    this.headPoseController.update(deltaTime);
    this.idleController.update(deltaTime);
    this.skeleton.update(deltaTime);
  }

  public getState(): CharacterState {
    const joints: Record<JointName, { x: number; y: number; z: number }> =
      {} as Record<JointName, { x: number; y: number; z: number }>;
    this.skeleton.skeleton.joints.forEach((_joint, name) => {
      const rotation = this.skeleton.getJointRotation(name);
      if (rotation !== null) {
        joints[name] = { x: 0, y: rotation, z: 0 };
      }
    });

    return {
      headPose: this.headPoseController.getPose(),
      joints: joints as Record<JointName, { x: number; y: number; z: number }>,
      mood: this.expressionController.getCurrentMood(),
      action: this.shakeState
        ? "shake"
        : this.expressionController.getActiveAction(),
      bubble: this.getSpeechBubble(),
      animation: {
        action: this.shakeState
          ? "shake"
          : this.expressionController.getActiveAction(),
        actionProgress: this.shakeState
          ? Math.min(1, this.shakeState.elapsed / this.shakeState.duration)
          : this.expressionController.getActionProgress(),
        isTalking: this.expressionController.isTalking(),
      },
    };
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
    return this.theme;
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
   * Cleanup resources (timers, subscriptions)
   */
  public destroy(): void {
    if (this.pomodoroUnsubscribe) {
      this.pomodoroUnsubscribe();
      this.pomodoroUnsubscribe = undefined;
    }
    this.pomodoroController.destroy();
    this.idleController.reset();
  }
}
