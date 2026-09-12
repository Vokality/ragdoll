import type { ProviderKey } from "../domain/model-provider.js";
import type {
  AgentModelConfig,
  AgentRunner,
  AgentResponseSessionFactory,
} from "./agent-service.js";
import type { ConfiguredAgent } from "./chat-application-service.js";
import type { ModelProvider } from "./model-provider.js";
import type { WebSearchService } from "./web-search-service.js";

export interface ProviderAgentContext {
  config: AgentModelConfig;
  sessions: AgentResponseSessionFactory;
  webSearch: WebSearchService;
}

/** Bind credentials and all model services once, before any work in a turn. */
export class ProviderAgentFactory implements ConfiguredAgent {
  constructor(
    private readonly credentials: {
      getCredentials(): Promise<ProviderKey>;
      provider(id: ProviderKey["provider"]): ModelProvider;
    },
    private readonly config: Omit<AgentModelConfig, "model">,
    private readonly createRunner: (
      context: ProviderAgentContext,
    ) => AgentRunner,
  ) {}

  async create(): Promise<{ runner: AgentRunner; key: string }> {
    const { provider: id, key } = await this.credentials.getCredentials();
    const provider = this.credentials.provider(id);
    const config = { ...this.config, model: provider.info.model };
    return {
      key,
      runner: this.createRunner({
        config,
        sessions: provider.sessions,
        webSearch: provider.createWebSearch(key, config),
      }),
    };
  }
}
