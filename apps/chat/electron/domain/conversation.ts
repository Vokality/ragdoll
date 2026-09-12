import { sourceCitationSchema } from "../electron-api.js";
import {
  CONVERSATION_EVENT_TYPE_PATTERN,
  REQUIRED_TOOL_NAME_PATTERN,
} from "@vokality/ragdoll-extensions";
import { z } from "zod";

export const conversationMessageSchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .default(() => globalThis.crypto.randomUUID()),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  phase: z.enum(["commentary", "final_answer"]).nullable().optional(),
  sources: z.array(sourceCitationSchema).optional(),
});

export const conversationEventInputSchema = z.strictObject({
  type: z.string().min(1).max(100).regex(CONVERSATION_EVENT_TYPE_PATTERN),
  payload: z.record(z.string(), z.json()),
  turnPolicy: z.enum(["record-only", "start-turn"]),
  requiredToolName: z
    .string()
    .min(1)
    .max(100)
    .regex(REQUIRED_TOOL_NAME_PATTERN)
    .optional(),
  deduplicationKey: z.string().min(1).max(200).optional(),
});

export const extensionConversationEventSchema = z.strictObject({
  kind: z.literal("extension-event"),
  id: z.string().min(1),
  extensionId: z.string().min(1),
  type: conversationEventInputSchema.shape.type,
  payload: conversationEventInputSchema.shape.payload,
  turnPolicy: conversationEventInputSchema.shape.turnPolicy,
  requiredToolName: conversationEventInputSchema.shape.requiredToolName,
  deduplicationKey: conversationEventInputSchema.shape.deduplicationKey,
  occurredAt: z.number().int().nonnegative(),
});

export const appConversationEventSchema = extensionConversationEventSchema
  .omit({ extensionId: true, requiredToolName: true })
  .extend({
    kind: z.literal("app-event"),
    type: z.enum(["app.onboarding", "app.focused"]),
  });
export type AppConversationEvent = z.infer<typeof appConversationEventSchema>;
export type AgentConversationEvent =
  ExtensionConversationEvent | AppConversationEvent;
export function isAgentConversationEvent(
  entry: ConversationEntry,
): entry is AgentConversationEvent {
  return (
    "kind" in entry &&
    (entry.kind === "extension-event" || entry.kind === "app-event")
  );
}

export const toolCallSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});

export const persistedToolResultSchema = z.strictObject({
  success: z.boolean(),
  sources: z.array(sourceCitationSchema).optional(),
  data: z.json().optional(),
  error: z.string().optional(),
  retryable: z.boolean().optional(),
});

export const toolExecutionOriginSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("user") }),
  z.strictObject({ type: z.literal("event"), eventId: z.string().min(1) }),
]);

export const toolExecutionSchema = z.strictObject({
  kind: z.literal("tool-execution"),
  id: z.string().min(1),
  call: toolCallSchema,
  origin: toolExecutionOriginSchema,
  startedAt: z.number().int().nonnegative(),
  outcome: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("started") }),
    z.strictObject({
      status: z.literal("completed"),
      completedAt: z.number().int().nonnegative(),
      result: persistedToolResultSchema,
    }),
  ]),
});

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolExecution = z.infer<typeof toolExecutionSchema>;
export type ToolExecutionOrigin = z.infer<typeof toolExecutionOriginSchema>;

export const conversationEntrySchema = z.union([
  conversationMessageSchema,
  extensionConversationEventSchema,
  appConversationEventSchema,
  toolExecutionSchema,
]);

export const pendingAgentTurnSchema = z.strictObject({
  triggerEventId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;
export type ExtensionConversationEvent = z.infer<
  typeof extensionConversationEventSchema
>;
export type PendingAgentTurn = z.infer<typeof pendingAgentTurnSchema>;

export type EventTurnOutcome =
  | { disposition: "silent" }
  | {
      disposition: "respond";
      content: string;
      sources?: z.infer<typeof sourceCitationSchema>[];
    };

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

export function isToolExecution(
  entry: ConversationEntry,
): entry is ToolExecution {
  return "kind" in entry && entry.kind === "tool-execution";
}
