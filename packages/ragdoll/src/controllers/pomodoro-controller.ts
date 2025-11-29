/**
 * Pomodoro timer controller
 * Manages pomodoro session state, timing, and transitions
 */

import type { PomodoroState, PomodoroDuration, PomodoroStateData } from "../types";

type TimerCallback = (state: PomodoroStateData) => void;

export class PomodoroController {
  private state: PomodoroState = "idle";
  private sessionDuration: PomodoroDuration = 30; // Default 30 minutes
  private breakDuration: PomodoroDuration = 5; // Default 5 minutes
  private elapsedTime = 0; // seconds
  private startTime: number | null = null;
  private pausedElapsed = 0; // seconds accumulated before pause
  private isBreak = false;
  private updateCallbacks: TimerCallback[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Start update loop that fires every second
   */
  private startUpdateLoop(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.update();
    }, 1000);
  }

  /**
   * Stop update loop
   */
  private stopUpdateLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Update timer state
   */
  public update(): void {
    if (this.state !== "running") {
      return;
    }

    if (this.startTime === null) {
      return;
    }

    const currentTime = Date.now() / 1000;
    const sessionDurationSeconds = (this.isBreak ? this.breakDuration : this.sessionDuration) * 60;
    this.elapsedTime = this.pausedElapsed + (currentTime - this.startTime);

    if (this.elapsedTime >= sessionDurationSeconds) {
      // Session/break completed
      this.completeSession();
    } else {
      this.notifyCallbacks();
    }
  }

  /**
   * Start a pomodoro session
   */
  public start(sessionDuration?: PomodoroDuration, breakDuration?: PomodoroDuration): void {
    if (sessionDuration) {
      this.sessionDuration = sessionDuration;
    }
    if (breakDuration) {
      this.breakDuration = breakDuration;
    }

    if (this.state === "paused") {
      // Resume from pause
      this.startTime = Date.now() / 1000;
      this.state = "running";
    } else {
      // Start new session
      this.isBreak = false;
      this.elapsedTime = 0;
      this.pausedElapsed = 0;
      this.startTime = Date.now() / 1000;
      this.state = "running";
    }

    this.startUpdateLoop();
    this.notifyCallbacks();
  }

  /**
   * Pause the current session
   */
  public pause(): void {
    if (this.state !== "running") {
      return;
    }

    if (this.startTime !== null) {
      const currentTime = Date.now() / 1000;
      this.pausedElapsed += currentTime - this.startTime;
      this.elapsedTime = this.pausedElapsed;
      this.startTime = null;
    }

    this.state = "paused";
    this.stopUpdateLoop();
    this.notifyCallbacks();
  }

  /**
   * Reset the timer to idle state
   */
  public reset(): void {
    this.state = "idle";
    this.elapsedTime = 0;
    this.pausedElapsed = 0;
    this.startTime = null;
    this.isBreak = false;
    this.stopUpdateLoop();
    this.notifyCallbacks();
  }

  /**
   * Complete current session and transition to break or idle
   */
  private completeSession(): void {
    if (this.isBreak) {
      // Break completed, go to idle
      this.state = "idle";
      this.isBreak = false;
      this.elapsedTime = 0;
      this.pausedElapsed = 0;
      this.startTime = null;
      this.stopUpdateLoop();
    } else {
      // Session completed, start break
      this.isBreak = true;
      this.elapsedTime = 0;
      this.pausedElapsed = 0;
      this.startTime = Date.now() / 1000;
      this.state = "running";
      this.startUpdateLoop();
    }

    this.notifyCallbacks();
  }

  /**
   * Get current pomodoro state
   */
  public getState(): PomodoroStateData {
    const sessionDurationSeconds = (this.isBreak ? this.breakDuration : this.sessionDuration) * 60;
    const remainingTime = Math.max(0, sessionDurationSeconds - this.elapsedTime);

    return {
      state: this.state,
      sessionDuration: this.sessionDuration,
      breakDuration: this.breakDuration,
      elapsedTime: this.elapsedTime,
      remainingTime: remainingTime,
      isBreak: this.isBreak,
    };
  }

  /**
   * Register callback for timer updates
   */
  public onUpdate(callback: TimerCallback): () => void {
    this.updateCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all callbacks of state change
   */
  private notifyCallbacks(): void {
    const state = this.getState();
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error("Pomodoro callback error:", error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopUpdateLoop();
    this.updateCallbacks = [];
  }
}
