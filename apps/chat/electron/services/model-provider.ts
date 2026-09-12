import type {
  ModelProviderId,
  ModelProviderInfo,
} from "../domain/model-provider.js";
import type {
  AgentModelConfig,
  AgentResponseSessionFactory,
} from "./agent-service.js";
import type { WebSearchService } from "./web-search-service.js";
import { createResponsesProvider } from "./responses-provider.js";

/** The app owns the agent loop; providers own inference, key validation and search. */
export interface ModelProvider {
  readonly info: Omit<ModelProviderInfo, "selected" | "configured">;
  readonly sessions: AgentResponseSessionFactory;
  validateKey(key: string): Promise<void>;
  createWebSearch(key: string, config: AgentModelConfig): WebSearchService;
}

const definitions = [
  {
    id: "openai",
    name: "OpenAI",
    model: "gpt-5.6-sol",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    baseURL: "https://api.openai.com/v1",
    messagePhases: true,
    searchTool: {
      type: "web_search",
      external_web_access: true,
      search_context_size: "medium",
    },
  },
  {
    id: "grok",
    name: "Grok",
    model: "grok-4.6",
    apiKeyUrl: "https://console.x.ai/",
    keyPlaceholder: "xai-...",
    baseURL: "https://api.x.ai/v1",
    messagePhases: false,
    searchTool: { type: "web_search" },
  },
] as const;

export function createModelProviders(): ReadonlyMap<
  ModelProviderId,
  ModelProvider
> {
  return new Map(
    definitions.map((definition) => [
      definition.id,
      createResponsesProvider(definition),
    ]),
  );
}
