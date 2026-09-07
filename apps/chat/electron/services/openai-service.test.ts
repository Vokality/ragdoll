import type { AgentToolResult } from "../domain/source-citation.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ToolHistoryService } from "./tool-history-service.js";
import { ChatApplicationService } from "./chat-application-service.js";
import {
  isToolExecution,
  projectVisibleConversation,
} from "../domain/conversation.js";
import { describe, expect, it } from "bun:test";
import type { ToolDefinition } from "@vokality/ragdoll-extensions";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions";
import type { ExtensionConversationEvent } from "../domain/conversation.js";
import {
  OpenAIAgentRunner,
  type AgentCompletionSession,
  type AgentCompletionSessionFactory,
  type AgentToolService,
  type CompletionRound,
} from "./openai-service.js";

const config = {
  model: "test-model",
  maxCompletionTokens: 500,
  maxToolRounds: 5,
  systemPrompt: "Test prompt",
};

const trigger: ExtensionConversationEvent = {
  kind: "extension-event",
  id: "event-1",
  extensionId: "tic-tac-toe",
  type: "game.move",
  payload: { currentPlayer: "agent" },
  turnPolicy: "start-turn",
  requiredToolName: "tic_tac_toe_place",
  occurredAt: 1,
};

function toolCall(id: string, name: string, args: Record<string, unknown>) {
  return { id, name, arguments: JSON.stringify(args) };
}

function round(...toolCalls: CompletionRound["toolCalls"]): CompletionRound {
  return { content: "", finishReason: "tool_calls", toolCalls };
}

function responseRound(content: string): CompletionRound {
  return { content, finishReason: "stop", toolCalls: [] };
}

class ScriptedCompletionSession implements AgentCompletionSession {
  readonly toolChoices: ChatCompletionToolChoiceOption[] = [];
  readonly toolNames: string[][] = [];
  readonly messages: ChatCompletionMessageParam[][] = [];

  constructor(private readonly rounds: CompletionRound[]) {}

  async complete(
    request: Parameters<AgentCompletionSession["complete"]>[0],
  ): Promise<CompletionRound> {
    this.toolChoices.push(request.toolChoice);
    this.toolNames.push(
      request.tools.flatMap((tool) =>
        tool.type === "function" ? [tool.function.name] : [],
      ),
    );
    this.messages.push(structuredClone(request.messages));
    const next = this.rounds.shift();
    if (!next) throw new Error("No scripted completion remains");
    if (next.content) request.onStreamingText?.(next.content);
    return next;
  }
}

function createRunner(
  rounds: CompletionRound[],
  results: AgentToolResult[],
  storage = createInMemoryStorageRepository(),
): {
  storage: ReturnType<typeof createInMemoryStorageRepository>;
  runner: OpenAIAgentRunner;
  session: ScriptedCompletionSession;
  executed: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const definitions: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "tic_tac_toe_place",
        description: "Place a mark",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ];
  const executed: Array<{ name: string; args: Record<string, unknown> }> = [];
  const tools: AgentToolService = {
    getTools: () => definitions,
    getToolsForExtension: (extensionId) =>
      extensionId === "tic-tac-toe" ? definitions : [],
    executeTool: async (name, args) => {
      executed.push({ name, args });
      const result = results.shift();
      if (!result) throw new Error("No scripted tool result remains");
      return result;
    },
  };
  const session = new ScriptedCompletionSession(rounds);
  const sessions: AgentCompletionSessionFactory = {
    create: () => session,
  };
  return {
    storage,
    runner: new OpenAIAgentRunner(
      tools,
      config,
      sessions,
      new ToolHistoryService(storage),
    ),
    session,
    executed,
  };
}

