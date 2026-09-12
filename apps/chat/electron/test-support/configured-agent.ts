import type { AgentRunner } from "../services/agent-service.js";
import type { ConfiguredAgent } from "../services/chat-application-service.js";

export function configuredAgent(
  runner: AgentRunner,
  key = "test-key",
): ConfiguredAgent {
  return { create: async () => ({ runner, key }) };
}
