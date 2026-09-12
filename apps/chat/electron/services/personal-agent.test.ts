import { describe, expect, it } from "bun:test";
import type { ToolDefinition } from "@vokality/ragdoll-extensions";
import type { AgentConversationEvent } from "../domain/conversation.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { PersonalAgent } from "./personal-agent.js";
import { ExperienceService } from "./experience-service.js";
import { UserProfileService } from "./user-profile-service.js";
import { ToolHistoryService } from "./tool-history-service.js";
import type {
  AgentModelConfig,
  AgentResponseSessionFactory,
  ResponseRound,
} from "./agent-service.js";

const config: AgentModelConfig = {
  model: "test",
  reasoningEffort: "low",
  maxOutputTokens: 100,
  maxToolRounds: 6,
  systemPrompt: "Test",
};
function call(name: string, args: Record<string, unknown>): ResponseRound {
  return {
    output: [
      {
        type: "function_call",
        call_id: crypto.randomUUID(),
        name,
        arguments: JSON.stringify(args),
      },
    ],
  };
}
const final: ResponseRound = {
  output: [
    {
      type: "message",
      role: "assistant",
      phase: "final_answer",
      content: "Done",
    },
  ],
};
const tool: ToolDefinition = {
  type: "function",
  function: {
    name: "addTask",
    description: "Add task",
    parameters: { type: "object", properties: {} },
  },
};

describe("personal agent", () => {
  it("saves user-disclosed memory, injects it on the next turn, and records only successful useful actions", async () => {
    const storage = createInMemoryStorageRepository();
    const profile = new UserProfileService(storage, () => {});
    const experience = new ExperienceService(
      storage,
      async () => {},
      () => {},
      () => {},
    );
    const prompts: string[] = [];
    const rounds = [
      call("lumen_update_profile", { action: "set_name", text: "Sam" }),
      call("addTask", {}),
      final,
      call("addTask", {}),
      final,
    ];
    let succeed = false;
    const sessions: AgentResponseSessionFactory = {
      create: (_key, settings) => {
        prompts.push(settings.systemPrompt);
        return {
          respond: async () => {
            const round = rounds.shift();
            if (!round) throw new Error("No round");
            return round;
          },
        };
      },
    };
    const agent = new PersonalAgent(
      storage,
      profile,
      experience,
      {
        getTools: () => [tool],
        getToolsForExtension: () => [tool],
        executeTool: async () => ({ success: succeed }),
      },
      config,
      sessions,
      new ToolHistoryService(storage),
    );
    await agent.runUserTurn("test", [], {
      onText() {},
      onMessage: async () => {},
    });
    expect((await profile.get()).name).toBe("Sam");
    expect(storage.snapshot().experience.firstSuccess).toBeNull();
    succeed = true;
    await agent.runUserTurn("test", [], {
      onText() {},
      onMessage: async () => {},
    });
    expect(prompts[1]).toContain('"name":"Sam"');
    expect(storage.snapshot().experience.firstSuccess?.toolName).toBe(
      "addTask",
    );
  });
  it("lets the model choose silence and never offers memory writes for background events", async () => {
    const storage = createInMemoryStorageRepository();
    const profile = new UserProfileService(storage, () => {});
    let requested = false;
    const sessions: AgentResponseSessionFactory = {
      create: () => ({
        respond: async (request) => {
          requested = true;
          expect(
            request.tools.some((tool) => tool.name === "lumen_update_profile"),
          ).toBe(false);
          return call("lumen_event_silent", {});
        },
      }),
    };
    const experience = new ExperienceService(
      storage,
      async () => {},
      () => {},
      () => {},
    );
    const agent = new PersonalAgent(
      storage,
      profile,
      experience,
      {
        getTools: () => [],
        getToolsForExtension: () => [],
        executeTool: async () => ({ success: false }),
      },
      config,
      sessions,
      new ToolHistoryService(storage),
    );
    const trigger: AgentConversationEvent = {
      kind: "extension-event",
      extensionId: "pomodoro",
      id: "timer",
      type: "timer.completed",
      payload: {},
      turnPolicy: "start-turn",
      occurredAt: Date.now(),
    };
    expect(await agent.runEventTurn("test", [trigger], trigger)).toEqual({
      disposition: "silent",
    });
    expect(requested).toBe(true);
    await profile.edit({
      name: null,
      notes: [],
      revision: 0,
      checkInsEnabled: false,
    });
    requested = false;
    expect(await agent.runEventTurn("test", [trigger], trigger)).toEqual({
      disposition: "silent",
    });
    expect(requested).toBe(false);
  });
});

