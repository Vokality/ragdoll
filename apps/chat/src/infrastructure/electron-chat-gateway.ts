import type {
  ChatGateway,
  StreamingHandlers,
} from "../application/ports/chat-gateway";
import type { ChatMessage } from "../domain/chat";
import type { ChatSettings } from "../domain/settings";
import type { ElectronAPI } from "../../electron/electron-api";

async function requireSuccess(
  operation: ReturnType<
    ElectronAPI[
      "clearApiKey" | "clearConversation" | "saveConversation" | "setSettings"]
  >,
): Promise<void> {
  const result = await operation;
  if (!result.success) throw new Error(result.error);
}

export function createElectronChatGateway(api: ElectronAPI): ChatGateway {
  return {
    async fetchSettings(): Promise<Partial<ChatSettings> | undefined> {
      return api.getSettings();
    },
    async persistSettings(settings: Partial<ChatSettings>): Promise<void> {
      await requireSuccess(api.setSettings(settings));
    },
    async fetchConversation(): Promise<ChatMessage[]> {
      const conversation = await api.getConversation();
      return conversation;
    },
    async persistConversation(messages: ChatMessage[]): Promise<void> {
      await requireSuccess(api.saveConversation(messages));
    },
    async clearConversation(): Promise<void> {
      await requireSuccess(api.clearConversation());
    },
    async sendMessage(conversationHistory) {
      return api.sendMessage(conversationHistory);
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
      await requireSuccess(api.clearApiKey());
    },
  };
}
