import { z } from "zod";
import { conversationMessageSchema } from "../infrastructure/storage-repository.js";
import type { ChatApplicationService } from "../services/chat-application-service.js";
import type { IpcRegistrar } from "./registrar.js";

const conversationSchema = z.array(conversationMessageSchema);

export function registerChatIpc(
  ipc: IpcRegistrar,
  chat: ChatApplicationService,
): void {
  ipc.handle("chat:get-conversation", () => chat.getConversation());
  ipc.handle("chat:clear-conversation", () => chat.clearConversation());
  ipc.handle("chat:save-conversation", (_event, conversation: unknown) =>
    chat.saveConversation(conversationSchema.parse(conversation)),
  );
  ipc.handle("chat:send-message", (event, conversation: unknown) =>
    chat.send(conversationSchema.parse(conversation), {
      streamingText: (text) => event.sender.send("chat:streaming-text", text),
      streamEnded: () => event.sender.send("chat:stream-end"),
    }),
  );
}
