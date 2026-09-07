import OpenAI from "openai";
import type {
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type {
  AgentModelConfig,
  AgentResponseRequest,
  AgentResponseSession,
  AgentResponseSessionFactory,
  ResponseRound,
  AgentResponseOutput,
} from "./openai-service.js";

export interface ResponseTransport {
  stream(
    params: ResponseCreateParamsStreaming,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<ResponseStreamEvent>>;
}

export class OpenAIResponseSession implements AgentResponseSession {
  constructor(
    private readonly config: AgentModelConfig,
    private readonly transport: ResponseTransport,
  ) {}

  async respond(request: AgentResponseRequest): Promise<ResponseRound> {
    const stream = await this.transport.stream(
      {
        model: this.config.model,
        reasoning: { effort: this.config.reasoningEffort },
        instructions: this.config.systemPrompt,
        input: request.input,
        tools: request.tools,
        tool_choice: request.toolChoice,
        stream: true,
        store: false,
        include: ["reasoning.encrypted_content"],
        max_output_tokens: this.config.maxOutputTokens,
      },
      request.signal,
    );
    let completed: ResponseRound | undefined;
    for await (const event of stream) {
      request.signal?.throwIfAborted();
      if (event.type === "response.output_text.delta")
        request.events?.onText(event.delta);
      if (event.type === "response.refusal.delta")
        request.events?.onText(event.delta);
      if (
        event.type === "response.output_item.done" &&
        event.item.type === "message" &&
        event.item.status === "completed"
      ) {
        const content = event.item.content
          .map((part) =>
            part.type === "output_text" ? part.text : part.refusal,
          )
          .join("");
        if (content.trim())
          await request.events?.onMessage({
            content,
            ...(event.item.phase === undefined
              ? {}
              : { phase: event.item.phase }),
          });
      }
      if (event.type === "response.completed")
        completed = {
          output: event.response.output.map((item): AgentResponseOutput => {
            if (
              item.type === "message" ||
              item.type === "function_call" ||
              item.type === "reasoning"
            )
              return item;
            throw new Error(`Unsupported response output item: ${item.type}`);
          }),
        };
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
    return completed;
  }
}

export function createOpenAIResponseSessionFactory(): AgentResponseSessionFactory {
  return {
    create: (apiKey, config) => {
      const client = new OpenAI({ apiKey });
      return new OpenAIResponseSession(config, {
        stream: (params, signal) => client.responses.create(params, { signal }),
      });
    },
  };
}
