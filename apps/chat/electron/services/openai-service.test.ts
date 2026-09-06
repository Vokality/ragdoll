import { describe, expect, it } from "bun:test";
import type { ToolDefinition, ToolResult } from "@vokality/ragdoll-extensions";
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
  results: ToolResult[],
): {
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
    runner: new OpenAIAgentRunner(tools, config, sessions),
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

    await expect(runner.runUserTurn("key", [], () => undefined)).resolves.toBe(
      "I moved to the center.",
    );
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
    expect(await runner.runUserTurn("key", [], () => undefined)).toBe("Done.");
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
    ).toBe("Checking.\n\nDone.");
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
  const runner = new OpenAIAgentRunner(tools, config, {
    create: () => session,
  });
  await expect(
    runner.runUserTurn("key", [], () => {}, abort.signal),
  ).rejects.toThrow();
  expect(executed).toEqual(["first"]);
  expect(session.messages).toHaveLength(1);
});
