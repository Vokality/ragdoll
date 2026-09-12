import { expect, it } from "bun:test";
import {
  ProviderAgentFactory,
  type ProviderAgentContext,
} from "./provider-agent-factory.js";
import type { ProviderKey } from "../domain/model-provider.js";
import type { AgentRunner } from "./agent-service.js";
import { createModelProviders } from "./model-provider.js";

it("binds inference and search to one provider per turn, then honors the next selection", async () => {
  let selected: ProviderKey = { provider: "openai", key: "openai-key" };
  const providers = new Map(createModelProviders());
  const searchBindings: string[] = [];
  for (const [id, provider] of providers) {
    providers.set(id, {
      ...provider,
      createWebSearch: (key, config) => {
        searchBindings.push(`${id}:${key}:${config.model}`);
        return { search: async () => ({ text: key, sources: [] }) };
      },
    });
  }
  const contexts: ProviderAgentContext[] = [];
  const runner: AgentRunner = {
    runUserTurn: async () => {},
    runEventTurn: async () => ({ disposition: "silent" }),
  };
  const factory = new ProviderAgentFactory(
    {
      getCredentials: async () => selected,
      provider: (id) => {
        const provider = providers.get(id);
        if (!provider) throw new Error("Unknown provider");
        return provider;
      },
    },
    {
      reasoningEffort: "low",
      maxOutputTokens: 2048,
      maxToolRounds: 8,
      systemPrompt: "Lumen",
    },
    (context) => {
      contexts.push(context);
      return runner;
    },
  );
  const first = await factory.create();
  selected = { provider: "grok", key: "grok-key" };
  expect(first.key).toBe("openai-key");
  expect(await contexts[0]?.webSearch.search("query")).toMatchObject({
    text: "openai-key",
  });
  const second = await factory.create();
  expect(second.key).toBe("grok-key");
  expect(contexts[1]?.sessions === providers.get("grok")?.sessions).toBe(true);
  expect(contexts[0]?.sessions === providers.get("openai")?.sessions).toBe(
    true,
  );
  expect(searchBindings).toEqual([
    "openai:openai-key:gpt-5.6-sol",
    "grok:grok-key:grok-4.6",
  ]);
});
