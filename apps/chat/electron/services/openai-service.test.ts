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
