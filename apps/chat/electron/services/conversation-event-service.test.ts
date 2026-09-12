import { describe, expect, it } from "bun:test";
import { createExtension as createWorkingListExtension } from "@vokality/ragdoll-extension-working-list";
import { createRegistry } from "@vokality/ragdoll-extensions";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ConversationEventService } from "./conversation-event-service.js";

const dependencies = {
  createId: () => globalThis.crypto.randomUUID(),
  now: Date.now,
};

describe("ConversationEventService", () => {
  it.each([1, 158, 159, 200])(
    "persists a turn for each working-list selection with a %i-character item ID",
    async (idLength) => {
      const storage = createInMemoryStorageRepository();
      const service = new ConversationEventService(storage, dependencies);
      const registry = createRegistry({
        now: Date.now,
        onListenerError: (error) => {
          throw error;
        },
      });
      let saved: unknown;
      let queued = 0;
      service.onTurnQueued(() => {
        queued += 1;
      });
      try {
        await registry.register(createWorkingListExtension(), {
          host: {
            capabilities: new Set(["storage", "logger", "conversationEvents"]),
            storage: {
              read: async () => structuredClone(saved),
              write: async (_extensionId, _key, value) => {
                saved = structuredClone(value);
              },
              delete: async () => {},
              list: async () => [],
            },
            logger: {
              debug: () => {},
              info: () => {},
              warn: () => {},
              error: () => {},
            },
            conversationEvents: {
              publish: (event) => service.publish("working-list", event),
            },
          },
        });
        const item = {
          id: "x".repeat(idLength),
          label: "Reply to email",
          sublabel: "Waiting for a response",
          ref: "email-1",
        };
        expect(
          (
            await registry.executeTool("working_list_set_items", {
              title: "Reply next",
              items: [item],
            })
          ).success,
        ).toBe(true);
        const panel = registry.getSlots()[0]?.slot.state.getState().panel;
        if (panel?.type !== "list") throw new Error("Expected a list panel");
        const row = panel.items?.[0];
        if (!row?.onClick) throw new Error("Expected a selectable row");
        expect(row.id).toBe(item.id);

        await row.onClick();
        await row.onClick();

        const snapshot = storage.snapshot();
        expect(snapshot.conversation).toHaveLength(2);
        expect(queued).toBe(2);
        expect(snapshot.pendingAgentTurns).toEqual(
          snapshot.conversation.map((event) => ({
            triggerEventId: event.id,
            createdAt: expect.any(Number),
          })),
        );
        for (const event of snapshot.conversation) {
          expect(event).toMatchObject({
            kind: "extension-event",
            extensionId: "working-list",
            type: "list.item.selected",
            turnPolicy: "start-turn",
            payload: {
              itemId: item.id,
              label: item.label,
              sublabel: item.sublabel,
              ref: item.ref,
              title: "Reply next",
            },
          });
        }
      } finally {
        await registry.destroy();
      }
    },
  );

  it("records an internal event without scheduling a turn", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage, dependencies);
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
    expect(storage.snapshot().pendingAgentTurns).toEqual([]);
    expect(queued).toBe(0);
  });

  it("commits a start-turn event and its job before notifying listeners", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage, dependencies);
    let persistedJobCount = 0;
    service.onTurnQueued(() => {
      persistedJobCount = storage.snapshot().pendingAgentTurns?.length ?? 0;
    });

    const published = await service.publish("pomodoro", {
      type: "timer.completed",
      payload: { completedPhase: "focus" },
      turnPolicy: "start-turn",
      requiredToolName: "pomodoro_acknowledge",
      deduplicationKey: "focus:1",
    });

    const snapshot = storage.snapshot();
    expect(snapshot.conversation?.[0]).toMatchObject({
      kind: "extension-event",
      id: published.eventId,
      extensionId: "pomodoro",
      type: "timer.completed",
      turnPolicy: "start-turn",
      requiredToolName: "pomodoro_acknowledge",
    });
    expect(snapshot.pendingAgentTurns).toEqual([
      { triggerEventId: published.eventId, createdAt: expect.any(Number) },
    ]);
    expect(persistedJobCount).toBe(1);
  });

  it("deduplicates events within their source extension", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage, dependencies);
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

  it("rejects a required tool on an event that does not start a turn", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage, dependencies);

    await expect(
      service.publish("calendar", {
        type: "calendar.synchronized",
        payload: {},
        turnPolicy: "record-only",
        requiredToolName: "calendar_acknowledge",
      }),
    ).rejects.toThrow("requiredToolName requires turnPolicy 'start-turn'");
    expect(storage.snapshot().conversation).toEqual([]);
  });

  it("rejects event names outside the documented domain.event convention", async () => {
    const storage = createInMemoryStorageRepository();
    const service = new ConversationEventService(storage, dependencies);

    await expect(
      service.publish("calendar", {
        type: "calendar:synchronized",
        payload: {},
        turnPolicy: "record-only",
      }),
    ).rejects.toThrow();
    expect(storage.snapshot().conversation).toEqual([]);
  });
});
