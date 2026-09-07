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
      text: "Prefers short focus sessions",
    });
    const chat = new ChatApplicationService(
      storage,
      { getKey: async () => "test" },
      {
        runUserTurn: async () => {},
        runEventTurn: async () => ({ disposition: "silent" }),
      },
      () => {},
      () => {},
    );
    await chat.clearConversation();
    const restored = await new UserProfileService(storage, () => {}).get();
    expect(restored.name).toBe("Sam");
    expect(restored.notes[0]?.text).toBe("Prefers short focus sessions");
    expect(storage.snapshot().conversation).toEqual([]);
  });
  it("validates at the boundary, deduplicates notes, and does not evict memory silently", async () => {
    const storage = createInMemoryStorageRepository();
    const profile = new UserProfileService(storage, () => {});
    await expect(
      profile.mutate({ action: "set_name", text: 42 }),
    ).rejects.toThrow();
    for (let i = 0; i < 8; i++)
      await profile.mutate({ action: "remember", text: `Preference ${i}` });
    await profile.mutate({ action: "remember", text: "preference 0" });
    await expect(
      profile.mutate({ action: "remember", text: "One too many" }),
    ).rejects.toThrow("Memory is full");
    expect((await profile.get()).notes).toHaveLength(8);
    const note = (await profile.get()).notes[0];
    if (!note) throw new Error("Expected saved note");
    await profile.mutate({ action: "forget_note", id: note.id });
    expect((await profile.get()).notes).toHaveLength(7);
    await profile.mutate({ action: "skip_name" });
    expect((await profile.get()).nameDeclined).toBe(true);
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
        notes: before.notes,
        revision: before.revision,
        checkInsEnabled: true,
      }),
    ).rejects.toThrow("memory changed");
    expect((await profile.get()).name).toBe("Sam");
  });
});
