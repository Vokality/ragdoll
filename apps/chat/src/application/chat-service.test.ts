import type { ChatMessage } from "../domain/chat";
import { describe, expect, it } from "bun:test";
import type {
  ChatGateway,
  ChatSendResult,
  StreamingHandlers,
} from "./ports/chat-gateway";
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
  it("recovers a completed response after a subscription gap without sending it again", async () => {
    const testGateway = createGateway();
    const completion = Promise.withResolvers<ChatSendResult>();
    let persisted = false;
    let sends = 0;
    testGateway.gateway.sendMessage = () => {
      sends++;
      return completion.promise;
    };
    testGateway.gateway.fetchConversation = async () =>
      persisted
        ? [
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Complete answer" },
          ]
        : [{ role: "user", content: "Hi" }];
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    await service.start();
    const send = service.sendMessage("Hi");
    const retiredHandlers = testGateway.getStreamingHandlers();
    retiredHandlers?.onText("Complete");
    service.stop();
    await service.start();
    retiredHandlers?.onText(" stale");
    retiredHandlers?.onStreamEnd();
    expect(service.getSnapshot().isLoading).toBe(true);
    persisted = true;
    completion.resolve({ success: true });
    await send;
    expect(sends).toBe(1);
    expect(service.getSnapshot()).toMatchObject({
      isLoading: false,
      isStreaming: false,
      error: null,
      visibleMessages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Complete answer" },
      ],
    });
    service.stop();
  });

  it.each<ChatSendResult>([
    { success: true },
    { success: false, error: "Old failure" },
  ])(
    "an older request result cannot finish or fail a newer turn: %j",
    async (oldResult) => {
      const testGateway = createGateway();
      const old = Promise.withResolvers<ChatSendResult>();
      const current = Promise.withResolvers<ChatSendResult>();
      let sends = 0;
      testGateway.gateway.sendMessage = () =>
        ++sends === 1 ? old.promise : current.promise;
      const service = new ChatService(testGateway.gateway, {
        theme: "default",
        variant: "human",
      });
      await service.start();
      const first = service.sendMessage("First");
      testGateway.getStreamingHandlers()?.onStreamEnd();
      const second = service.sendMessage("Second");
      testGateway.getStreamingHandlers()?.onText("New answer");
      old.resolve(oldResult);
      await first;
      expect(service.getSnapshot()).toMatchObject({
        isLoading: true,
        isStreaming: true,
        error: null,
      });
      expect(service.getSnapshot().visibleMessages.at(-1)?.content).toBe(
        "New answer",
      );
      current.resolve({ success: true });
      await second;
      expect(service.getSnapshot().isLoading).toBe(false);
      service.stop();
    },
  );

  it("conversation recovery does not overwrite a newer live projection", async () => {
    const testGateway = createGateway();
    const completion = Promise.withResolvers<ChatSendResult>();
    const recovery =
      Promise.withResolvers<
        Awaited<ReturnType<ChatGateway["fetchConversation"]>>
      >();
    const recoveryStarted = Promise.withResolvers<void>();
    let reads = 0;
    testGateway.gateway.sendMessage = () => completion.promise;
    testGateway.gateway.fetchConversation = () => {
      if (++reads < 3) return Promise.resolve([]);
      recoveryStarted.resolve();
      return recovery.promise;
    };
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    await service.start();
    const send = service.sendMessage("Hi");
    service.stop();
    await service.start();
    completion.resolve({ success: true });
    await recoveryStarted.promise;
    testGateway
      .getStreamingHandlers()
      ?.onConversationChanged([
        { role: "assistant", content: "Newer event reply" },
      ]);
    recovery.resolve([{ role: "assistant", content: "Older recovered reply" }]);
    await send;
    expect(service.getSnapshot().visibleMessages).toEqual([
      { role: "assistant", content: "Newer event reply" },
    ]);
    service.stop();
  });

  it("late hydration preserves a saved theme while loading the untouched variant", async () => {
    const testGateway = createGateway();
    const settings =
      Promise.withResolvers<
        Awaited<ReturnType<ChatGateway["fetchSettings"]>>
      >();
    testGateway.gateway.fetchSettings = () => settings.promise;
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    const started = service.start();
    expect(await service.changeTheme("alien")).toBe(true);
    settings.resolve({ theme: "robot", variant: "einstein" });
    await started;
    expect(service.getSnapshot().settings).toEqual({
      theme: "alien",
      variant: "einstein",
    });
    service.stop();
  });

  it("late hydration preserves a saved variant while loading the untouched theme", async () => {
    const testGateway = createGateway();
    const settings =
      Promise.withResolvers<
        Awaited<ReturnType<ChatGateway["fetchSettings"]>>
      >();
    testGateway.gateway.fetchSettings = () => settings.promise;
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "einstein",
    });
    const started = service.start();
    expect(await service.changeVariant("human")).toBe(true);
    settings.resolve({ theme: "robot", variant: "einstein" });
    await started;
    expect(service.getSnapshot().settings).toEqual({
      theme: "robot",
      variant: "human",
    });
    service.stop();
  });

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

  it("hands off the streamed reply without a blank frame or duplicate", async () => {
    const testGateway = createGateway();
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    await service.start();
    testGateway.getStreamingHandlers()?.onConversationChanged([]);

    await service.sendMessage("Hi");
    testGateway
      .getStreamingHandlers()
      ?.onConversationChanged([{ role: "user", content: "Hi" }]);
    testGateway.getStreamingHandlers()?.onText("Hello back");

    // Stream end arrives before the persisted conversation: the streamed
    // text must stay visible instead of blanking for a frame.
    testGateway.getStreamingHandlers()?.onStreamEnd();
    expect(service.getSnapshot().visibleMessages.at(-1)).toEqual({
      role: "assistant",
      content: "Hello back",
    });

    // Once persisted, the reply renders exactly once.
    testGateway.getStreamingHandlers()?.onConversationChanged([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello back" },
    ]);
    const assistantMessages = service
      .getSnapshot()
      .visibleMessages.filter((message) => message.role === "assistant");
    expect(assistantMessages).toEqual([
      { role: "assistant", content: "Hello back" },
    ]);

    service.stop();
  });

  it("hands off inline streamed citations to structured persisted sources without duplicating the response", async () => {
    const testGateway = createGateway();
    const service = new ChatService(testGateway.gateway, {
      theme: "default",
      variant: "human",
    });
    await service.start();
    const handlers = testGateway.getStreamingHandlers();
    handlers?.onConversationChanged([{ role: "user", content: "Search" }]);
    handlers?.onText("News. [NASA](https://www.nasa.gov/)");
    handlers?.onStreamEnd();
    const response = {
      role: "assistant",
      content: "News.",
      sources: [{ title: "NASA", url: "https://www.nasa.gov/" }],
    } satisfies ChatMessage;
    handlers?.onConversationChanged([
      { role: "user", content: "Search" },
      response,
    ]);
    expect(service.getSnapshot().visibleMessages).toEqual([
      { role: "user", content: "Search" },
      response,
    ]);
    service.stop();
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

it("ignores hydration from a stopped React subscription after restart", async () => {
  const testGateway = createGateway();
  const oldSettings =
    Promise.withResolvers<Awaited<ReturnType<ChatGateway["fetchSettings"]>>>();
  let fetchCount = 0;
  testGateway.gateway.fetchSettings = () =>
    ++fetchCount === 1
      ? oldSettings.promise
      : Promise.resolve({ theme: "default", variant: "human" });
  const service = new ChatService(testGateway.gateway, {
    theme: "default",
    variant: "human",
  });
  const firstStart = service.start();
  service.stop();
  await service.start();
  oldSettings.resolve({ theme: "robot", variant: "einstein" });
  await firstStart;
  expect(service.getSnapshot().settings).toEqual({
    theme: "default",
    variant: "human",
  });
  service.stop();
});

it("ignores errors from hydration that completed after unmount", async () => {
  const testGateway = createGateway();
  const settings =
    Promise.withResolvers<Awaited<ReturnType<ChatGateway["fetchSettings"]>>>();
  testGateway.gateway.fetchSettings = () => settings.promise;
  const service = new ChatService(testGateway.gateway, {
    theme: "default",
    variant: "human",
  });
  const started = service.start();
  service.stop();
  settings.reject(new Error("Late failure"));
  await started;
  expect(service.getSnapshot().error).toBeNull();
});

it("keeps loading during work after a completed acknowledgment and renders the answer separately", async () => {
  const testGateway = createGateway();
  const done = Promise.withResolvers<ChatSendResult>();
  testGateway.gateway.sendMessage = () => done.promise;
  const service = new ChatService(testGateway.gateway, {
    theme: "default",
    variant: "human",
  });
  await service.start();
  const sending = service.sendMessage("Check");
  const handlers = testGateway.getStreamingHandlers();
  const user = { role: "user", content: "Check" } satisfies ChatMessage;
  const ack = {
    role: "assistant",
    content: "I'll check.",
    phase: "commentary",
  } satisfies ChatMessage;
  handlers?.onConversationChanged([user]);
  handlers?.onText(ack.content);
  handlers?.onConversationChanged([user, ack]);
  expect(service.getSnapshot()).toMatchObject({
    isLoading: true,
    isStreaming: false,
    visibleMessages: [user, ack],
  });
  handlers?.onText("Done.");
  expect(service.getSnapshot().isStreaming).toBe(true);
  const final = {
    role: "assistant",
    content: "Done.",
    phase: "final_answer",
  } satisfies ChatMessage;
  handlers?.onConversationChanged([user, ack, final]);
  handlers?.onStreamEnd();
  done.resolve({ success: true });
  await sending;
  expect(service.getSnapshot()).toMatchObject({
    isLoading: false,
    isStreaming: false,
    visibleMessages: [user, ack, final],
  });
  service.stop();
});
