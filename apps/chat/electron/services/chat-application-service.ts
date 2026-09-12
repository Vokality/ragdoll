import type { AgentResponse } from "../electron-api.js";
import type { ChatMessageDto, OperationResult } from "../electron-api.js";
import {
  isAgentConversationEvent,
  projectVisibleConversation,
  type ConversationEntry,
  type ConversationMessage,
  type AgentConversationEvent,
} from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { AgentRunner } from "./agent-service.js";

export interface ConfiguredAgent {
  create(): Promise<{ runner: AgentRunner; key: string }>;
}

export interface ChatEvents {
  streamingText(text: string, messageId: string): void;
  streamEnded(): void;
}

export type ConversationChangedCallback = (
  conversation: ChatMessageDto[],
) => void;

export class ChatApplicationService {
  private turnQueue = Promise.resolve();
  private pendingEventRun: Promise<void> | null = null;
  private activeUserTurn: AbortController | null = null;
  private stopping = false;

  constructor(
    private readonly storage: StorageRepository,
    private readonly agent: ConfiguredAgent,
    private readonly conversationChanged: ConversationChangedCallback,
    private readonly reportError: (error: unknown) => void,
  ) {}

  async getConversation(): Promise<ChatMessageDto[]> {
    const data = await this.storage.read();
    return projectVisibleConversation(data.conversation);
  }

  clearConversation(): Promise<OperationResult> {
    return this.enqueueTurn(async () => {
      if (this.stopping)
        return { success: false, error: "Application is shutting down" };
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
      if (this.stopping)
        return { success: false, error: "Application is shutting down" };
      const abort = new AbortController();
      this.activeUserTurn = abort;
      let streamed = "";
      let messageId = globalThis.crypto.randomUUID();
      let assistantSaveStarted = false;
      try {
        const data = await this.storage.update((draft) => {
          draft.conversation.push({
            id: globalThis.crypto.randomUUID(),
            role: "user",
            content,
          });
        });
        this.publishConversation(data.conversation);

        const { runner, key } = await this.agent.create();
        await runner.runUserTurn(
          key,
          data.conversation,
          {
            onText: (text) => {
              streamed += text;
              events.streamingText(text, messageId);
            },
            onMessage: async (response) => {
              assistantSaveStarted = true;
              const completed = await this.appendAssistantResponse(
                response,
                messageId,
              );
              streamed = "";
              messageId = globalThis.crypto.randomUUID();
              assistantSaveStarted = false;
              this.publishConversation(completed);
            },
          },
          abort.signal,
        );
        events.streamEnded();
        return { success: true };
      } catch (error) {
        // Preserve visible progress on cancellation and failures without replaying
        // a save whose outcome may be uncertain.
        if (!assistantSaveStarted) {
          try {
            const partial = streamed.trim();
            const conversation = partial
              ? await this.appendAssistantResponse(
                  { content: partial },
                  messageId,
                )
              : (await this.storage.read()).conversation;
            events.streamEnded();
            this.publishConversation(conversation);
          } catch (persistenceError) {
            this.reportError(persistenceError);
          }
        }
        if (abort.signal.aborted) return { success: true };
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        if (this.activeUserTurn === abort) this.activeUserTurn = null;
      }
    });
  }

  cancelActiveTurn(): OperationResult {
    this.activeUserTurn?.abort();
    return { success: true };
  }

  async destroy(): Promise<void> {
    this.stopping = true;
    this.activeUserTurn?.abort();
    // An event may already have executed tools. Finish and persist that turn
    // before unloading its extension; leave unstarted jobs for the next launch.
    await this.turnQueue;
  }

  schedulePendingEventTurns(): Promise<void> {
    if (this.stopping) return Promise.resolve();
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
    while (!this.stopping) {
      const data = await this.storage.read();
      if (this.stopping) return;
      const job = data.pendingAgentTurns[0];
      if (!job) return;

      const trigger = data.conversation.find(
        (entry): entry is AgentConversationEvent =>
          isAgentConversationEvent(entry) && entry.id === job.triggerEventId,
      );
      if (!trigger) {
        throw new Error(
          `Pending agent turn references missing event '${job.triggerEventId}'`,
        );
      }

      const abort = new AbortController();
      this.activeUserTurn = abort;
      let outcome;
      try {
        const { runner, key } = await this.agent.create();
        outcome = await runner.runEventTurn(
          key,
          data.conversation,
          trigger,
          abort.signal,
        );
      } finally {
        if (this.activeUserTurn === abort) this.activeUserTurn = null;
      }
      const completed = await this.storage.update((draft) => {
        if (outcome.disposition === "respond") {
          draft.conversation.push({
            id: globalThis.crypto.randomUUID(),
            role: "assistant",
            content: outcome.content,
            ...(outcome.sources ? { sources: outcome.sources } : {}),
          });
        }
        if (trigger.kind === "app-event" && trigger.type === "app.onboarding") {
          draft.experience.introduced = true;
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
    response: AgentResponse,
    id: string,
  ): Promise<ConversationEntry[]> {
    const trimmed = response.content.trim();
    if (!trimmed) throw new Error("The agent returned an empty response");

    const data = await this.storage.update((draft) => {
      draft.conversation.push({
        ...response,
        id,
        role: "assistant",
        content: trimmed,
      });
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
