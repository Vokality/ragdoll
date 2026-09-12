import type { ChatMessageDto } from "../../electron/electron-api";
export type ChatMessage = ChatMessageDto;
export type ChatRole = ChatMessage["role"];

/**
 * Compute the subset of messages that should be visible in the UI.
 * Includes the current streaming assistant response if provided.
 */
export function getVisibleMessages(
  messages: ChatMessage[],
  streamingMessage?: ChatMessage | null,
  limit = 2,
): ChatMessage[] {
  const history = streamingMessage ? [...messages, streamingMessage] : messages;
  return history.slice(-limit);
}
