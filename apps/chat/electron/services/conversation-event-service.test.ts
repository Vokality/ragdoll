import { describe, expect, it } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ConversationEventService } from "./conversation-event-service.js";

describe("ConversationEventService", () => {
  it("records an internal event without scheduling a turn", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage);
    let queued = 0;
    service.onTurnQueued(() => {
      queued += 1;
    });

    await service.publish("calendar", {
      type: "calendar.synchronized",
      payload: { changed: 3 },
      turnPolicy: "record-only",
    });

    expect(storage.snapshot().conversation).toHaveLength(1);
    expect(storage.snapshot().pendingAgentTurns).toBeUndefined();
    expect(queued).toBe(0);
  });

  it("commits a start-turn event and its job before notifying listeners", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage);
    let persistedJobCount = 0;
    service.onTurnQueued(() => {
      persistedJobCount = storage.snapshot().pendingAgentTurns?.length ?? 0;
    });

    const published = await service.publish("pomodoro", {
      type: "timer.completed",
      payload: { completedPhase: "focus" },
      turnPolicy: "start-turn",
      deduplicationKey: "focus:1",
    });

    const snapshot = storage.snapshot();
    expect(snapshot.conversation?.[0]).toMatchObject({
      kind: "extension-event",
      id: published.eventId,
      extensionId: "pomodoro",
      type: "timer.completed",
      turnPolicy: "start-turn",
    });
    expect(snapshot.pendingAgentTurns).toEqual([
      { triggerEventId: published.eventId, createdAt: expect.any(Number) },
    ]);
    expect(persistedJobCount).toBe(1);
  });

  it("deduplicates events within their source extension", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage);
    const event = {
      type: "timer.completed",
      payload: { completedPhase: "break" },
      turnPolicy: "start-turn" as const,
      deduplicationKey: "break:1",
    };

    const first = await service.publish("pomodoro", event);
    const duplicate = await service.publish("pomodoro", event);

    expect(duplicate).toEqual(first);
    expect(storage.snapshot().conversation).toHaveLength(1);
    expect(storage.snapshot().pendingAgentTurns).toHaveLength(1);
  });
});