describe("OpenAIAgentRunner event tool rounds", () => {
  it("rejects a decision that bypasses the event's required tool", async () => {
    const { runner, session } = createRunner(
      [
        round(
          toolCall("decision-1", "lumen_event_respond", {
            content: "I moved without calling the tool.",
          }),
        ),
      ],
      [],
    );

    await expect(
      runner.runEventTurn("key", [trigger], trigger),
    ).rejects.toThrow(
      "Event turn attempted a decision before required tool 'tic_tac_toe_place' succeeded",
    );
    expect(session.toolChoices).toEqual([
      {
        type: "function",
        function: { name: "tic_tac_toe_place" },
      },
    ]);
  });

  it("feeds a successful extension result back before accepting a decision", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(
          toolCall("place-1", "tic_tac_toe_place", { row: 1, col: 1 }),
          toolCall("decision-1", "lumen_event_silent", {}),
        ),
        round(toolCall("decision-2", "lumen_event_silent", {})),
      ],
      [{ success: true, data: { moveIndex: 2 } }],
    );

    await expect(
      runner.runEventTurn("key", [trigger], trigger),
    ).resolves.toEqual({
      disposition: "silent",
    });
    expect(executed).toEqual([
      { name: "tic_tac_toe_place", args: { row: 1, col: 1 } },
    ]);
    expect(session.toolChoices).toEqual([
      {
        type: "function",
        function: { name: "tic_tac_toe_place" },
      },
      "required",
    ]);
    expect(session.toolNames[1]).toEqual([
      "lumen_event_respond",
      "lumen_event_silent",
    ]);
    expect(session.messages[1]).toContainEqual({
      role: "tool",
      tool_call_id: "place-1",
      content: JSON.stringify({
        args: { row: 1, col: 1 },
        result: { success: true, data: { moveIndex: 2 } },
      }),
    });
  });

  it("forces a retry after an illegal move and preserves its board feedback", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(
          toolCall("place-1", "tic_tac_toe_place", { row: 0, col: 0 }),
          toolCall("decision-1", "lumen_event_silent", {}),
        ),
        round(toolCall("place-2", "tic_tac_toe_place", { row: 1, col: 1 })),
        round(
          toolCall("decision-2", "lumen_event_respond", {
            content: "I moved to the center.",
          }),
        ),
      ],
      [
        {
          success: false,
          retryable: true,
          error: "Move is not in legalMoves",
          data: { currentPlayer: "agent", legalMoves: [{ row: 1, col: 1 }] },
        },
        { success: true, data: { moveIndex: 2 } },
      ],
    );

    await expect(
      runner.runEventTurn("key", [trigger], trigger),
    ).resolves.toEqual({
      disposition: "respond",
      content: "I moved to the center.",
    });
    expect(executed).toEqual([
      { name: "tic_tac_toe_place", args: { row: 0, col: 0 } },
      { name: "tic_tac_toe_place", args: { row: 1, col: 1 } },
    ]);
    expect(session.toolChoices).toEqual([
      {
        type: "function",
        function: { name: "tic_tac_toe_place" },
      },
      {
        type: "function",
        function: { name: "tic_tac_toe_place" },
      },
      "required",
    ]);
    expect(session.messages[1]).toContainEqual({
      role: "tool",
      tool_call_id: "place-1",
      content: JSON.stringify({
        args: { row: 0, col: 0 },
        result: {
          success: false,
          retryable: true,
          error: "Move is not in legalMoves",
          data: { currentPlayer: "agent", legalMoves: [{ row: 1, col: 1 }] },
        },
      }),
    });
  });

  it("rejects a required tool not owned by the source extension", async () => {
    const { runner } = createRunner([], []);
    const invalidTrigger: ExtensionConversationEvent = {
      ...trigger,
      requiredToolName: "spotify_pause",
    };

    await expect(
      runner.runEventTurn("key", [invalidTrigger], invalidTrigger),
    ).rejects.toThrow(
      "Extension 'tic-tac-toe' cannot require unowned tool 'spotify_pause'",
    );
  });
});

describe("OpenAIAgentRunner user tool rounds", () => {
  it("forces the same tool to retry a retryable failure", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(toolCall("place-1", "tic_tac_toe_place", { row: 0, col: 0 })),
        round(toolCall("place-2", "tic_tac_toe_place", { row: 1, col: 1 })),
        responseRound("I moved to the center."),
      ],
      [
        {
          success: false,
          retryable: true,
          error: "Move is not in legalMoves",
          data: { legalMoves: [{ row: 1, col: 1 }] },
        },
        { success: true, data: { moveIndex: 2 } },
      ],
    );

    await expect(
      runner.runUserTurn("key", [], () => undefined),
    ).resolves.toEqual({ content: "I moved to the center." });
    expect(executed).toEqual([
      { name: "tic_tac_toe_place", args: { row: 0, col: 0 } },
      { name: "tic_tac_toe_place", args: { row: 1, col: 1 } },
    ]);
    expect(session.toolChoices).toEqual([
      "auto",
      {
        type: "function",
        function: { name: "tic_tac_toe_place" },
      },
      "auto",
    ]);
  });
});

