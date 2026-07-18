import { describe, expect, it } from "bun:test";
import type { ChatGateway, StreamingHandlers } from "./ports/chat-gateway";
import { ChatService } from "./chat-service";

function createGateway() {
  let streamingHandlers: StreamingHandlers | null = null;
  let sentConversation: Parameters<ChatGateway["sendMessage"]>[0] = [];
  let persistedConversation: Parameters<ChatGateway["persistConversation"]>[0] =
    [];

  const gateway: ChatGateway = {
    fetchSettings: async () => ({ theme: "robot", variant: "einstein" }),
    persistSettings: async () => undefined,
    fetchConversation: async () => [{ role: "assistant", content: "Hello" }],
    persistConversation: async (messages) => {
      persistedConversation = messages;
    },
    clearConversation: async () => undefined,
    sendMessage: async (conversation) => {
      sentConversation = conversation;
      return { success: true };
    },
    subscribeToStreaming: (handlers) => {
      streamingHandlers = handlers;
      return () => {
        streamingHandlers = null;
      };
    },
    onFunctionCall: () => () => undefined,
    clearApiKey: async () => undefined,
  };

  return {
    gateway,
    getStreamingHandlers: () => streamingHandlers,
    getSentConversation: () => sentConversation,
    getPersistedConversation: () => persistedConversation,
  };
}

describe("ChatService", () => {
  it("owns hydration, streaming, and persistence outside React", async () => {
    const testGateway = createGateway();
    const service = new ChatService(testGateway.gateway);

    await service.start();
    expect(service.getSnapshot().settings).toEqual({
      theme: "robot",
      variant: "einstein",
    });

    await service.sendMessage("Hi");
    expect(testGateway.getSentConversation()).toEqual([
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Hi" },
    ]);

    testGateway.getStreamingHandlers()?.onText("Hello back");
    expect(service.getSnapshot().visibleMessages.at(-1)?.content).toBe(
      "Hello back",
    );
    testGateway.getStreamingHandlers()?.onStreamEnd();

    expect(service.getSnapshot().isLoading).toBe(false);
    expect(testGateway.getPersistedConversation().at(-1)).toEqual({
      role: "assistant",
      content: "Hello back",
    });
    service.stop();
    expect(testGateway.getStreamingHandlers()).toBeNull();
  });
});
