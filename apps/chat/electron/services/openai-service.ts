import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ExtensionManager } from "./extension-manager.js";
import type { ToolParameterSchema } from "@vokality/ragdoll-extensions";

export interface ChatCompletionConfig {
  model: string;
  maxCompletionTokens: number;
  maxToolRounds: number;
  systemPrompt: string;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

function toOpenAITools(
  extensionManager: ExtensionManager,
): ChatCompletionTool[] {
  return extensionManager.getTools().map((tool) => ({
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: toOpenAIParameters(tool.function.parameters),
    },
  }));
}

function toOpenAIParameters(
  schema: ToolParameterSchema,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, copySchemaValue(value)]),
  );
}

function copySchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copySchemaValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        copySchemaValue(nested),
      ]),
    );
  }
  return value;
}

function parseArguments(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function executeToolCall(
  extensionManager: ExtensionManager,
  call: PendingToolCall,
): Promise<string> {
  const args = parseArguments(call.arguments);
  const result = await extensionManager.executeTool(call.name, args);
  return JSON.stringify({ args, result });
}

export async function sendChatMessage(
  apiKey: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  extensionManager: ExtensionManager,
  config: ChatCompletionConfig,
  onStreamingText: (text: string) => void,
  onStreamEnd: () => void,
): Promise<void> {
  const openai = new OpenAI({ apiKey });
  const tools = toOpenAITools(extensionManager);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: config.systemPrompt },
    ...conversationHistory,
  ];

  for (let round = 0; round <= config.maxToolRounds; round += 1) {
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
      stream: true,
      max_completion_tokens: config.maxCompletionTokens,
    });
    const toolCalls = new Map<number, PendingToolCall>();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (choice?.delta.content) onStreamingText(choice.delta.content);

      for (const delta of choice?.delta.tool_calls ?? []) {
        const existing = toolCalls.get(delta.index);
        const id = delta.id ?? existing?.id;
        const name = `${existing?.name ?? ""}${delta.function?.name ?? ""}`;
        const arguments_ = `${existing?.arguments ?? ""}${delta.function?.arguments ?? ""}`;
        if (!id) throw new Error(`Tool call ${delta.index} is missing an id`);
        toolCalls.set(delta.index, { id, name, arguments: arguments_ });
      }

      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }

    if (toolCalls.size === 0) {
      if (finishReason === "tool_calls") {
        throw new Error("The model ended with an empty tool call");
      }
      onStreamEnd();
      return;
    }
    if (finishReason !== "tool_calls") {
      throw new Error(
        `Unexpected finish reason for tool calls: ${finishReason}`,
      );
    }
    if (round === config.maxToolRounds) {
      throw new Error(`Tool execution exceeded ${config.maxToolRounds} rounds`);
    }

    const calls = [...toolCalls.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, call]) => call);
    for (const call of calls) {
      if (!call.name)
        throw new Error(`Tool call '${call.id}' is missing a name`);
    }

    messages.push({
      role: "assistant",
      tool_calls: calls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });
    const results = await Promise.all(
      calls.map((call) => executeToolCall(extensionManager, call)),
    );
    messages.push(
      ...calls.map((call, index): ChatCompletionMessageParam => ({
        role: "tool",
        tool_call_id: call.id,
        content: results[index]!,
      })),
    );
  }
}
