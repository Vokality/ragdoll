import { z } from "zod";
import type { AgentResponse } from "../electron-api.js";
import type {
  ResponseCreateParamsStreaming,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type {
  AgentModelConfig,
  AgentResponseRequest,
  AgentResponseSession,
  ResponseRound,
  AgentResponseOutput,
} from "./agent-service.js";

const messageSchema = z.object({
  type: z.literal("message"),
  role: z.literal("assistant"),
  content: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("output_text"), text: z.string() }),
      z.object({ type: z.literal("refusal"), refusal: z.string() }),
    ]),
  ),
  phase: z.enum(["commentary", "final_answer"]).nullish(),
});
const toolCallSchema = z.object({
  type: z.literal("function_call"),
  call_id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});

function readMessage(value: unknown): AgentResponse {
  const message = messageSchema.parse(value);
  return {
    content: message.content
      .map((part) => (part.type === "output_text" ? part.text : part.refusal))
      .join(""),
    ...(message.phase === undefined ? {} : { phase: message.phase }),
  };
}

export interface ResponseTransport {
  stream(
    params: ResponseCreateParamsStreaming,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<ResponseStreamEvent>>;
}

export class ResponsesSession implements AgentResponseSession {
  private readonly input: ResponseInputItem[] = [];
  constructor(
    private readonly config: AgentModelConfig,
    private readonly transport: ResponseTransport,
    private readonly messagePhases = true,
  ) {}

  async respond(request: AgentResponseRequest): Promise<ResponseRound> {
    request.signal?.throwIfAborted();
    this.input.push(
      ...request.input.map((item) => {
        if (
          this.messagePhases ||
          item.type === "function_call" ||
          item.type === "function_call_output"
        )
          return item;
        const { phase: _phase, ...message } = item;
        return message;
      }),
    );
    const stream = await this.transport.stream(
      {
        model: this.config.model,
        reasoning: { effort: this.config.reasoningEffort },
        instructions: this.config.systemPrompt,
        input: [...this.input],
        tools: request.tools,
        tool_choice: request.toolChoice,
        stream: true,
        store: false,
        include: ["reasoning.encrypted_content"],
        max_output_tokens: this.config.maxOutputTokens,
      },
      request.signal,
    );
    let completed: ResponseOutputItem[] | undefined;
    for await (const event of stream) {
      request.signal?.throwIfAborted();
      if (event.type === "response.output_text.delta")
        request.events?.onText(z.string().parse(event.delta));
      if (event.type === "response.refusal.delta")
        request.events?.onText(z.string().parse(event.delta));
      if (
        event.type === "response.output_item.done" &&
        event.item.type === "message" &&
        event.item.status === "completed"
      ) {
        const message = readMessage(event.item);
        if (message.content.trim()) await request.events?.onMessage(message);
      }
      if (event.type === "response.completed")
        completed = event.response.output;
      if (event.type === "response.incomplete")
        throw new Error(
          `The model response was truncated before it finished: ${event.response.incomplete_details?.reason ?? "incomplete"}`,
        );
      if (event.type === "response.failed")
        throw new Error(
          event.response.error?.message ?? "The model response failed",
        );
      if (event.type === "error") throw new Error(event.message);
    }
    if (!completed)
      throw new Error("The model response stream ended before completion");
    for (const item of completed) {
      if (
        item.type !== "message" &&
        item.type !== "function_call" &&
        item.type !== "reasoning"
      )
        throw new Error(`Unsupported response output item: ${item.type}`);
      this.input.push(item);
    }
    return {
      output: completed.flatMap((item): AgentResponseOutput[] => {
        if (item.type === "reasoning") return [];
        if (item.type === "function_call") return [toolCallSchema.parse(item)];
        if (item.type === "message")
          return [{ type: "message", role: "assistant", ...readMessage(item) }];
        throw new Error(`Unsupported response output item: ${item.type}`);
      }),
    };
  }
}
