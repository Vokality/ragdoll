/**
 * PomodoroManager - Manages pomodoro timer state in the main process.
 *
 * This provides the actual implementation for pomodoro operations,
 * managing timer state and emitting events when changes occur.
 */

// =============================================================================
// Types
// =============================================================================

export const VALID_SESSION_DURATIONS = [5, 15, 30, 60, 120] as const;
export const VALID_BREAK_DURATIONS = [5, 10, 15, 30] as const;

export type SessionDuration = (typeof VALID_SESSION_DURATIONS)[number];
export type BreakDuration = (typeof VALID_BREAK_DURATIONS)[number];

export type PomodoroPhase = "idle" | "running" | "paused" | "break";

export interface PomodoroState {
  phase: PomodoroPhase;
  remainingMs: number;
  sessionDurationMs: number;
  breakDurationMs: number;
  isBreak: boolean;
  sessionsCompleted: number;
}

export type PomodoroEventType =
  | "pomodoro:started"
  | "pomodoro:paused"
  | "pomodoro:resumed"
  | "pomodoro:reset"
  | "pomodoro:tick"
  | "pomodoro:session-complete"
  | "pomodoro:break-start"
  | "pomodoro:break-complete"
  | "state:changed";

export interface PomodoroEvent {
  type: PomodoroEventType;
  state: PomodoroState;
  timestamp: number;
}

export type PomodoroEventCallback = (event: PomodoroEvent) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SESSION_DURATION_MINUTES = 30;
const DEFAULT_BREAK_DURATION_MINUTES = 5;
const TICK_INTERVAL_MS = 1000;

// =============================================================================
// PomodoroManager
// =============================================================================

/**
 * Manages pomodoro timer state with event emission for state changes.
 */
export class PomodoroManager {
  private phase: PomodoroPhase = "idle";
  private remainingMs: number = 0;
  private sessionDurationMs: number;
  private breakDurationMs: number;
  private isBreak: boolean = false;
  private sessionsCompleted: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<PomodoroEventCallback> = new Set();

