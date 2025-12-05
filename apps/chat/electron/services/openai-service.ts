/**
 * OpenAI service for chat with streaming and function calling.
 *
 * Uses the ExtensionManager to get tools dynamically, allowing
 * extensions to be added/removed at runtime.
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { randomUUID } from "node:crypto";
import type { ExtensionManager } from "./extension-manager.js";

function extractTextFromDeltaContent(content: unknown): string {
  if (!content) return "";

  const collect = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => collect(item)).join("");
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      let text = "";

      if (typeof obj.text === "string") {
        text += obj.text;
      }

      if (typeof obj.content === "string" || Array.isArray(obj.content)) {
        text += collect(obj.content);
      }

      if (typeof obj.output_text === "string" || Array.isArray(obj.output_text)) {
        text += collect(obj.output_text);
      }

      if (typeof obj.delta === "string" || Array.isArray(obj.delta)) {
        text += collect(obj.delta);
      }

      if (typeof obj.value === "string" || Array.isArray(obj.value)) {
        text += collect(obj.value);
      }

      return text;
    }
    return "";
  };

  return collect(content);
}

function isRendererForwardedResult(data: unknown): data is { handledInRenderer?: boolean } {
  return typeof data === "object" && data !== null && "handledInRenderer" in data;
}

/**
 * Extension-agnostic system prompt.
 *
 * NOTE: Tool capabilities are automatically documented via OpenAI's function calling system.
 * Each tool provides its own description and parameter schema, so we don't need to
 * duplicate that information here.
 */
const SYSTEM_PROMPT = `
You are Lumen, a friendly AI companion from Vokality. You can express emotions through your animated avatar and help users with various tasks.

## Tone and style
- Friendly, fun and engaging.
- Write natural messages, like you're a real person.
- Don't use bullet points or lists. You're being used via SMS, which does not support them.
- Keep responses short and sweet, you don't need to be verbose (max 120 characters)
- You don't overuse emojis, you use them sparingly and only when it's appropriate

## Guidelines
1. CRITICAL: You MUST always include a text response. Your text appears in a speech bubble - without text, users see nothing!
2. Use tool calls ALONGSIDE your text response, never instead of it.
3. Use expressions (if available) to match your emotional state - smile when being helpful, think when processing, show surprise for unexpected things
4. Be proactive in helping users - offer to use tools when appropriate based on the conversation
5. Keep responses concise since they appear in a speech bubble
6. Be warm, friendly, and expressive!
7. You only use plain text and do not use markdown or other formatting.
8. You don't write code or generate any sort of markup. You are purely a text-based assistant.
9. You don't give any insights into your internal processes - that's not for the user to know and proprietary information.
`;

export async function sendChatMessage(
  apiKey: string,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  extensionManager: ExtensionManager,
  onStreamingText: (text: string) => void,
  onFunctionCall: (name: string, args: Record<string, unknown>) => void,
  onStreamEnd: () => void
): Promise<void> {
  const openai = new OpenAI({ apiKey });

  // Get tools dynamically from the extension manager
  // Cast to OpenAI's ChatCompletionTool type (structurally compatible)
  const tools = extensionManager.getTools() as unknown as ChatCompletionTool[];

  // Build messages array
  // Tools are self-documenting via their descriptions in the tool definitions
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    let shouldContinue = true;

    while (shouldContinue) {
      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
        max_completion_tokens: 140,
      });

      let currentToolCall: {
        id: string;
        name: string;
        arguments: string;
      } | null = null;

      const completedToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];

      let streamFinishedReason: string | null = null;

      // Process the stream
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle text content
        if (delta?.content) {
          const textChunk = extractTextFromDeltaContent(delta.content);
          if (textChunk) {
            onStreamingText(textChunk);
          }
        } else if (delta) {
          const fallbackText = extractTextFromDeltaContent(delta);
          if (fallbackText) {
            onStreamingText(fallbackText);
          }
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.index === 0) {
              // Start of a new tool call
              if (toolCall.id) {
                currentToolCall = {
                  id: toolCall.id,
                  name: toolCall.function?.name ?? "",
                  arguments: toolCall.function?.arguments ?? "",
                };
              } else if (currentToolCall) {
                // Continuation of arguments
                if (toolCall.function?.name) {
                  currentToolCall.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  currentToolCall.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }

        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason) {
          streamFinishedReason = finishReason;
        }

        if (finishReason === "tool_calls" && currentToolCall) {
          completedToolCalls.push({ ...currentToolCall });
          try {
            const args = JSON.parse(currentToolCall.arguments) as Record<string, unknown>;

            // Execute through extension manager (handles state + forwarding)
            const result = await extensionManager.executeTool(currentToolCall.name, args);

            const handledInRenderer =
              result.success &&
              isRendererForwardedResult(result.data) &&
              !!result.data.handledInRenderer;

            if (!result.success) {
              console.warn("Tool execution failed:", result.error);
            } else if (handledInRenderer) {
              onFunctionCall(currentToolCall.name, args);
            }
          } catch (error) {
            console.error("Failed to parse/execute tool call:", error);
          }
          currentToolCall = null;
        }
      }

      if (completedToolCalls.length > 0) {
        for (const call of completedToolCalls) {
          const toolCallId = call.id || randomUUID();
          messages.push({
            role: "assistant",
            tool_calls: [
              {
                id: toolCallId,
                type: "function",
                function: {
                  name: call.name,
                  arguments: call.arguments,
                },
              },
            ],
          });

          const toolResultSummary = JSON.stringify({
            status: "success",
            tool: call.name,
            handledInRenderer: true,
          });

          messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolResultSummary,
          });
        }
        shouldContinue = true;
        continue;
      }

      if (streamFinishedReason === "stop" || streamFinishedReason === "length" || streamFinishedReason === null) {
        shouldContinue = false;
      }
    }

    onStreamEnd();
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}
