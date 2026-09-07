import { describe, expect, it } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { UserProfileService } from "./user-profile-service.js";
import { refreshMemorySummary } from "./memory-summary-service.js";
import type {
  AgentModelConfig,
  AgentResponseSessionFactory,
  ResponseRound,
} from "./openai-service.js";

const config: AgentModelConfig = {
  model: "test",
  reasoningEffort: "low",
  maxOutputTokens: 100,
  maxToolRounds: 6,
  systemPrompt: "test",
};
const reply = (summary: string): ResponseRound => ({
  output: [
    {
      type: "function_call",
      call_id: "summary",
      name: "save_memory_summary",
      arguments: JSON.stringify({ summary }),
    },
  ],
});

describe("long-term summary", () => {
  it("summarizes in bounded batches and reuses the saved model summary", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    for (let i = 0; i < 76; i++)
      await profile.mutate({
        action: "remember",
        tier: "long_term",
        text: `Birthday ${i}`,
      });
    const inputs: string[] = [];
    const sessions: AgentResponseSessionFactory = {
      create: () => ({
        respond: async (request) => {
          inputs.push(JSON.stringify(request.input));
          expect(request.tools[0]?.name).toBe("save_memory_summary");
          expect(request.events).toBeUndefined();
          return reply(`Birthday index batch ${inputs.length}`);
        },
      }),
    };
    await refreshMemorySummary(profile, sessions, config, "test");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toContain("Birthday 49");
    expect(inputs[0]).not.toContain("Birthday 50");
    expect(inputs[1]).toContain("Birthday index batch 1");
    expect((await profile.get()).longTermSummary).toBe(
      "Birthday index batch 2",
    );
    await refreshMemorySummary(profile, sessions, config, "test");
    expect(inputs).toHaveLength(2);
    expect(JSON.stringify(await profile.context())).not.toContain(
      "Birthday 75",
    );
  });
  it("invalidates summaries on forgetting and rejects an in-flight stale summary", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    await profile.mutate({
      action: "remember",
      tier: "long_term",
      text: "Birthday April 3",
    });
    const fact = (await profile.get()).notes[0]!;
    await refreshMemorySummary(
      profile,
      {
        create: () => ({
          respond: async () => {
            await profile.mutate({ action: "forget_note", id: fact.id });
            return reply("Birthday April 3");
          },
        }),
      },
      config,
      "test",
    );
    expect((await profile.get()).longTermSummary).toBeNull();
    expect((await profile.get()).notes).toHaveLength(0);
  });
  it("keeps saved facts on invalid output and retries without inventing a summary", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    await profile.mutate({
      action: "remember",
      tier: "long_term",
      text: "Birthday April 3",
    });
    await refreshMemorySummary(
      profile,
      { create: () => ({ respond: async () => reply("") }) },
      config,
      "test",
    );
    expect((await profile.get()).longTermSummary).toBeNull();
    expect((await profile.get()).notes).toHaveLength(1);
    await refreshMemorySummary(
      profile,
      {
        create: () => ({ respond: async () => reply("A birthday is saved.") }),
      },
      config,
      "test",
    );
    expect((await profile.get()).longTermSummary).toBe("A birthday is saved.");
    const saved = await profile.get();
    await profile.edit({
      name: saved.name,
      revision: saved.revision,
      checkInsEnabled: true,
      notes: saved.notes.map(({ id, tier }) => ({
        id,
        tier,
        text: "Birthday May 3",
      })),
    });
    expect((await profile.get()).longTermSummary).toBeNull();
  });
  it("propagates cancellation without saving a partial summary", async () => {
    const profile = new UserProfileService(
      createInMemoryStorageRepository(),
      () => {},
    );
    await profile.mutate({
      action: "remember",
      tier: "long_term",
      text: "Birthday April 3",
    });
    const abort = new AbortController();
    await expect(
      refreshMemorySummary(
        profile,
        {
          create: () => ({
            respond: async () => {
              abort.abort();
              return reply("Birthday index");
            },
          }),
        },
        config,
        "test",
        abort.signal,
      ),
    ).rejects.toThrow();
    expect((await profile.get()).longTermSummary).toBeNull();
  });
});