  constructor(
    sessionDurationMinutes: SessionDuration = DEFAULT_SESSION_DURATION_MINUTES,
    breakDurationMinutes: BreakDuration = DEFAULT_BREAK_DURATION_MINUTES
  ) {
    this.sessionDurationMs = sessionDurationMinutes * 60 * 1000;
    this.breakDurationMs = breakDurationMinutes * 60 * 1000;
    this.remainingMs = this.sessionDurationMs;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Get the current state as a serializable object.
   */
  getState(): PomodoroState {
    return {
      phase: this.phase,
      remainingMs: this.remainingMs,
      sessionDurationMs: this.sessionDurationMs,
      breakDurationMs: this.breakDurationMs,
      isBreak: this.isBreak,
      sessionsCompleted: this.sessionsCompleted,
    };
  }

  /**
   * Get remaining time in seconds.
   */
  getRemainingSeconds(): number {
    return Math.ceil(this.remainingMs / 1000);
  }

  /**
   * Get remaining time formatted as MM:SS.
   */
  getRemainingFormatted(): string {
    const totalSeconds = this.getRemainingSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Check if the timer is currently running.
   */
  isRunning(): boolean {
    return this.phase === "running";
  }

  /**
   * Check if the timer is paused.
   */
  isPaused(): boolean {
    return this.phase === "paused";
  }

  /**
   * Check if the timer is idle.
   */
  isIdle(): boolean {
    return this.phase === "idle";
  }

  // ===========================================================================
  // Timer Operations
  // ===========================================================================

  /**
   * Start or resume the pomodoro timer.
   */
  start(
    sessionDurationMinutes?: SessionDuration,
    breakDurationMinutes?: BreakDuration
  ): void {
    // Update durations if provided
    if (sessionDurationMinutes !== undefined) {
      this.sessionDurationMs = sessionDurationMinutes * 60 * 1000;
    }
    if (breakDurationMinutes !== undefined) {
      this.breakDurationMs = breakDurationMinutes * 60 * 1000;
    }

    if (this.phase === "idle") {
      // Starting fresh
      this.isBreak = false;
      this.remainingMs = this.sessionDurationMs;
      this.phase = "running";
      this.startInterval();
      this.emit("pomodoro:started");
    } else if (this.phase === "paused") {
      // Resuming
      this.phase = "running";
      this.startInterval();
      this.emit("pomodoro:resumed");
    }
    // If already running, do nothing
  }

  /**
   * Pause the timer.
   */
  pause(): void {
    if (this.phase === "running") {
      this.stopInterval();
      this.phase = "paused";
      this.emit("pomodoro:paused");
    }
  }

  /**
   * Toggle between running and paused.
   */
  toggle(): void {
    if (this.phase === "running") {
      this.pause();
    } else if (this.phase === "paused" || this.phase === "idle") {
      this.start();
    }
  }

  /**
   * Reset the timer to idle state.
   */
  reset(): void {
    this.stopInterval();
    this.phase = "idle";
    this.isBreak = false;
    this.remainingMs = this.sessionDurationMs;
    this.emit("pomodoro:reset");
  }

  /**
   * Skip to the next phase (end current session/break early).
   */
  skip(): void {
    if (this.phase !== "running" && this.phase !== "paused") {
      return;
    }

    this.remainingMs = 0;
    this.handleTimerComplete();
  }

  // ===========================================================================
  // Private Timer Logic
  // ===========================================================================

  /**
   * Start the interval timer.
   */
  private startInterval(): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  /**
   * Stop the interval timer.
   */
  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Handle a timer tick (called every second).
   */
  private tick(): void {
    if (this.phase !== "running") {
      return;
    }

    this.remainingMs -= TICK_INTERVAL_MS;

    if (this.remainingMs <= 0) {
      this.handleTimerComplete();
    } else {
      this.emit("pomodoro:tick");
    }
  }

  /**
   * Handle timer completion (session or break finished).
   */
  private handleTimerComplete(): void {
    this.stopInterval();

    if (this.isBreak) {
      // Break complete, go back to idle
      this.isBreak = false;
      this.phase = "idle";
      this.remainingMs = this.sessionDurationMs;
      this.emit("pomodoro:break-complete");
    } else {
      // Session complete, start break
      this.sessionsCompleted++;
      this.emit("pomodoro:session-complete");

      // Auto-start break
      this.isBreak = true;
      this.remainingMs = this.breakDurationMs;
      this.phase = "running";
      this.startInterval();
      this.emit("pomodoro:break-start");
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set session duration (only takes effect on next session).
   */
  setSessionDuration(minutes: SessionDuration): void {
    this.sessionDurationMs = minutes * 60 * 1000;

    // If idle, update remaining time too
    if (this.phase === "idle" && !this.isBreak) {
      this.remainingMs = this.sessionDurationMs;
      this.emit("state:changed");
    }
  }

  /**
   * Set break duration (only takes effect on next break).
   */
  setBreakDuration(minutes: BreakDuration): void {
    this.breakDurationMs = minutes * 60 * 1000;

    // If idle in break phase, update remaining time
    if (this.phase === "idle" && this.isBreak) {
      this.remainingMs = this.breakDurationMs;
      this.emit("state:changed");
    }
  }

  /**
   * Get session duration in minutes.
   */
  getSessionDurationMinutes(): number {
    return this.sessionDurationMs / 60 / 1000;
  }

  /**
   * Get break duration in minutes.
   */
  getBreakDurationMinutes(): number {
    return this.breakDurationMs / 60 / 1000;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to pomodoro events.
   */
  onStateChange(callback: PomodoroEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(type: PomodoroEventType): void {
    const event: PomodoroEvent = {
      type,
      state: this.getState(),
      timestamp: Date.now(),
    };

    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch (error) {
        console.error("[PomodoroManager] Error in event listener:", error);
      }
    }
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy the manager and clean up resources.
   */
  destroy(): void {
    this.stopInterval();
    this.removeAllListeners();
    this.phase = "idle";
  }
}

/**
 * Create a new PomodoroManager instance.
 */
export function createPomodoroManager(
  sessionDurationMinutes?: SessionDuration,
  breakDurationMinutes?: BreakDuration
): PomodoroManager {
  return new PomodoroManager(sessionDurationMinutes, breakDurationMinutes);
}
