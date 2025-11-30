import type { StateEvent, EventSubscriber } from "./types";

/**
 * Simple pub/sub event bus for state change notifications
 */
export class EventBus {
  private subscribers: Set<EventSubscriber> = new Set();
  private eventHistory: StateEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to state change events
   */
  public subscribe(subscriber: EventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Emit a state change event
   */
  public emit(event: StateEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify all subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error("Error in event subscriber:", error);
      }
    }
  }

  /**
   * Get recent event history (for debugging)
   */
  public getHistory(): readonly StateEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }
}

