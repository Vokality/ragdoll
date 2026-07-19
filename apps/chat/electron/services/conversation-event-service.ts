import type {
  ConversationEventInput,
  PublishedConversationEvent,
} from "@vokality/ragdoll-extensions";
import {
  conversationEventInputSchema,
  type ExtensionConversationEvent,
} from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";

export interface ExtensionConversationEventPublisher {
  publish(
    extensionId: string,
    input: ConversationEventInput,
  ): Promise<PublishedConversationEvent>;
}

export class ConversationEventService implements ExtensionConversationEventPublisher {
  private readonly turnQueuedListeners = new Set<() => void>();

  constructor(private readonly storage: StorageRepository) {}

  onTurnQueued(listener: () => void): () => void {
    this.turnQueuedListeners.add(listener);
    return () => this.turnQueuedListeners.delete(listener);
  }

  async publish(
    extensionId: string,
    input: ConversationEventInput,
  ): Promise<PublishedConversationEvent> {
    const validated = conversationEventInputSchema.parse(input);
    if (validated.requiredToolName && validated.turnPolicy !== "start-turn") {
      throw new Error("requiredToolName requires turnPolicy 'start-turn'");
    }
    let eventId = "";
    let turnQueued = false;

    await this.storage.update((draft) => {
      const conversation = (draft.conversation ??= []);
      const duplicate = validated.deduplicationKey
        ? conversation.find(
            (entry): entry is ExtensionConversationEvent =>
              "kind" in entry &&
              entry.kind === "extension-event" &&
              entry.extensionId === extensionId &&
              entry.deduplicationKey === validated.deduplicationKey,
          )
        : undefined;

      if (duplicate) {
        eventId = duplicate.id;
        return;
      }

      eventId = globalThis.crypto.randomUUID();
      const event: ExtensionConversationEvent = {
        kind: "extension-event",
        id: eventId,
        extensionId,
        type: validated.type,
        payload: validated.payload,
        turnPolicy: validated.turnPolicy,
        requiredToolName: validated.requiredToolName,
        deduplicationKey: validated.deduplicationKey,
        occurredAt: Date.now(),
      };
      conversation.push(event);

      if (event.turnPolicy === "start-turn") {
        (draft.pendingAgentTurns ??= []).push({
          triggerEventId: event.id,
          createdAt: event.occurredAt,
        });
        turnQueued = true;
      }
    });

    if (turnQueued) {
      for (const listener of this.turnQueuedListeners) listener();
    }

    return { eventId };
  }
}
