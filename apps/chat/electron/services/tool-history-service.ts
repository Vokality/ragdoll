import type { AgentToolResult } from "../domain/source-citation.js";
import {
  isToolExecution,
  persistedToolResultSchema,
  toolExecutionSchema,
  type ToolCall,
  type ToolExecutionOrigin,
} from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import { z } from "zod";

// Same fields as the strict storage schema, but unknown keys are stripped.
const lenientToolResultSchema = z.object(persistedToolResultSchema.shape);

export interface AgentToolHistory {
  start(call: ToolCall, origin: ToolExecutionOrigin): Promise<string>;
  complete(executionId: string, result: AgentToolResult): Promise<void>;
}

/** Durable execution history shared by user turns and extension-event turns. */
export class ToolHistoryService implements AgentToolHistory {
  constructor(private readonly storage: StorageRepository) {}

  async start(call: ToolCall, origin: ToolExecutionOrigin): Promise<string> {
    const entry = toolExecutionSchema.parse({
      kind: "tool-execution",
      id: globalThis.crypto.randomUUID(),
      call,
      origin,
      startedAt: Date.now(),
      outcome: { status: "started" },
    });
    await this.storage.update((draft) => {
      draft.conversation.push(entry);
    });
    return entry.id;
  }

  async complete(executionId: string, result: AgentToolResult): Promise<void> {
    // Use the same JSON boundary as the model transport, then validate it.
    // eslint-disable-next-line react-doctor/no-json-parse-stringify-clone -- Serialization intentionally applies toJSON and omits non-JSON fields before persistence.
    const serialized: unknown = JSON.parse(JSON.stringify(result));
    // The tool already ran, so a handler's stray keys must not fail the turn
    // and strand this record as started. Keep only the persisted fields.
    const parsed = lenientToolResultSchema.safeParse(serialized);
    const persisted = parsed.success
      ? parsed.data
      : {
          success: false,
          error: "The tool returned a result Lumen could not record.",
          retryable: false,
        };
    await this.storage.update((draft) => {
      const entry = draft.conversation.find(
        (candidate) =>
          isToolExecution(candidate) && candidate.id === executionId,
      );
      if (!entry || !isToolExecution(entry))
        throw new Error(`Missing tool execution: ${executionId}`);
      if (entry.outcome.status !== "started")
        throw new Error(`Tool execution already completed: ${executionId}`);
      entry.outcome = {
        status: "completed",
        completedAt: Date.now(),
        result: persisted,
      };
    });
  }
}
