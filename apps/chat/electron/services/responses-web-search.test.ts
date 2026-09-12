import { expect, it } from "bun:test";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import {
  ResponsesWebSearchService,
  type WebSearchResponse,
} from "./responses-web-search.js";

function response(): WebSearchResponse {
  return {
    status: "completed",
    error: null,
    incomplete_details: null,
    output: [
      {
        id: "search",
        type: "web_search_call",
        status: "completed",
        action: { type: "search", queries: ["NASA news"] },
      },
      {
        id: "message",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "News from NASA.",
            annotations: [
              {
                type: "url_citation",
                url: "https://www.nasa.gov/",
                title: "NASA",
                start_index: 0,
                end_index: 15,
              },
            ],
          },
        ],
      },
    ],
  };
}
it("uses Responses live web search and extracts source annotations", async () => {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const service = new ResponsesWebSearchService(
    "test-key",
    { model: "gpt-5.6-sol", reasoningEffort: "low" },
    {
      create: async (key, request) => {
        expect(key).toBe("test-key");
        requests.push(request);
        return response();
      },
    },
    { type: "web_search", external_web_access: true },
  );
  expect(await service.search("NASA news")).toEqual({
    text: "News from NASA.",
    sources: [{ title: "NASA", url: "https://www.nasa.gov/" }],
  });
  expect(requests[0]).toMatchObject({
    model: "gpt-5.6-sol",
    reasoning: { effort: "low" },
    store: false,
    tool_choice: "required",
    tools: [{ type: "web_search", external_web_access: true }],
    input: "NASA news",
  });
});
it("rejects incomplete and uncited searches and respects cancellation", async () => {
  let result = response();
  const service = new ResponsesWebSearchService(
    "key",
    { model: "gpt-5.6-sol", reasoningEffort: "low" },
    { create: async () => result },
    { type: "web_search", external_web_access: true },
  );
  result = {
    ...response(),
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
  };
  await expect(service.search("news")).rejects.toThrow("did not complete");
  result = { ...response(), output: [] };
  await expect(service.search("news")).rejects.toThrow("completed web search");
  result = response();
  const message = result.output.find((item) => item.type === "message");
  if (!message || message.content[0]?.type !== "output_text")
    throw new Error("Missing fixture");
  message.content[0].annotations = [];
  await expect(service.search("news")).rejects.toThrow("no citable answer");
  const abort = new AbortController();
  abort.abort();
  await expect(service.search("news", abort.signal)).rejects.toThrow();
});
