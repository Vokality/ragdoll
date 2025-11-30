/**
 * Clock abstraction for testable time-dependent behavior
 */

export interface IClock {
  /**
   * Get current time in milliseconds
   */
  now(): number;

  /**
   * Schedule a callback to run after a delay
   */
  setTimeout(callback: () => void, ms: number): number;

  /**
   * Clear a scheduled timeout
   */
  clearTimeout(id: number): void;

  /**
   * Schedule a callback to run repeatedly
   */
  setInterval(callback: () => void, ms: number): number;

  /**
   * Clear a scheduled interval
   */
  clearInterval(id: number): void;
}

/**
 * Real clock implementation using system time
 */
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, ms: number): number {
    return setTimeout(callback, ms) as unknown as number;
  }

  clearTimeout(id: number): void {
    clearTimeout(id);
  }

  setInterval(callback: () => void, ms: number): number {
    return setInterval(callback, ms) as unknown as number;
  }

  clearInterval(id: number): void {
    clearInterval(id);
  }
}

/**
 * Mock clock for testing - allows manual time control
 */
export class MockClock implements IClock {
  private currentTime = 0;
  private nextId = 1;
  private scheduledTimeouts = new Map<
    number,
    { callback: () => void; executeAt: number }
  >();
  private scheduledIntervals = new Map<
    number,
    { callback: () => void; interval: number; nextExecuteAt: number }
  >();

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, ms: number): number {
    const id = this.nextId++;
    this.scheduledTimeouts.set(id, {
      callback,
      executeAt: this.currentTime + ms,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.scheduledTimeouts.delete(id);
  }

  setInterval(callback: () => void, ms: number): number {
    const id = this.nextId++;
    this.scheduledIntervals.set(id, {
      callback,
      interval: ms,
      nextExecuteAt: this.currentTime + ms,
    });
    return id;
  }

  clearInterval(id: number): void {
    this.scheduledIntervals.delete(id);
  }

  /**
   * Advance time by the given milliseconds
   * Executes any scheduled callbacks that should fire
   */
  advance(ms: number): void {
    const targetTime = this.currentTime + ms;

    while (this.currentTime < targetTime) {
      // Find next event
      let nextEventTime = targetTime;

      for (const timeout of this.scheduledTimeouts.values()) {
        if (
          timeout.executeAt > this.currentTime &&
          timeout.executeAt < nextEventTime
        ) {
          nextEventTime = timeout.executeAt;
        }
      }

      for (const interval of this.scheduledIntervals.values()) {
        if (
          interval.nextExecuteAt > this.currentTime &&
          interval.nextExecuteAt < nextEventTime
        ) {
          nextEventTime = interval.nextExecuteAt;
        }
      }

      // Advance to next event
      this.currentTime = nextEventTime;

      // Execute timeouts
      for (const [id, timeout] of this.scheduledTimeouts.entries()) {
        if (timeout.executeAt === this.currentTime) {
          timeout.callback();
          this.scheduledTimeouts.delete(id);
        }
      }

      // Execute intervals
      for (const interval of this.scheduledIntervals.values()) {
        if (interval.nextExecuteAt === this.currentTime) {
          interval.callback();
          interval.nextExecuteAt += interval.interval;
        }
      }
    }
  }

  /**
   * Set the current time directly
   */
  setTime(time: number): void {
    this.currentTime = time;
  }

  /**
   * Reset the clock to time 0 and clear all scheduled callbacks
   */
  reset(): void {
    this.currentTime = 0;
    this.scheduledTimeouts.clear();
    this.scheduledIntervals.clear();
  }
}