describe("user-turn text recovery", () => {
  it("recovers an empty final response without repeating a completed tool", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(toolCall("move", "tic_tac_toe_place", { row: 0, col: 0 })),
        responseRound(""),
        responseRound("Done."),
      ],
      [{ success: true }],
    );
    expect(await runner.runUserTurn("key", [], () => undefined)).toEqual({
      content: "Done.",
    });
    expect(executed).toHaveLength(1);
    expect(session.toolChoices).toEqual(["auto", "auto", "none"]);
    expect(session.toolNames[2]).toEqual([]);
    expect(session.messages[2].some((message) => message.role === "tool")).toBe(
      true,
    );
  });
  it("stops after one empty recovery response", async () => {
    const { runner, session } = createRunner(
      [responseRound(""), responseRound("")],
      [],
    );
    await expect(
      runner.runUserTurn("key", [], () => undefined),
    ).rejects.toThrow("empty response");
    expect(session.toolChoices).toEqual(["auto", "none"]);
  });
});

describe("user turn continuation", () => {
  it("keeps progress, executes batches and later rounds, and recovers an empty final reply", async () => {
    const { runner, session, executed } = createRunner(
      [
        {
          ...round(
            toolCall("a", "tic_tac_toe_place", { row: 0 }),
            toolCall("b", "tic_tac_toe_place", { row: 1 }),
          ),
          content: "Checking.",
        },
        round(toolCall("c", "tic_tac_toe_place", { row: 2 })),
        responseRound(""),
        responseRound("Done."),
      ],
      [{ success: true }, { success: true }, { success: true }],
    );
    let streamed = "";
    expect(
      await runner.runUserTurn("key", [], (text) => {
        streamed += text;
      }),
    ).toEqual({ content: "Checking.\n\nDone." });
    expect(streamed).toBe("Checking.\n\nDone.");
    expect(executed).toHaveLength(3);
    expect(
      session.messages[1]
        ?.filter((message) => message.role === "tool")
        .map((message) => message.tool_call_id),
    ).toEqual(["a", "b"]);
    expect(
      session.messages[3]
        ?.filter((message) => message.role === "tool")
        .map((message) => message.tool_call_id),
    ).toEqual(["a", "b", "c"]);
    expect(session.toolChoices).toEqual(["auto", "auto", "auto", "none"]);
  });

  it("returns malformed argument errors alongside successful calls and retries only the failed call", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(
          { id: "bad", name: "tic_tac_toe_place", arguments: "{" },
          toolCall("good", "tic_tac_toe_place", { row: 1 }),
        ),
        round(toolCall("fixed", "tic_tac_toe_place", { row: 0 })),
        responseRound("Done"),
      ],
      [{ success: true }, { success: true }],
    );
    await runner.runUserTurn("key", [], () => {});
    expect(executed.map((call) => call.args)).toEqual([{ row: 1 }, { row: 0 }]);
    expect(
      session.messages[1]?.filter((message) => message.role === "tool"),
    ).toHaveLength(2);
    expect(session.toolChoices[1]).toEqual({
      type: "function",
      function: { name: "tic_tac_toe_place" },
    });
  });

  it("feeds unexpected tool failures back without forcing a replay", async () => {
    const { runner, session, executed } = createRunner(
      [
        round(
          toolCall("a", "tic_tac_toe_place", {}),
          toolCall("b", "tic_tac_toe_place", {}),
        ),
        responseRound("The actions could not be confirmed."),
      ],
      [],
    );
    await runner.runUserTurn("key", [], () => {});
    expect(executed).toHaveLength(2);
    expect(session.toolChoices).toEqual(["auto", "auto"]);
    const results = session.messages[1]?.filter(
      (message) => message.role === "tool",
    );
    expect(results).toHaveLength(2);
    expect(results?.[0]?.content).toContain('"retryable":false');
  });

  for (const finishReason of [null, "content_filter", "length"] as const) {
    it(`rejects an unfinished response: ${finishReason}`, async () => {
      const { runner } = createRunner(
        [{ ...responseRound("Partial"), finishReason }],
        [],
      );
      await expect(runner.runUserTurn("key", [], () => {})).rejects.toThrow();
    });
  }

  it("does not start tools after cancellation during streaming", async () => {
    const abort = new AbortController();
    const { runner, executed } = createRunner(
      [
        {
          ...round(toolCall("a", "tic_tac_toe_place", {})),
          content: "Starting",
        },
      ],
      [{ success: true }],
    );
    await expect(
      runner.runUserTurn("key", [], () => abort.abort(), abort.signal),
    ).rejects.toThrow();
    expect(executed).toHaveLength(0);
  });
});

