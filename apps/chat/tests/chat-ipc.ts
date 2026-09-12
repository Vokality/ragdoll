import assert from "node:assert/strict";
import { BrowserWindow, ipcMain } from "electron";
import { IpcRegistrar } from "../electron/ipc/registrar.js";
import { registerChatIpc } from "../electron/ipc/register-chat-ipc.js";
import { ChatApplicationService } from "../electron/services/chat-application-service.js";
import { RendererEventService } from "../electron/services/renderer-event-service.js";
import { configuredAgent } from "../electron/test-support/configured-agent.js";
import { createInMemoryStorageRepository } from "../electron/test-support/in-memory-storage-repository.js";

export async function verifyChatIpc(preload: string): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { preload, contextIsolation: true, sandbox: true },
  });
  const events = new RendererEventService();
  events.attach(window);
  const chat = new ChatApplicationService(
    createInMemoryStorageRepository(),
    configuredAgent({
      async runUserTurn(_key, _conversation, turn) {
        turn.onText("Checking.");
        await turn.onMessage({ content: "Checking.", phase: "commentary" });
        turn.onText(" Done.");
        await turn.onMessage({ content: "Done.", phase: "final_answer" });
      },
      async runEventTurn() {
        return { disposition: "silent" };
      },
    }),
    (conversation) => events.conversationChanged(conversation),
    (error) => {
      throw error;
    },
  );
  const registrar = new IpcRegistrar(
    ipcMain,
    (event) => event.sender === window.webContents,
  );
  registerChatIpc(registrar, chat);
  try {
    await window.loadURL(
      "data:text/html,<title>Chat identity IPC regression</title>",
    );
    const result: unknown = await window.webContents
      .executeJavaScript(`(async () => {
      const api = window.electronAPI;
      const chunks = [];
      const histories = [];
      const offText = api.onStreamingText((text, id) => chunks.push({ text, id }));
      const offHistory = api.onConversationChanged((history) => histories.push(history));
      const sent = await api.sendMessage("Check");
      const history = await api.getConversation();
      offText();
      offHistory();
      return [
        sent.success,
        chunks.length === 2 && history.length === 3,
        history.every(message => typeof message.id === "string" && message.id.length > 0),
        new Set(history.map(message => message.id)).size === 3,
        chunks[0].id === history[1].id && chunks[1].id === history[2].id,
        history[1].phase === "commentary" && history[2].phase === "final_answer",
        histories.at(-1).every((message, index) => message.id === history[index].id),
        chunks[1].text === " Done." && history[2].content === "Done."
      ];
    })()`);
    assert(
      Array.isArray(result) &&
        result.length === 8 &&
        result.every((check) => check === true),
      "Chat identity did not survive real preload, streaming and persisted IPC",
    );
    console.log(
      "PASS: real preload and chat IPC preserve message IDs across progress, streaming and persistence",
    );
  } finally {
    await chat.destroy();
    await registrar.dispose();
    events.detach(window);
    window.destroy();
  }
}
