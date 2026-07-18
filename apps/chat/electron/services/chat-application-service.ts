import type { ChatMessageDto, OperationResult } from "../electron-api.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { ApiKeyService } from "./api-key-service.js";
import type { ExtensionManager } from "./extension-manager.js";
import {
  sendChatMessage,
  type ChatCompletionConfig,
} from "./openai-service.js";

export interface ChatEvents {
  streamingText(text: string): void;
  streamEnded(): void;
}

export class ChatApplicationService {
  constructor(
    private readonly storage: StorageRepository,
    private readonly apiKeys: ApiKeyService,
    private readonly extensions: ExtensionManager,
    private readonly config: ChatCompletionConfig,
  ) {}

  async getConversation(): Promise<ChatMessageDto[]> {
    return (await this.storage.read()).conversation ?? [];
  }

  async saveConversation(
    conversation: ChatMessageDto[],
  ): Promise<OperationResult> {
    await this.storage.update((draft) => {
      draft.conversation = conversation;
    });
    return { success: true };
  }

  async clearConversation(): Promise<OperationResult> {
    await this.storage.update((draft) => {
      draft.conversation = [];
    });
    return { success: true };
  }

  async send(
    conversation: ChatMessageDto[],
    events: ChatEvents,
  ): Promise<OperationResult> {
    try {
      await sendChatMessage(
        await this.apiKeys.getKey(),
        conversation,
        this.extensions,
        this.config,
        (text) => events.streamingText(text),
        () => events.streamEnded(),
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
