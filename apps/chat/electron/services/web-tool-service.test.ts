import { expect, it } from "bun:test";
import { WebToolService } from "./web-tool-service.js";
import type { AgentToolService } from "./openai-service.js";

it("exposes live search independently and forwards other tools and citations", async () => {
  const calls: string[] = [];
  const delegate: AgentToolService = {
    getTools: () => [],
    getToolsForExtension: () => [],
    executeTool: async (name) => {
      calls.push(name);
      return { success: true };
    },
  };
  const sources = [{ title: "Source", url: "https://example.com/" }];
  const tools = new WebToolService(delegate, {
    search: async (query, signal) => {
      calls.push(query);
      signal?.throwIfAborted();
      return { text: "Result", sources };
    },
  });
  expect(tools.getTools()[0]?.function.name).toBe("lumen_search_web");
  expect(
    (await tools.executeTool("lumen_search_web", { query: " " })).success,
  ).toBe(false);
  expect(
    await tools.executeTool("lumen_search_web", { query: "Current news" }),
  ).toEqual({
    success: true,
    data: { query: "Current news", answer: "Result" },
    sources,
  });
  await tools.executeTool("canvas_get", {});
  expect(calls).toEqual(["Current news", "canvas_get"]);
  const abort = new AbortController();
  abort.abort();
  await expect(
    tools.executeTool("lumen_search_web", { query: "News" }, abort.signal),
  ).rejects.toThrow();
});
