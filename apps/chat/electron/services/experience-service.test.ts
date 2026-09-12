import { configuredAgent } from "../test-support/configured-agent.js";
import { describe, expect, it } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ExperienceService } from "./experience-service.js";
import { ChatApplicationService } from "./chat-application-service.js";
import type { AgentConversationEvent } from "../domain/conversation.js";

const hour = 3_600_000;
describe("agent-guided experience", () => {
  it("queues one internal introduction, shows only the model reply, and does not repeat after clearing chat", async () => {
    const storage = createInMemoryStorageRepository();
    const triggers: AgentConversationEvent[] = [];
    const chat = new ChatApplicationService(
      storage,
      configuredAgent({
        runUserTurn: async () => {},
        runEventTurn: async (_key, _history, trigger) => {
          triggers.push(trigger);
          return { disposition: "respond", content: "What should I call you?" };
        },
      }),
      () => {},
      (error) => {
        throw error;
      },
    );
    const experience = new ExperienceService(
      storage,
      () => chat.schedulePendingEventTurns(),
      () => {},
      () => {},
    );
    await experience.begin();
    await experience.begin();
    expect(triggers).toHaveLength(1);
    expect(await chat.getConversation()).toEqual([
      {
        id: expect.any(String),
        role: "assistant",
        content: "What should I call you?",
      },
    ]);
    await chat.clearConversation();
    await experience.begin();
    expect(triggers).toHaveLength(1);
  });
  it("requires a meaningful absence, completed first action, opt-in, and cooldown for focus check-ins", async () => {
    let now = 5 * hour;
    const storage = createInMemoryStorageRepository({
      experience: {
        introduced: true,
        firstSuccess: { toolName: "addTask", occurredAt: 1 },
      },
    });
    let scheduled = 0;
    const experience = new ExperienceService(
      storage,
      async () => {
        scheduled++;
      },
      () => {},
      () => {},
      () => now,
    );
    await experience.begin();
    scheduled = 0;
    await experience.focus();
    experience.blur();
    now += 1000;
    await experience.focus();
    expect(scheduled).toBe(0);
    experience.blur();
    now += hour;
    await experience.focus();
    expect(scheduled).toBe(1);
    expect(storage.snapshot().pendingAgentTurns).toHaveLength(1);
    await storage.update((draft) => {
      draft.pendingAgentTurns = [];
    });
    experience.blur();
    now += hour;
    await experience.focus();
    expect(scheduled).toBe(1);
    await storage.update((draft) => {
      draft.profile.checkInsEnabled = false;
    });
    experience.blur();
    now += 5 * hour;
    await experience.focus();
    expect(scheduled).toBe(1);
  });
  it("keeps failed introductions pending for retry and admits no focus event while busy", async () => {
    let now = 5 * hour;
    const storage = createInMemoryStorageRepository();
    const chat = new ChatApplicationService(
      storage,
      configuredAgent({
        runUserTurn: async () => {},
        runEventTurn: async () => {
          throw new Error("offline");
        },
      }),
      () => {},
      () => {},
    );
    const experience = new ExperienceService(
      storage,
      () => chat.schedulePendingEventTurns(),
      () => {},
      () => {},
      () => now,
    );
    await experience.begin();
    expect(storage.snapshot().pendingAgentTurns).toHaveLength(1);
    expect(storage.snapshot().experience.introduced).toBe(false);
    experience.started();
    experience.blur();
    now += hour;
    await experience.focus();
    expect(storage.snapshot().pendingAgentTurns).toHaveLength(1);
  });
});
