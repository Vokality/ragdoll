import type { ChatGateway, StreamingHandlers } from "../application/ports/chat-gateway";
import type { ChatMessage } from "../domain/chat";
import type { ChatSettings } from "../domain/settings";

function ensureElectronAPI(): Window["electronAPI"] {
  if (!window.electronAPI) {
    throw new Error("electronAPI is not available in the renderer context");
  }
  return window.electronAPI;
}

export function createElectronChatGateway(): ChatGateway {
  const api = ensureElectronAPI();

  return {
    async fetchSettings(): Promise<Partial<ChatSettings> | undefined> {
      return api.getSettings();
    },
    async persistSettings(settings: Partial<ChatSettings>): Promise<void> {
      await api.setSettings(settings);
    },
    async fetchConversation(): Promise<ChatMessage[]> {
      const conversation = await api.getConversation();
      return conversation ?? [];
    },
    async persistConversation(messages: ChatMessage[]): Promise<void> {
      await api.saveConversation(messages);
    },
    async clearConversation(): Promise<void> {
      await api.clearConversation();
    },
    async sendMessage(message, conversationHistory) {
      return api.sendMessage(message, conversationHistory);
    },
    subscribeToStreaming({ onText, onStreamEnd }: StreamingHandlers) {
      const unsubscribeText = api.onStreamingText(onText);
      const unsubscribeEnd = api.onStreamEnd(onStreamEnd);
      return () => {
        unsubscribeText();
        unsubscribeEnd();
      };
    },
    onFunctionCall(callback) {
      return api.onFunctionCall(callback);
    },
    async clearApiKey() {
      await api.clearApiKey();
    },
  };
}