it("cancels an onboarding turn without a fabricated response or a stuck busy state", async () => {
  const storage = createInMemoryStorageRepository();
  const profile = new UserProfileService(storage, () => {});
  const experience = new ExperienceService(
    storage,
    async () => {},
    () => {},
    () => {},
  );
  const requested = Promise.withResolvers<void>();
  const agent = new PersonalAgent(
    storage,
    profile,
    experience,
    {
      getTools: () => [],
      getToolsForExtension: () => [],
      executeTool: async () => ({ success: false }),
    },
    config,
    {
      create: () => ({
        respond: (request) =>
          new Promise((_resolve, reject) => {
            requested.resolve();
            request.signal?.addEventListener(
              "abort",
              () => reject(new Error("cancelled")),
              { once: true },
            );
          }),
      }),
    },
    new ToolHistoryService(storage),
  );
  const trigger: AgentConversationEvent = {
    kind: "app-event",
    id: "intro",
    type: "app.onboarding",
    payload: {},
    turnPolicy: "start-turn",
    occurredAt: Date.now(),
  };
  const abort = new AbortController();
  const pending = agent.runEventTurn("test", [trigger], trigger, abort.signal);
  await requested.promise;
  expect((await experience.snapshot()).busy).toBe(true);
  abort.abort();
  expect(await pending).toEqual({ disposition: "silent" });
  expect((await experience.snapshot()).busy).toBe(false);
  expect((await experience.snapshot()).error).toBeNull();
});

it("routes memory retrieval, explicit use, and model summaries without injecting the archive", async () => {
  const storage = createInMemoryStorageRepository();
  const profile = new UserProfileService(
    storage,
    () => {},
    () => 123,
  );
  await profile.mutate({
    action: "remember",
    tier: "long_term",
    text: "Birthday May 3",
  });
  const fact = (await profile.get()).notes[0]!;
  const prompts: string[] = [];
  let summaryCalls = 0;
  const rounds = [
    call("lumen_search_memory", { query: "Birthday" }),
    call("lumen_update_profile", { action: "use", ids: [fact.id] }),
    call("lumen_update_profile", {
      action: "remember",
      tier: "working",
      text: "Prefers morning planning",
    }),
    final,
  ];
  const sessions: AgentResponseSessionFactory = {
    create: (_key, settings) => {
      const isSummary = settings.systemPrompt.includes("at-a-glance index");
      if (!isSummary) prompts.push(settings.systemPrompt);
      return {
        respond: async (request) => {
          if (isSummary) {
            summaryCalls++;
            return call("save_memory_summary", {
              summary: "A birthday is saved.",
            });
          }
          expect(
            request.tools.some((tool) => tool.name === "lumen_search_memory"),
          ).toBe(true);
          const round = rounds.shift();
          if (!round) throw new Error("No round");
          return round;
        },
      };
    },
  };
  const agent = new PersonalAgent(
    storage,
    profile,
    new ExperienceService(
      storage,
      async () => {},
      () => {},
      () => {},
    ),
    {
      getTools: () => [],
      getToolsForExtension: () => [],
      executeTool: async () => {
        throw new Error("Memory tools leaked to extensions");
      },
    },
    config,
    sessions,
    new ToolHistoryService(storage),
  );
  await agent.runUserTurn(
    "test",
    [{ id: "message-296", role: "user", content: "What is my birthday?" }],
    { onText() {}, onMessage: async () => {} },
  );
  expect(summaryCalls).toBe(1);
  expect(prompts[0]).toContain("A birthday is saved.");
  expect(prompts[0]).not.toContain("Birthday May 3");
  expect((await profile.context()).workingMemory[0]?.text).toBe(
    "Prefers morning planning",
  );
  expect(storage.snapshot().experience.firstSuccess).toBeNull();
});

it("saves multiple long-term facts before making one summary request after the reply", async () => {
  const storage = createInMemoryStorageRepository();
  const profile = new UserProfileService(storage, () => {});
  let replied = false;
  let summaries = 0;
  const rounds = [
    call("lumen_update_profile", {
      action: "remember",
      tier: "long_term",
      text: "Birthday May 3",
    }),
    call("lumen_update_profile", {
      action: "remember",
      tier: "long_term",
      text: "Anniversary June 4",
    }),
    final,
  ];
  const agent = new PersonalAgent(
    storage,
    profile,
    new ExperienceService(
      storage,
      async () => {},
      () => {},
      () => {},
    ),
    {
      getTools: () => [],
      getToolsForExtension: () => [],
      executeTool: async () => ({ success: false }),
    },
    config,
    {
      create: (_key, settings) => ({
        respond: async (request) => {
          if (settings.systemPrompt.includes("at-a-glance index")) {
            expect(replied).toBe(true);
            expect((await profile.get()).notes).toHaveLength(2);
            summaries++;
            return call("save_memory_summary", {
              summary: "Birthday and anniversary dates are saved.",
            });
          }
          const round = rounds.shift();
          if (!round) throw new Error("No round");
          if (round === final)
            await request.events?.onMessage({ content: "Done", sources: [] });
          return round;
        },
      }),
    },
    new ToolHistoryService(storage),
  );
  await agent.runUserTurn("test", [], {
    onText() {},
    onMessage: async () => {
      replied = true;
    },
  });
  expect(summaries).toBe(1);
  expect((await profile.get()).longTermSummary).toBe(
    "Birthday and anniversary dates are saved.",
  );
});
