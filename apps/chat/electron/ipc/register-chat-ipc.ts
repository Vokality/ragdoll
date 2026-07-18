import { z } from "zod";
import type { ChatApplicationService } from "../services/chat-application-service.js";
import type { IpcRegistrar } from "./registrar.js";

const userMessageSchema = z.string().trim().min(1).max(10_000);

export function registerChatIpc(
  ipc: IpcRegistrar,
  chat: ChatApplicationService,
): void {
  ipc.handle("chat:get-conversation", () => chat.getConversation());
  ipc.handle("chat:clear-conversation", () => chat.clearConversation());
  ipc.handle("chat:send-message", (event, message: unknown) =>
    chat.sendMessage(userMessageSchema.parse(message), {
      streamingText: (text) => event.sender.send("chat:streaming-text", text),
      streamEnded: () => event.sender.send("chat:stream-end"),
    }),
  );
}
