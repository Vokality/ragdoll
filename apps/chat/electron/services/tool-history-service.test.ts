import { expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStorageRepository,
  storageSchema,
} from "../infrastructure/storage-repository.js";
import {
  isToolExecution,
  projectVisibleConversation,
} from "../domain/conversation.js";
import { ToolHistoryService } from "./tool-history-service.js";

it("persists execution lifecycle across repository instances without exposing it in chat", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lumen-tool-history-"));
  try {
    const storage = createStorageRepository(directory);
    await storage.update((draft) => {
      draft.conversation.push({
        id: "user-message",
        role: "user",
        content: "Draw a sun",
      });
    });
    const history = new ToolHistoryService(storage);
    const first = await history.start(
      { id: "call-1", name: "canvas_draw", arguments: '{"elements":[]}' },
      { type: "user" },
    );
    const pending = (
      await createStorageRepository(directory).read()
    ).conversation.filter(isToolExecution);
    expect(pending[0]?.outcome).toEqual({ status: "started" });
    await history.complete(first, {
      success: true,
      data: { revision: 3, elementIds: ["sun"] },
    });
    const second = await history.start(
      { id: "call-1", name: "canvas_get", arguments: "{}" },
      { type: "event", eventId: "event-1" },
    );
    expect(first).not.toBe(second);
    const restored = await createStorageRepository(directory).read();
    expect(
      restored.conversation.filter(isToolExecution)[0]?.outcome,
    ).toMatchObject({
      status: "completed",
      result: { success: true, data: { revision: 3 } },
    });
    expect(projectVisibleConversation(restored.conversation)).toEqual([
      { id: "user-message", role: "user", content: "Draw a sun" },
    ]);
    await expect(history.complete(first, { success: false })).rejects.toThrow(
      "already completed",
    );
    await expect(
      history.complete("missing", { success: true }),
    ).rejects.toThrow("Missing tool execution");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("accepts existing conversations and rejects malformed execution records", () => {
  expect(
    storageSchema.parse({
      conversation: [{ role: "assistant", content: "Hello" }],
    }).conversation,
  ).toHaveLength(1);
  expect(
    storageSchema.safeParse({
      conversation: [{ kind: "tool-execution", id: "missing-fields" }],
    }).success,
  ).toBe(false);
});

it("records a handler result that carries unexpected fields instead of stranding it as started", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lumen-tool-history-"));
  try {
    const storage = createStorageRepository(directory);
    const history = new ToolHistoryService(storage);
    const outcomes = async () =>
      (await storage.read()).conversation
        .filter(isToolExecution)
        .map((entry) => entry.outcome);

    const extra = await history.start(
      { id: "call-1", name: "third_party_add", arguments: "{}" },
      { type: "user" },
    );
    await history.complete(extra, {
      success: true,
      message: "added",
    } as unknown as Parameters<ToolHistoryService["complete"]>[1]);
    const malformed = await history.start(
      { id: "call-2", name: "third_party_add", arguments: "{}" },
      { type: "user" },
    );
    await history.complete(malformed, {
      success: true,
      error: null,
    } as unknown as Parameters<ToolHistoryService["complete"]>[1]);

    expect(await outcomes()).toMatchObject([
      { status: "completed", result: { success: true } },
      { status: "completed", result: { success: false, retryable: false } },
    ]);
    expect((await outcomes())[0]).not.toHaveProperty("result.message");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
