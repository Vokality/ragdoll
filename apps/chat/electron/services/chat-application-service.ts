import type { ChatMessageDto, OperationResult } from "../electron-api.js";
import {
  isExtensionConversationEvent,
  projectVisibleConversation,
  type ConversationEntry,
  type ConversationMessage,
  type ExtensionConversationEvent,
} from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { AgentRunner } from "./openai-service.js";

export interface ChatEvents {
  streamingText(text: string): void;
  streamEnded(): void;
}

export type ConversationChangedCallback = (
  conversation: ChatMessageDto[],
) => void;

export interface ApiKeyProvider {
  getKey(): Promise<string>;
}

export class ChatApplicationService {
  private turnQueue = Promise.resolve();
  private pendingEventRun: Promise<void> | null = null;

  constructor(
    private readonly storage: StorageRepository,
    private readonly apiKeys: ApiKeyProvider,
    private readonly agent: AgentRunner,
    private readonly conversationChanged: ConversationChangedCallback,
    private readonly reportError: (error: unknown) => void,
  ) {}

  async getConversation(): Promise<ChatMessageDto[]> {
    const data = await this.storage.read();
    return projectVisibleConversation(data.conversation);
  }

  clearConversation(): Promise<OperationResult> {
    return this.enqueueTurn(async () => {
      await this.storage.update((draft) => {
        draft.conversation = [];
        draft.pendingAgentTurns = [];
      });
      this.conversationChanged([]);
      return { success: true };
    });
  }

  sendMessage(message: string, events: ChatEvents): Promise<OperationResult> {
    const content = message.trim();
    if (!content) {
      return Promise.resolve({ success: false, error: "Message is empty" });
    }

    return this.enqueueTurn(async () => {
      try {
        const data = await this.storage.update((draft) => {
          draft.conversation.push({ role: "user", content });
        });
        this.publishConversation(data.conversation);

        const response = await this.agent.runUserTurn(
          await this.apiKeys.getKey(),
          data.conversation,
          (text) => events.streamingText(text),
        );
        const completed = await this.appendAssistantResponse(response);
        events.streamEnded();
        this.publishConversation(completed);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  schedulePendingEventTurns(): Promise<void> {
    if (this.pendingEventRun) return this.pendingEventRun;

    const run = this.enqueueTurn(async () => {
      try {
        await this.processPendingEventTurns();
      } catch (error) {
        this.reportError(error);
      }
    });
    this.pendingEventRun = run.finally(() => {
      this.pendingEventRun = null;
    });
    return this.pendingEventRun;
  }

  private async processPendingEventTurns(): Promise<void> {
    while (true) {
      const data = await this.storage.read();
      const job = data.pendingAgentTurns[0];
      if (!job) return;

      const trigger = data.conversation.find(
        (entry): entry is ExtensionConversationEvent =>
          isExtensionConversationEvent(entry) &&
          entry.id === job.triggerEventId,
      );
      if (!trigger) {
        throw new Error(
          `Pending agent turn references missing event '${job.triggerEventId}'`,
        );
      }

      const outcome = await this.agent.runEventTurn(
        await this.apiKeys.getKey(),
        data.conversation,
        trigger,
      );
      const completed = await this.storage.update((draft) => {
        if (outcome.disposition === "respond") {
          draft.conversation.push({
            role: "assistant",
            content: outcome.content,
          });
        }
        draft.pendingAgentTurns = draft.pendingAgentTurns.filter(
          (pending) => pending.triggerEventId !== trigger.id,
        );
      });

      if (outcome.disposition === "respond") {
        this.publishConversation(completed.conversation);
      }
    }
  }

  private async appendAssistantResponse(
    content: string,
  ): Promise<ConversationEntry[]> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("The agent returned an empty response");

    const data = await this.storage.update((draft) => {
      draft.conversation.push({ role: "assistant", content: trimmed });
    });
    return data.conversation;
  }

  private publishConversation(
    conversation: readonly ConversationEntry[],
  ): void {
    this.conversationChanged(
      projectVisibleConversation(conversation) satisfies ConversationMessage[],
    );
  }

  private enqueueTurn<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.turnQueue.then(operation, operation);
    this.turnQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