it("stops the remaining tool batch when cancelled during an action", async () => {
  const abort = new AbortController();
  const executed: string[] = [];
  const session = new ScriptedCompletionSession([
    round(toolCall("a", "first", {}), toolCall("b", "second", {})),
  ]);
  const tools: AgentToolService = {
    getTools: () => [],
    getToolsForExtension: () => [],
    executeTool: async (name) => {
      executed.push(name);
      abort.abort();
      return { success: true };
    },
  };
  const runner = new OpenAIAgentRunner(
    tools,
    config,
    {
      create: () => session,
    },
    new ToolHistoryService(createInMemoryStorageRepository()),
  );
  await expect(
    runner.runUserTurn("key", [], () => {}, abort.signal),
  ).rejects.toThrow();
  expect(executed).toEqual(["first"]);
  expect(session.messages).toHaveLength(1);
});

describe("durable tool history", () => {
  it("retains tool results after a failed reply and feeds them to a later turn after restart", async () => {
    const { runner, storage } = createRunner(
      [
        {
          ...round(toolCall("draw-1", "tic_tac_toe_place", { row: 1 })),
          content: "Working.",
        },
        { ...responseRound(""), finishReason: null },
      ],
      [{ success: true, data: { elementId: "sun", revision: 2 } }],
    );
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "key" },
      runner,
      () => {},
      () => {},
    );
    const result = await chat.sendMessage("Draw", {
      streamingText() {},
      streamEnded() {},
    });
    expect(result.success).toBe(false);
    const persisted = storage.snapshot();
    const records = persisted.conversation.filter(isToolExecution);
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toMatchObject({
      status: "completed",
      result: { success: true, data: { elementId: "sun", revision: 2 } },
    });
    expect(await chat.getConversation()).toEqual([
      { role: "user", content: "Draw" },
      { role: "assistant", content: "Working." },
    ]);
    const restored = createInMemoryStorageRepository(persisted);
    const next = createRunner(
      [responseRound("I added the sun.")],
      [],
      restored,
    );
    await next.runner.runUserTurn(
      "key",
      (await restored.read()).conversation,
      () => {},
    );
    const messages = next.session.messages[0] ?? [];
    const call = messages.find(
      (message) => message.role === "assistant" && message.tool_calls,
    );
    expect(call).toMatchObject({
      role: "assistant",
      tool_calls: [
        { function: { name: "tic_tac_toe_place", arguments: '{"row":1}' } },
      ],
    });
    expect(
      messages.find((message) => message.role === "tool")?.content,
    ).toContain('"elementId":"sun"');
    expect(next.executed).toHaveLength(0);
    await chat.clearConversation();
    expect(storage.snapshot().conversation).toEqual([]);
  });

  it("records malformed calls as failures without losing successful calls in the batch", async () => {
    const { runner, storage } = createRunner(
      [
        round(
          { id: "bad", name: "tic_tac_toe_place", arguments: "{" },
          toolCall("good", "tic_tac_toe_place", { row: 0 }),
        ),
        responseRound("One failed"),
      ],
      [{ success: true }],
    );
    await runner.runUserTurn("key", [], () => {});
    const records = storage.snapshot().conversation.filter(isToolExecution);
    expect(
      records.map(
        (record) =>
          record.outcome.status === "completed" &&
          record.outcome.result.success,
      ),
    ).toEqual([false, true]);
    expect(records[0]?.call.arguments).toBe("{");
  });

  it("shows an unknown outcome for an interrupted execution without inventing success", async () => {
    const storage = createInMemoryStorageRepository();
    await new ToolHistoryService(storage).start(
      toolCall("old", "tic_tac_toe_place", { row: 0 }),
      { type: "user" },
    );
    const { runner, session, executed } = createRunner(
      [responseRound("I need to check the board.")],
      [],
      storage,
    );
    await runner.runUserTurn("key", storage.snapshot().conversation, () => {});
    const result = session.messages[0]?.find(
      (message) => message.role === "tool",
    );
    expect(result?.content).toContain('"status":"unknown"');
    expect(executed).toHaveLength(0);
    expect(projectVisibleConversation(storage.snapshot().conversation)).toEqual(
      [],
    );
  });

  it("does not repeat a completed required event action when its decision is retried", async () => {
    const first = createRunner(
      [round(toolCall("move", "tic_tac_toe_place", { row: 1 }))],
      [{ success: true }],
    );
    await expect(
      first.runner.runEventTurn("key", [trigger], trigger),
    ).rejects.toThrow("No scripted completion");
    const history = first.storage.snapshot().conversation;
    const next = createRunner(
      [round(toolCall("decision", "lumen_event_silent", {}))],
      [],
      first.storage,
    );
    expect(
      await next.runner.runEventTurn("key", [trigger, ...history], trigger),
    ).toEqual({ disposition: "silent" });
    expect(next.executed).toHaveLength(0);
    expect(next.session.toolChoices).toEqual(["required"]);
    expect(next.session.toolNames[0]).toEqual([
      "lumen_event_respond",
      "lumen_event_silent",
    ]);
  });

  it("does not retry an event action whose previous outcome is unknown", async () => {
    const storage = createInMemoryStorageRepository();
    await new ToolHistoryService(storage).start(
      toolCall("old", "tic_tac_toe_place", {}),
      { type: "event", eventId: trigger.id },
    );
    const { runner, executed } = createRunner([], [], storage);
    await expect(
      runner.runEventTurn(
        "key",
        [trigger, ...storage.snapshot().conversation],
        trigger,
      ),
    ).rejects.toThrow("unknown outcome");
    expect(executed).toHaveLength(0);
  });
});

