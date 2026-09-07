import type { AgentToolResult } from "../domain/source-citation.js";
import {
  isToolExecution,
  persistedToolResultSchema,
  toolExecutionSchema,
  type ToolCall,
  type ToolExecutionOrigin,
} from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";

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
    const serialized: unknown = JSON.parse(JSON.stringify(result));
    const persisted = persistedToolResultSchema.parse(serialized);
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
