import type { ChatMessage } from "../../domain/chat";
import type { ChatSettings } from "../../domain/settings";

export interface StreamingHandlers {
  onText: (text: string) => void;
  onStreamEnd: () => void;
}

export interface ChatGateway {
  fetchSettings(): Promise<Partial<ChatSettings> | undefined>;
  persistSettings(settings: Partial<ChatSettings>): Promise<void>;
  fetchConversation(): Promise<ChatMessage[]>;
  persistConversation(messages: ChatMessage[]): Promise<void>;
  clearConversation(): Promise<void>;
  sendMessage(
    message: string,
    conversationHistory: ChatMessage[]
  ): Promise<{ success: boolean; error?: string }>;
  subscribeToStreaming(handlers: StreamingHandlers): () => void;
  onFunctionCall(callback: (name: string, args: Record<string, unknown>) => void): () => void;
  clearApiKey(): Promise<void>;
}
