import type { AgentModelConfig } from "./agent-service.js";
import { expect, it } from "bun:test";
import type {
  Response,
  ResponseOutputMessage,
  ResponseStreamEvent,
  ResponseCreateParamsStreaming,
} from "openai/resources/responses/responses";
import { ResponsesSession } from "./responses-session.js";
import type { AgentResponse } from "../electron-api.js";

const config: AgentModelConfig = {
  model: "gpt-5.6-sol",
  reasoningEffort: "low",
  maxOutputTokens: 2048,
  maxToolRounds: 5,
  systemPrompt: "Acknowledge, work, then answer.",
};
function message(
  id: string,
  phase: "commentary" | "final_answer",
  text: string,
): ResponseOutputMessage {
  return {
    type: "message",
    id,
    role: "assistant",
    status: "completed",
    phase,
    content: [{ type: "output_text", text, annotations: [] }],
  };
}
function response(output: Response["output"] = []): Response {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    model: config.model,
    output,
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: config.systemPrompt,
    metadata: {},
    parallel_tool_calls: true,
    temperature: null,
    top_p: null,
    tool_choice: "auto",
    tools: [],
  };
}
function delta(itemId: string, text: string): ResponseStreamEvent {
  return {
    type: "response.output_text.delta",
    item_id: itemId,
    output_index: 0,
    content_index: 0,
    sequence_number: 1,
    delta: text,
    logprobs: [],
  };
}

it("streams and awaits separate message persistence, preserves phases and completed encrypted reasoning", async () => {
  const first = message("ack", "commentary", "I'll check.");
  const final = message("answer", "final_answer", "Done.");
  const output: Extract<
    Response["output"][number],
    { type: "message" | "function_call" | "reasoning" }
  >[] = [
    {
      type: "reasoning",
      id: "reasoning",
      summary: [],
      encrypted_content: "complete reasoning",
    },
    first,
    final,
  ];
  const requests: ResponseCreateParamsStreaming[] = [];
  const order: string[] = [];
  const messages: AgentResponse[] = [];
  const abort = new AbortController();
  const session = new ResponsesSession(config, {
    stream: async (params, signal) => {
      requests.push(params);
      if (requests.length > 1)
        return (async function* (): AsyncGenerator<ResponseStreamEvent> {
          yield {
            type: "response.completed",
            response: response([]),
            sequence_number: 1,
          };
        })();
      expect(signal).toBe(abort.signal);
      return (async function* (): AsyncGenerator<ResponseStreamEvent> {
        yield delta(first.id, "I'll check.");
        yield {
          type: "response.output_item.done",
          item: first,
          output_index: 1,
          sequence_number: 2,
        };
        expect(order).toEqual(["I'll check.", "saved:commentary"]);
        yield delta(final.id, "Done.");
        yield {
          type: "response.output_item.done",
          item: final,
          output_index: 2,
          sequence_number: 3,
        };
        yield {
          type: "response.completed",
          response: response(output),
          sequence_number: 4,
        };
      })();
    },
  });
  const result = await session.respond({
    input: [{ role: "user", content: "Check" }],
    tools: [],
    toolChoice: "auto",
    signal: abort.signal,
    events: {
      onText: (text) => order.push(text),
      onMessage: async (value) => {
        await Promise.resolve();
        messages.push(value);
        order.push(`saved:${value.phase}`);
      },
    },
  });
  expect(result.output).toEqual([
    {
      type: "message",
      role: "assistant",
      content: "I'll check.",
      phase: "commentary",
    },
    {
      type: "message",
      role: "assistant",
      content: "Done.",
      phase: "final_answer",
    },
  ]);
  expect(messages).toEqual([
    { content: "I'll check.", phase: "commentary" },
    { content: "Done.", phase: "final_answer" },
  ]);
  await session.respond({
    input: [{ role: "developer", content: "Continue" }],
    tools: [],
    toolChoice: "none",
  });
  expect(requests[1]?.input).toEqual([
    { role: "user", content: "Check" },
    ...output,
    { role: "developer", content: "Continue" },
  ]);
  expect(requests[0]).toMatchObject({
    store: false,
    stream: true,
    model: config.model,
    instructions: config.systemPrompt,
    reasoning: { effort: "low" },
    max_output_tokens: 2048,
    include: ["reasoning.encrypted_content"],
  });
});

it("rejects incomplete, failed, and disconnected streams without inventing a completed message", async () => {
  const cases: ResponseStreamEvent[][] = [
    [
      delta("partial", "Partial"),
      {
        type: "response.incomplete",
        response: {
          ...response(),
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        },
        sequence_number: 2,
      },
    ],
    [
      {
        type: "response.failed",
        response: {
          ...response(),
          status: "failed",
          error: { code: "server_error", message: "Failure" },
        },
        sequence_number: 1,
      },
    ],
    [delta("partial", "Partial")],
  ];
  for (const events of cases) {
    const messages: AgentResponse[] = [];
    const session = new ResponsesSession(config, {
      stream: async () =>
        (async function* () {
          yield* events;
        })(),
    });
    await expect(
      session.respond({
        input: [],
        tools: [],
        toolChoice: "auto",
        events: {
          onText: () => {},
          onMessage: async (message) => {
            messages.push(message);
          },
        },
      }),
    ).rejects.toThrow();
    expect(messages).toEqual([]);
  }
});

it("cancels before processing another streamed item", async () => {
  const abort = new AbortController();
  const messages: AgentResponse[] = [];
  const session = new ResponsesSession(config, {
    stream: async () =>
      (async function* (): AsyncGenerator<ResponseStreamEvent> {
        yield delta("partial", "Partial");
        yield {
          type: "response.output_item.done",
          item: message("partial", "final_answer", "Partial"),
          output_index: 0,
          sequence_number: 2,
        };
      })(),
  });
  await expect(
    session.respond({
      input: [],
      tools: [],
      toolChoice: "auto",
      signal: abort.signal,
      events: {
        onText: () => abort.abort(),
        onMessage: async (message) => {
          messages.push(message);
        },
      },
    }),
  ).rejects.toThrow();
  expect(messages).toEqual([]);
});