it("does not run a tool when its started record cannot be persisted", async () => {
  const storage = createInMemoryStorageRepository();
  storage.update = async () => {
    throw new Error("History storage unavailable");
  };
  const { runner, executed } = createRunner(
    [round(toolCall("a", "tic_tac_toe_place", {}))],
    [{ success: true }],
    storage,
  );
  await expect(runner.runUserTurn("key", [], () => {})).rejects.toThrow(
    "History storage unavailable",
  );
  expect(executed).toHaveLength(0);
});

it("stops the batch and leaves an unknown outcome if result persistence fails", async () => {
  const storage = createInMemoryStorageRepository();
  const update = storage.update;
  let writes = 0;
  storage.update = async (mutator) => {
    writes++;
    if (writes === 2) throw new Error("Result storage failed");
    return update(mutator);
  };
  const { runner, executed } = createRunner(
    [
      round(
        toolCall("a", "tic_tac_toe_place", {}),
        toolCall("b", "tic_tac_toe_place", {}),
      ),
    ],
    [{ success: true }, { success: true }],
    storage,
  );
  await expect(runner.runUserTurn("key", [], () => {})).rejects.toThrow(
    "Result storage failed",
  );
  expect(executed).toHaveLength(1);
  const records = storage.snapshot().conversation.filter(isToolExecution);
  expect(records).toHaveLength(1);
  expect(records[0]?.outcome).toEqual({ status: "started" });
});

it("streams and saves source citations even when the final model reply omits them", async () => {
  const sources = [{ title: "NASA", url: "https://www.nasa.gov/" }];
  const { runner, storage } = createRunner(
    [
      round(toolCall("search", "lumen_search_web", { query: "news" })),
      responseRound("NASA announced a mission."),
    ],
    [{ success: true, data: { answer: "A mission" }, sources }],
  );
  let streamed = "";
  const response = await runner.runUserTurn("key", [], (text) => {
    streamed += text;
  });
  expect(response).toEqual({ content: "NASA announced a mission.", sources });
  expect(streamed).toBe(response.content);
  expect(
    storage.snapshot().conversation.filter(isToolExecution)[0]?.outcome,
  ).toMatchObject({ status: "completed", result: { sources } });
});
