import { describe, expect, it } from "bun:test";
import type {
  ConversationEntry,
  EventTurnOutcome,
  ExtensionConversationEvent,
} from "../domain/conversation.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import type { AgentRunner, AgentTurnEvents } from "./openai-service.js";
import { ChatApplicationService } from "./chat-application-service.js";
import { ConversationEventService } from "./conversation-event-service.js";

const eventDependencies = {
  createId: () => globalThis.crypto.randomUUID(),
  now: Date.now,
};
const ignoreError = () => undefined;

class StubAgentRunner implements AgentRunner {
  eventOutcome: EventTurnOutcome = { disposition: "silent" };
  eventError: Error | null = null;
  eventConversations: ReadonlyArray<readonly ConversationEntry[]> = [];
  userConversations: ReadonlyArray<readonly ConversationEntry[]> = [];

  async runUserTurn(
    _apiKey: string,
    conversation: readonly ConversationEntry[],
    events: AgentTurnEvents,
  ): Promise<void> {
    this.userConversations = [...this.userConversations, conversation];
    events.onText("Hello");
    events.onText(" there");
    await events.onMessage({ content: "Hello there" });
  }

  async runEventTurn(
    _apiKey: string,
    conversation: readonly ConversationEntry[],
    _trigger: ExtensionConversationEvent,
  ): Promise<EventTurnOutcome> {
    this.eventConversations = [...this.eventConversations, conversation];
    if (this.eventError) throw this.eventError;
    return this.eventOutcome;
  }
}

function createChat(agent = new StubAgentRunner()) {
  const storage = createInMemoryStorageRepository();
  const projections: Array<Array<{ role: string; content: string }>> = [];
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "api-key" },
    agent,
    (conversation) => projections.push(conversation),
    ignoreError,
  );
  return { agent, chat, projections, storage };
}

