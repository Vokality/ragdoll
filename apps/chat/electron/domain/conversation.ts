import { z } from "zod";

export const conversationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })
  .strict();

export const conversationEventInputSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/),
    payload: z.record(z.string(), z.json()),
    turnPolicy: z.enum(["record-only", "start-turn"]),
    deduplicationKey: z.string().min(1).max(200).optional(),
  })
  .strict();

export const extensionConversationEventSchema = z
  .object({
    kind: z.literal("extension-event"),
    id: z.string().min(1),
    extensionId: z.string().min(1),
    type: conversationEventInputSchema.shape.type,
    payload: conversationEventInputSchema.shape.payload,
    turnPolicy: conversationEventInputSchema.shape.turnPolicy,
    deduplicationKey: conversationEventInputSchema.shape.deduplicationKey,
    occurredAt: z.number().int().nonnegative(),
  })
  .strict();

export const conversationEntrySchema = z.union([
  conversationMessageSchema,
  extensionConversationEventSchema,
]);

export const pendingAgentTurnSchema = z
  .object({
    triggerEventId: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;
export type ExtensionConversationEvent = z.infer<
  typeof extensionConversationEventSchema
>;
export type PendingAgentTurn = z.infer<typeof pendingAgentTurnSchema>;

export type EventTurnOutcome =
  { disposition: "silent" } | { disposition: "respond"; content: string };

export function isConversationMessage(
  entry: ConversationEntry,
): entry is ConversationMessage {
  return "role" in entry;
}

export function isExtensionConversationEvent(
  entry: ConversationEntry,
): entry is ExtensionConversationEvent {
  return "kind" in entry && entry.kind === "extension-event";
}

export function projectVisibleConversation(
  entries: readonly ConversationEntry[],
): ConversationMessage[] {
  return entries.filter(isConversationMessage);
}
