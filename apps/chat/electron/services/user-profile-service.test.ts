import { configuredAgent } from "../test-support/configured-agent.js";
import { describe, expect, it } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { UserProfileService } from "./user-profile-service.js";
import { ChatApplicationService } from "./chat-application-service.js";

describe("local personal memory", () => {
  it("retains name and notes after clearing chat and recreating the service", async () => {
    const storage = createInMemoryStorageRepository({
      conversation: [{ role: "user", content: "Call me Sam" }],
    });
    const profile = new UserProfileService(storage, () => {});
    await profile.mutate({ action: "set_name", text: "Sam" });
    await profile.mutate({
      action: "remember",
      tier: "working",
      text: "Prefers short focus sessions",
    });
    const chat = new ChatApplicationService(
      storage,
      configuredAgent({
        runUserTurn: async () => {},
        runEventTurn: async () => ({ disposition: "silent" }),
      }),
      () => {},
      () => {},
    );
    await chat.clearConversation();
    const restored = await new UserProfileService(storage, () => {}).get();
    expect(restored.name).toBe("Sam");
    expect(restored.notes[0]?.text).toBe("Prefers short focus sessions");
    expect(storage.snapshot().conversation).toEqual([]);
  });
  it("archives the least recently used working fact without deleting it", async () => {
    const storage = createInMemoryStorageRepository();
    let now = 1;
    const profile = new UserProfileService(
      storage,
      () => {},
      () => now++,
    );
    await expect(
      profile.mutate({ action: "set_name", text: 42 }),
    ).rejects.toThrow();
    for (let i = 0; i < 50; i++)
      await profile.mutate({
        action: "remember",
        tier: "working",
        text: `Preference ${i}`,
      });
    const first = (await profile.get()).notes[0]!;
    await profile.mutate({ action: "use", ids: [first.id] });
    await profile.mutate({
      action: "remember",
      tier: "working",
      text: "New preference",
    });
    const facts = (await profile.get()).notes;
    expect(facts).toHaveLength(51);
    expect(facts.filter((fact) => fact.tier === "working")).toHaveLength(50);
    expect(facts.find((fact) => fact.text === "Preference 1")?.tier).toBe(
      "long_term",
    );
    expect(facts.find((fact) => fact.id === first.id)?.tier).toBe("working");
    await profile.mutate({
      action: "remember",
      tier: "working",
      text: "preference 0",
    });
    expect((await profile.get()).notes).toHaveLength(51);
    await profile.mutate({ action: "forget_note", id: first.id });
    expect((await profile.get()).notes).toHaveLength(50);
  });
  it("stores unlimited long-term facts with bounded retrieval and context", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    for (let i = 0; i < 75; i++)
      await profile.mutate({
        action: "remember",
        tier: "long_term",
        text: `Birthday ${i}`,
      });
    expect((await profile.get()).notes).toHaveLength(75);
    const page = await profile.search({ query: "birthday" });
    expect(page.facts).toHaveLength(10);
    expect(page.nextOffset).toBe(10);
    expect(
      (await profile.search({ query: "birthday", offset: 70 })).facts,
    ).toHaveLength(5);
    expect(JSON.stringify(await profile.context())).not.toContain(
      "Birthday 74",
    );
    await profile.mutate({
      action: "move",
      id: page.facts[0]!.id,
      tier: "working",
    });
    expect((await profile.context()).workingMemory).toHaveLength(1);
  });
  it("rejects stale Settings edits after the agent updates memory", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    const before = await profile.get();
    await profile.mutate({ action: "set_name", text: "Sam" });
    await expect(
      profile.edit({
        name: "Old draft",
        notes: before.notes.map(({ id, text, tier }) => ({ id, text, tier })),
        revision: before.revision,
        checkInsEnabled: true,
      }),
    ).rejects.toThrow("memory changed");
    expect((await profile.get()).name).toBe("Sam");
  });
});