describe("ChatApplicationService", () => {
  it("shutdown saves partial text and rejects queued user turns", async () => {
    let markStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const agent: AgentRunner = {
      runUserTurn: async (_key, _conversation, stream, signal) => {
        stream.onText("Partial answer");
        markStarted();
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true },
          );
        });
        return;
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    };
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "key" },
      agent,
      () => {},
      ignoreError,
    );
    const callbacks = { streamingText() {}, streamEnded() {} };
    const first = chat.sendMessage("First", callbacks);
    await started;
    const second = chat.sendMessage("Queued", callbacks);
    await chat.destroy();
    expect(await first).toEqual({ success: true });
    expect(await second).toMatchObject({ success: false });
    expect(await chat.sendMessage("Late", callbacks)).toMatchObject({
      success: false,
    });
    expect(await chat.clearConversation()).toMatchObject({ success: false });
    expect(storage.snapshot().conversation).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: "Partial answer" },
    ]);
  });

  it("shutdown completes an active event and retains unstarted events for next launch", async () => {
    let markStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let finishEvent = () => {};
    const eventGate = new Promise<void>((resolve) => {
      finishEvent = resolve;
    });
    let calls = 0;
    const agent: AgentRunner = {
      runUserTurn: async (_key, _history, events) => {
        await events.onMessage({ content: "Hello" });
      },
      runEventTurn: async () => {
        calls += 1;
        markStarted();
        await eventGate;
        return { disposition: "respond", content: "Finished" };
      },
    };
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "key" },
      agent,
      () => {},
      ignoreError,
    );
    const events = new ConversationEventService(storage, eventDependencies);
    await events.publish("timer", {
      type: "timer.first",
      payload: {},
      turnPolicy: "start-turn",
    });
    const second = await events.publish("timer", {
      type: "timer.second",
      payload: {},
      turnPolicy: "start-turn",
    });
    const run = chat.schedulePendingEventTurns();
    await started;
    let stopped = false;
    const stopping = chat.destroy().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finishEvent();
    await Promise.all([run, stopping]);
    await chat.schedulePendingEventTurns();
    expect(calls).toBe(1);
    expect(storage.snapshot().pendingAgentTurns).toMatchObject([
      { triggerEventId: second.eventId },
    ]);
    expect(storage.snapshot().conversation.at(-1)).toEqual({
      role: "assistant",
      content: "Finished",
    });
  });

  it("owns user-message persistence and publishes the visible projection", async () => {
    const { chat, projections, storage } = createChat();
    const streamed: string[] = [];
    let streamEnded = 0;

    expect(
      await chat.sendMessage(" Hi ", {
        streamingText: (text) => streamed.push(text),
        streamEnded: () => {
          streamEnded += 1;
        },
      }),
    ).toEqual({ success: true });

    expect(streamed).toEqual(["Hello", " there"]);
    expect(streamEnded).toBe(1);
    expect(storage.snapshot().conversation).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello there" },
    ]);
    expect(projections.at(-1)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello there" },
    ]);
  });

  it("completes an event turn silently while retaining its conversation entry", async () => {
    const { agent, chat, storage } = createChat();
    const events = new ConversationEventService(storage, eventDependencies);
    await events.publish("pomodoro", {
      type: "timer.completed",
      payload: { completedPhase: "focus" },
      turnPolicy: "start-turn",
    });

    await chat.schedulePendingEventTurns();

    expect(agent.eventConversations[0]?.[0]).toMatchObject({
      kind: "extension-event",
      extensionId: "pomodoro",
      type: "timer.completed",
    });
    expect(storage.snapshot().conversation).toHaveLength(1);
    expect(storage.snapshot().pendingAgentTurns).toEqual([]);
  });

  it("includes record-only events in the next user turn", async () => {
    const { agent, chat, storage } = createChat();
    const events = new ConversationEventService(storage, eventDependencies);
    await events.publish("calendar", {
      type: "calendar.synchronized",
      payload: { changed: 3 },
      turnPolicy: "record-only",
    });

    await chat.sendMessage("What changed?", {
      streamingText: () => {},
      streamEnded: () => {},
    });

    expect(agent.userConversations[0]).toMatchObject([
      {
        kind: "extension-event",
        extensionId: "calendar",
        type: "calendar.synchronized",
      },
      { role: "user", content: "What changed?" },
    ]);
    expect(storage.snapshot().pendingAgentTurns).toEqual([]);
  });

  it("persists and publishes an event-triggered assistant response", async () => {
    const agent = new StubAgentRunner();
    agent.eventOutcome = {
      disposition: "respond",
      content: "Your focus session is complete.",
    };
    const { chat, projections, storage } = createChat(agent);
    const events = new ConversationEventService(storage, eventDependencies);
    await events.publish("pomodoro", {
      type: "timer.completed",
      payload: { completedPhase: "focus" },
      turnPolicy: "start-turn",
    });

    await chat.schedulePendingEventTurns();

    expect(storage.snapshot().conversation?.at(-1)).toEqual({
      role: "assistant",
      content: "Your focus session is complete.",
    });
    expect(projections.at(-1)).toEqual([
      {
        role: "assistant",
        content: "Your focus session is complete.",
      },
    ]);
    expect(storage.snapshot().pendingAgentTurns).toEqual([]);
  });

  it("retains a pending event job when agent evaluation fails", async () => {
    const reportedErrors: unknown[] = [];
    const agent = new StubAgentRunner();
    agent.eventError = new Error("model unavailable");
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "api-key" },
      agent,
      () => {},
      (error) => reportedErrors.push(error),
    );
    const events = new ConversationEventService(storage, eventDependencies);
    const published = await events.publish("pomodoro", {
      type: "timer.completed",
      payload: { completedPhase: "focus" },
      turnPolicy: "start-turn",
    });

    await chat.schedulePendingEventTurns();

    expect(storage.snapshot().pendingAgentTurns).toEqual([
      {
        triggerEventId: published.eventId,
        createdAt: expect.any(Number),
      },
    ]);
    expect(reportedErrors).toEqual([agent.eventError]);
  });

  it("keeps partial streamed text when the user cancels mid-turn", async () => {
    let releaseTurn: () => void = () => {};
    const turnGate = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });
    const agent: AgentRunner = {
      runUserTurn: async (_apiKey, _conversation, events, signal) => {
        events.onText("Partial ");
        events.onText("answer");
        await turnGate;
        if (signal?.aborted) throw new Error("Request was aborted.");
        return;
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    };
    const storage = createInMemoryStorageRepository();
    const projections: Array<Array<{ role: string; content: string }>> = [];
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "api-key" },
      agent,
      (conversation) => projections.push(conversation),
      ignoreError,
    );

    let streamEnded = 0;
    const turn = chat.sendMessage("Hi", {
      streamingText: () => {},
      streamEnded: () => {
        streamEnded += 1;
      },
    });
    await Bun.sleep(0);
    chat.cancelActiveTurn();
    releaseTurn();

    expect(await turn).toEqual({ success: true });
    expect(streamEnded).toBe(1);
    expect(storage.snapshot().conversation).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Partial answer" },
    ]);
    expect(projections.at(-1)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Partial answer" },
    ]);
  });

  it("cancels cleanly when nothing has streamed yet", async () => {
    let releaseTurn: () => void = () => {};
    const turnGate = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });
    const agent: AgentRunner = {
      runUserTurn: async () => {
        await turnGate;
        throw new Error("Request was aborted.");
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    };
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "api-key" },
      agent,
      () => {},
      ignoreError,
    );

    let streamEnded = 0;
    const turn = chat.sendMessage("Hi", {
      streamingText: () => {},
      streamEnded: () => {
        streamEnded += 1;
      },
    });
    await Bun.sleep(0);
    chat.cancelActiveTurn();
    releaseTurn();

    expect(await turn).toEqual({ success: true });
    expect(streamEnded).toBe(1);
    expect(storage.snapshot().conversation).toEqual([
      { role: "user", content: "Hi" },
    ]);
  });

  it("serializes event turns behind an active user turn", async () => {
    let releaseUserTurn: () => void = () => {};
    let markUserTurnStarted: () => void = () => {};
    const userTurnStarted = new Promise<void>((resolve) => {
      markUserTurnStarted = resolve;
    });
    const userTurnGate = new Promise<void>((resolve) => {
      releaseUserTurn = resolve;
    });
    const executionOrder: string[] = [];
    const agent: AgentRunner = {
      runUserTurn: async (_key, _history, events) => {
        executionOrder.push("user-started");
        markUserTurnStarted();
        await userTurnGate;
        executionOrder.push("user-finished");
        await events.onMessage({ content: "Done" });
      },
      runEventTurn: async () => {
        executionOrder.push("event-started");
        return { disposition: "silent" };
      },
    };
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "api-key" },
      agent,
      () => {},
      ignoreError,
    );
    const events = new ConversationEventService(storage, eventDependencies);

    const userTurn = chat.sendMessage("Start", {
      streamingText: () => {},
      streamEnded: () => {},
    });
    await userTurnStarted;
    await events.publish("pomodoro", {
      type: "timer.completed",
      payload: {},
      turnPolicy: "start-turn",
    });
    const eventTurn = chat.schedulePendingEventTurns();

    expect(executionOrder).toEqual(["user-started"]);
    releaseUserTurn();
    await Promise.all([userTurn, eventTurn]);
    expect(executionOrder).toEqual([
      "user-started",
      "user-finished",
      "event-started",
    ]);
  });
});

