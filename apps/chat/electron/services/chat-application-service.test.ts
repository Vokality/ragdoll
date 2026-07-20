import { describe, expect, it } from "bun:test";
import type {
  ConversationEntry,
  EventTurnOutcome,
  ExtensionConversationEvent,
} from "../domain/conversation.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import type { AgentRunner } from "./openai-service.js";
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
    onStreamingText: (text: string) => void,
  ): Promise<string> {
    this.userConversations = [...this.userConversations, conversation];
    onStreamingText("Hello");
    onStreamingText(" there");
    return "Hello there";
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
      runUserTurn: async (_apiKey, _conversation, onStreamingText, signal) => {
        onStreamingText("Partial ");
        onStreamingText("answer");
        await turnGate;
        if (signal?.aborted) throw new Error("Request was aborted.");
        return "never reached";
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
      runUserTurn: async () => {
        executionOrder.push("user-started");
        markUserTurnStarted();
        await userTurnGate;
        executionOrder.push("user-finished");
        return "Done";
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
