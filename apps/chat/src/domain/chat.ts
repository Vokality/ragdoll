export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Append a new message to the existing conversation history.
 */
export function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...messages, message];
}

/**
 * Compute the subset of messages that should be visible in the UI.
 * Includes the current streaming assistant response if provided.
 */
export function getVisibleMessages(
  messages: ChatMessage[],
  streamingContent?: string | null,
  limit = 2
): ChatMessage[] {
  const history = streamingContent
    ? [...messages, { role: "assistant" as const, content: streamingContent }]
    : messages;
  return history.slice(-limit);
}
