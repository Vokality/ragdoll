import type { ChatMessage } from "../domain/chat";
import { mergeSettings, type ChatSettings } from "../domain/settings";
import type { ChatGateway, StreamingHandlers } from "./ports/chat-gateway";

export interface HydratedChatState {
  messages: ChatMessage[];
  settings: ChatSettings;
}

export class ChatService {
  constructor(private readonly gateway: ChatGateway) {}

  async hydrate(): Promise<HydratedChatState> {
    const [settings, messages] = await Promise.all([
      this.gateway.fetchSettings(),
      this.gateway.fetchConversation(),
    ]);

    return {
      messages,
      settings: mergeSettings(settings),
    };
  }

  sendMessage(message: string, conversationHistory: ChatMessage[]) {
    return this.gateway.sendMessage(message, conversationHistory);
  }

  subscribeToStreaming(handlers: StreamingHandlers) {
    return this.gateway.subscribeToStreaming(handlers);
  }

  onFunctionCall(callback: (name: string, args: Record<string, unknown>) => void) {
    return this.gateway.onFunctionCall(callback);
  }

  async updateSettings(settings: Partial<ChatSettings>) {
    await this.gateway.persistSettings(settings);
  }

  async persistConversation(messages: ChatMessage[]) {
    await this.gateway.persistConversation(messages);
  }

  async clearConversation() {
    await this.gateway.clearConversation();
  }

  async clearApiKey() {
    await this.gateway.clearApiKey();
  }
}
