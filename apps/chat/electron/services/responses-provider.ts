import OpenAI from "openai";
import type { ClientOptions } from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { ModelProvider } from "./model-provider.js";
import { ResponsesSession } from "./responses-session.js";
import { ResponsesWebSearchService } from "./responses-web-search.js";

type ResponsesProviderDefinition = ModelProvider["info"] & {
  baseURL: string;
  messagePhases: boolean;
  searchTool: NonNullable<ResponseCreateParamsNonStreaming["tools"]>[number];
};

/** Shared protocol adapter for providers implementing the Responses API. */
export function createResponsesProvider(
  { baseURL, messagePhases, searchTool, ...info }: ResponsesProviderDefinition,
  fetch?: ClientOptions["fetch"],
): ModelProvider {
  const client = (apiKey: string) => new OpenAI({ apiKey, baseURL, fetch });
  return {
    info,
    sessions: {
      create: (key, config) => {
        const api = client(key);
        return new ResponsesSession(
          config,
          {
            stream: (params, signal) =>
              api.responses.create(params, { signal }),
          },
          messagePhases,
        );
      },
    },
    async validateKey(key) {
      await client(key).models.list();
    },
    createWebSearch(key, config) {
      const api = client(key);
      return new ResponsesWebSearchService(
        key,
        config,
        {
          create: (_key, request, signal) =>
            api.responses.create(request, { signal }),
        },
        searchTool,
      );
    },
  };
}
