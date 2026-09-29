import type { StateEvent, EventSubscriber, StateEventEmitter } from "./types";

/**
 * Simple pub/sub event bus for state change notifications
 */
export class EventBus implements StateEventEmitter {
  private subscribers: Set<EventSubscriber> = new Set();

  constructor(private readonly onSubscriberError: (error: unknown) => void) {}

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
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        this.onSubscriberError(error);
      }
    }
  }

  /**
   * Drop every subscriber, e.g. when the owning character is destroyed
   */
  public clearSubscribers(): void {
    this.subscribers.clear();
  }
}
