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
      "clearApiKey" | "clearConversation" | "setSettings" | "cancelMessage"
    ]
  >,
): Promise<void> {
  const result = await operation;
  if (!result.success) throw new Error(result.error);
}

export function createElectronChatGateway(api: ElectronAPI): ChatGateway {
  return {
    async fetchSettings(): Promise<ChatSettings> {
      return api.getSettings();
    },
    async persistSettings(settings: Partial<ChatSettings>): Promise<void> {
      await requireSuccess(api.setSettings(settings));
    },
    async fetchConversation(): Promise<ChatMessage[]> {
      const conversation = await api.getConversation();
      return conversation;
    },
    async clearConversation(): Promise<void> {
      await requireSuccess(api.clearConversation());
    },
    async sendMessage(message) {
      return api.sendMessage(message);
    },
    async cancelMessage() {
      await requireSuccess(api.cancelMessage());
    },
    subscribeToStreaming({
      onText,
      onStreamEnd,
      onConversationChanged,
    }: StreamingHandlers) {
      const unsubscribeText = api.onStreamingText(onText);
      const unsubscribeEnd = api.onStreamEnd(onStreamEnd);
      const unsubscribeConversation = api.onConversationChanged(
        onConversationChanged,
      );
      return () => {
        unsubscribeText();
        unsubscribeEnd();
        unsubscribeConversation();
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