it("preserves streamed progress on failure and accepts the next user turn", async () => {
  let calls = 0;
  const agent: AgentRunner = {
    runUserTurn: async (_key, _conversation, stream) => {
      calls += 1;
      stream.onText(calls === 1 ? "Checking." : "Recovered.");
      if (calls === 1) throw new Error("Connection interrupted");
      await stream.onMessage({ content: "Recovered." });
    },
    runEventTurn: async () => ({ disposition: "silent" }),
  };
  const storage = createInMemoryStorageRepository();
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "key" },
    agent,
    () => {},
    ignoreError,
  );
  let ended = 0;
  const events = {
    streamingText: () => {},
    streamEnded: () => {
      ended += 1;
    },
  };
  expect(await chat.sendMessage("Check", events)).toEqual({
    success: false,
    error: "Connection interrupted",
  });
  expect(storage.snapshot().conversation).toContainEqual({
    role: "assistant",
    content: "Checking.",
  });
  expect(await chat.sendMessage("Continue", events)).toEqual({ success: true });
  expect(storage.snapshot().conversation).toContainEqual({
    role: "assistant",
    content: "Recovered.",
  });
  expect(ended).toBe(2);
});

it("persists and publishes structured citations with user and event responses", async () => {
  const sources = [{ title: "NASA", url: "https://www.nasa.gov/" }];
  const storage = createInMemoryStorageRepository();
  const published: ConversationEntry[][] = [];
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "key" },
    {
      runUserTurn: async (_key, _history, stream) => {
        stream.onText("News.");
        await stream.onMessage({ content: "News.", sources });
      },
      runEventTurn: async () => ({
        disposition: "respond",
        content: "Update.",
        sources,
      }),
    },
    (conversation) => published.push(conversation),
    ignoreError,
  );
  await chat.sendMessage("Search", {
    streamingText: () => {},
    streamEnded: () => {},
  });
  const expected: ConversationEntry = {
    role: "assistant",
    content: "News.",
    sources,
  };
  expect((await chat.getConversation()).at(-1)).toEqual(expected);
  expect(published.at(-1)?.at(-1)).toEqual(expected);
  const event: ExtensionConversationEvent = {
    kind: "extension-event",
    id: "citation-event",
    extensionId: "test",
    type: "test.update",
    payload: {},
    turnPolicy: "start-turn",
    occurredAt: 1,
  };
  await storage.update((draft) => {
    draft.conversation.push(event);
    draft.pendingAgentTurns.push({ triggerEventId: event.id, createdAt: 1 });
  });
  await chat.schedulePendingEventTurns();
  expect((await chat.getConversation()).at(-1)).toEqual({
    role: "assistant",
    content: "Update.",
    sources,
  });
});

