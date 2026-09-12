import { z } from "zod";
import type { ChatApplicationService } from "../services/chat-application-service.js";
import { IPC_CHANNELS } from "../electron-api.js";
import type { IpcRegistrar } from "./registrar.js";
import { sendRendererEvent } from "../services/send-renderer-event.js";

const userMessageSchema = z.string().trim().min(1).max(10_000);

export function registerChatIpc(
  ipc: IpcRegistrar,
  chat: ChatApplicationService,
): void {
  ipc.handle(IPC_CHANNELS.chat.getConversation, () => chat.getConversation());
  ipc.handle(IPC_CHANNELS.chat.clearConversation, () =>
    chat.clearConversation(),
  );
  ipc.handle(IPC_CHANNELS.chat.sendMessage, (event, message: unknown) =>
    chat.sendMessage(userMessageSchema.parse(message), {
      streamingText: (text, messageId) =>
        sendRendererEvent(
          event.sender,
          IPC_CHANNELS.chat.streamingText,
          text,
          messageId,
        ),
      streamEnded: () =>
        sendRendererEvent(event.sender, IPC_CHANNELS.chat.streamEnd),
    }),
  );
  ipc.handle(IPC_CHANNELS.chat.cancelMessage, () => chat.cancelActiveTurn());
}
