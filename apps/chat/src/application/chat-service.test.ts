import { describe, expect, it } from "bun:test";
import type { ChatGateway, StreamingHandlers } from "./ports/chat-gateway";
import { ChatService } from "./chat-service";

function createGateway() {
  let streamingHandlers: StreamingHandlers | null = null;
  let sentMessage = "";
  let cancelCount = 0;

  const gateway: ChatGateway = {
    cancelMessage: async () => {
      cancelCount += 1;
    },
    fetchSettings: async () => ({ theme: "robot", variant: "einstein" }),
    persistSettings: async () => undefined,
    fetchConversation: async () => [{ role: "assistant", content: "Hello" }],
    clearConversation: async () => undefined,
    sendMessage: async (message) => {
      sentMessage = message;
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
    getSentMessage: () => sentMessage,
    getCancelCount: () => cancelCount,
  };
}

describe("ChatService", () => {
  it("owns hydration and the main-process conversation projection outside React", async () => {
    const testGateway = createGateway();
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });

    await service.start();
    expect(service.getSnapshot().settings).toEqual({
      theme: "robot",
      variant: "einstein",
    });

    await service.sendMessage("Hi");
    expect(testGateway.getSentMessage()).toBe("Hi");
    testGateway.getStreamingHandlers()?.onConversationChanged([
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Hi" },
    ]);

    testGateway.getStreamingHandlers()?.onText("Hello back");
    expect(service.getSnapshot().visibleMessages.at(-1)?.content).toBe(
      "Hello back",
    );
    testGateway.getStreamingHandlers()?.onStreamEnd();
    testGateway.getStreamingHandlers()?.onConversationChanged([
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello back" },
    ]);

    expect(service.getSnapshot().isLoading).toBe(false);
    expect(service.getSnapshot().visibleMessages.at(-1)).toEqual({
      role: "assistant",
      content: "Hello back",
    });
    service.stop();
    expect(testGateway.getStreamingHandlers()).toBeNull();
  });

  it("forwards stopStreaming to the gateway only while a turn is in flight", async () => {
    const testGateway = createGateway();
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    await service.start();

    await service.stopStreaming();
    expect(testGateway.getCancelCount()).toBe(0);

    void service.sendMessage("Hi");
    expect(service.getSnapshot().isLoading).toBe(true);
    await service.stopStreaming();
    expect(testGateway.getCancelCount()).toBe(1);

    service.stop();
  });
});