it("publishes an acknowledgment before slow work, then a separate final answer without ending early", async () => {
  const gate = Promise.withResolvers<void>();
  const acknowledged = Promise.withResolvers<void>();
  const storage = createInMemoryStorageRepository();
  const order: string[] = [];
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "key" },
    {
      runUserTurn: async (_key, _history, events) => {
        events.onText("I'll check.");
        await events.onMessage({ content: "I'll check.", phase: "commentary" });
        acknowledged.resolve();
        await gate.promise;
        events.onText("Found it.");
        await events.onMessage({ content: "Found it.", phase: "final_answer" });
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    },
    (conversation) => order.push(conversation.at(-1)?.content ?? ""),
    ignoreError,
  );
  const turn = chat.sendMessage("Check", {
    streamingText: () => {},
    streamEnded: () => order.push("ended"),
  });
  await acknowledged.promise;
  expect(order).toEqual(["Check", "I'll check."]);
  expect((await chat.getConversation()).at(-1)).toEqual({
    role: "assistant",
    content: "I'll check.",
    phase: "commentary",
  });
  gate.resolve();
  expect(await turn).toEqual({ success: true });
  expect(order).toEqual(["Check", "I'll check.", "Found it.", "ended"]);
  expect(
    (await chat.getConversation()).filter(
      (message) => message.role === "assistant",
    ),
  ).toHaveLength(2);
});

it("cancels after commentary without duplicating it or manufacturing a final answer", async () => {
  const ready = Promise.withResolvers<void>();
  const storage = createInMemoryStorageRepository();
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "key" },
    {
      runUserTurn: async (_key, _history, events, signal) => {
        events.onText("I'll check.");
        await events.onMessage({ content: "I'll check.", phase: "commentary" });
        const cancelled = new Promise<void>((_resolve, reject) =>
          signal?.addEventListener(
            "abort",
            () => reject(new Error("Cancelled")),
            { once: true },
          ),
        );
        ready.resolve();
        await cancelled;
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    },
    () => {},
    ignoreError,
  );
  let ends = 0;
  const turn = chat.sendMessage("Check", {
    streamingText: () => {},
    streamEnded: () => {
      ends++;
    },
  });
  await ready.promise;
  chat.cancelActiveTurn();
  expect(await turn).toEqual({ success: true });
  expect(await chat.getConversation()).toEqual([
    { role: "user", content: "Check" },
    { role: "assistant", content: "I'll check.", phase: "commentary" },
  ]);
  expect(ends).toBe(1);
});
