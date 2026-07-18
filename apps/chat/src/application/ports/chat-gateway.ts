import type { ChatMessage } from "../../domain/chat";
import type { ChatSettings } from "../../domain/settings";

export interface StreamingHandlers {
  onText: (text: string) => void;
  onStreamEnd: () => void;
  onConversationChanged: (conversation: ChatMessage[]) => void;
}

export type ChatSendResult =
  { success: true } | { success: false; error: string };

export interface ChatGateway {
  fetchSettings(): Promise<Partial<ChatSettings> | undefined>;
  persistSettings(settings: Partial<ChatSettings>): Promise<void>;
  fetchConversation(): Promise<ChatMessage[]>;
  clearConversation(): Promise<void>;
  sendMessage(message: string): Promise<ChatSendResult>;
  subscribeToStreaming(handlers: StreamingHandlers): () => void;
  onFunctionCall(
    callback: (name: string, args: Record<string, unknown>) => void,
  ): () => void;
  clearApiKey(): Promise<void>;
}
