import { expect, it } from "bun:test";
import { z } from "zod";
import { createResponsesProvider } from "./responses-provider.js";
import { createModelProviders } from "./model-provider.js";
import {
  ToolCallingAgentRunner,
  type AgentModelConfig,
} from "./agent-service.js";
import { ToolHistoryService } from "./tool-history-service.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";

for (const id of ["openai", "grok"] as const) {
  it(`${id}: uses its endpoint and key for validation, tool streaming, replay and cited search`, async () => {
    const catalog = createModelProviders().get(id);
    if (!catalog) throw new Error("Provider missing");
    const baseURL =
      id === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1";
    const requests: Array<Record<string, unknown>> = [];
    const urls: string[] = [];
    let rounds = 0;
    const reasoning = {
      type: "reasoning",
      id: "rs_1",
      summary: [],
      encrypted_content: `${id}-private`,
    };
    const call = {
      type: "function_call",
      call_id: "call_1",
      name: "do_work",
      arguments: '{"value":"ok"}',
    };
    const message = {
      type: "message",
      id: "msg_1",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "Done.", annotations: [] }],
    };
    const provider = createResponsesProvider(
      {
        ...catalog.info,
        baseURL,
        messagePhases: id === "openai",
        searchTool:
          id === "openai"
            ? { type: "web_search", external_web_access: true }
            : { type: "web_search" },
      },
      async (url, init) => {
        urls.push(String(url));
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${id}-secret`,
        );
        if (String(url).endsWith("/models"))
          return Response.json({ object: "list", data: [] });
        if (typeof init?.body !== "string")
          throw new Error("Expected JSON request");
        const body = z
          .record(z.string(), z.unknown())
          .parse(JSON.parse(init.body));
        requests.push(body);
        if (body.stream) {
          rounds += 1;
          const output =
            rounds === 1 || rounds === 3
              ? [reasoning, call]
              : rounds === 4
                ? [
                    {
                      type: "function_call",
                      call_id: "decision",
                      name: "lumen_event_silent",
                      arguments: "{}",
                    },
                  ]
                : [message];
          const events: Array<Record<string, unknown>> =
            rounds === 1
              ? []
              : [
                  { type: "response.output_text.delta", delta: "Done." },
                  { type: "response.output_item.done", item: message },
                ];
          events.push({ type: "response.completed", response: { output } });
          return new Response(
            events
              .map(
                (event) =>
                  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
              )
              .join(""),
            {
              headers: { "content-type": "text/event-stream" },
            },
          );
        }
        return Response.json({
          status: "completed",
          output: [
            { type: "web_search_call", status: "completed", id: "search_1" },
            {
              ...message,
              content: [
                {
                  type: "output_text",
                  text: "A sourced answer.",
                  annotations: [
                    {
                      type: "url_citation",
                      url: "https://example.com/report",
                      title: id === "grok" ? "1" : "Report",
                    },
                  ],
                },
              ],
            },
          ],
        });
      },
    );
    const config: AgentModelConfig = {
      model: provider.info.model,
      reasoningEffort: "low",
      maxOutputTokens: 2048,
      maxToolRounds: 8,
      systemPrompt: "Lumen",
    };
    await provider.validateKey(`${id}-secret`);
    const executed: unknown[] = [];
    const texts: string[] = [];
    const messages: string[] = [];
    const runner = new ToolCallingAgentRunner(
      {
        getTools: () => [
          {
            type: "function",
            function: {
              name: "do_work",
              description: "Work",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
        getToolsForExtension: () => [
          {
            type: "function",
            function: {
              name: "do_work",
              description: "Work",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
        executeTool: async (_name, args) => {
          executed.push(args);
          return { success: true };
        },
      },
      config,
      provider.sessions,
      new ToolHistoryService(createInMemoryStorageRepository()),
    );
    await runner.runUserTurn(
      `${id}-secret`,
      [
        {
          id: "message-167",
          role: "assistant",
          content: "Earlier progress",
          phase: "commentary",
        },
        { id: "message-168", role: "user", content: "Work" },
      ],
      {
        onText: (text) => texts.push(text),
        onMessage: async (message) => {
          messages.push(message.content);
        },
      },
    );
    expect(executed).toEqual([{ value: "ok" }]);
    expect(texts).toEqual(["Done."]);
    expect(messages).toEqual(["Done."]);
    expect(requests[0]?.input).toEqual([
      {
        role: "assistant",
        content: "Earlier progress",
        ...(id === "openai" ? { phase: "commentary" } : {}),
      },
      { role: "user", content: "Work" },
    ]);
    expect(requests[1]?.input).toEqual([
      ...z.array(z.unknown()).parse(requests[0]?.input),
      reasoning,
      call,
      {
        type: "function_call_output",
        call_id: "call_1",
        output: JSON.stringify({
          args: { value: "ok" },
          result: { success: true },
        }),
      },
    ]);
    expect(
      await provider.createWebSearch(`${id}-secret`, config).search("news"),
    ).toEqual({
      text: "A sourced answer.",
      sources: [
        {
          url: "https://example.com/report",
          title: id === "grok" ? "example.com" : "Report",
        },
      ],
    });
    expect(
      await runner.runEventTurn(`${id}-secret`, [], {
        kind: "extension-event",
        id: "event_1",
        extensionId: "test",
        type: "test.ready",
        occurredAt: 1,
        payload: {},
        turnPolicy: "start-turn",
        requiredToolName: "do_work",
      }),
    ).toEqual({ disposition: "silent" });
    expect(requests[3]?.tool_choice).toEqual({
      type: "function",
      name: "do_work",
    });
    expect(requests[4]?.tool_choice).toBe("required");
    expect(executed).toEqual([{ value: "ok" }, { value: "ok" }]);
    expect(urls).toEqual([
      `${baseURL}/models`,
      `${baseURL}/responses`,
      `${baseURL}/responses`,
      `${baseURL}/responses`,
      `${baseURL}/responses`,
      `${baseURL}/responses`,
    ]);
    expect(requests.map((request) => request.model)).toEqual([
      config.model,
      config.model,
      config.model,
      config.model,
      config.model,
    ]);
    expect(requests[2]?.tools).toEqual(
      id === "openai"
        ? [{ type: "web_search", external_web_access: true }]
        : [{ type: "web_search" }],
    );
    expect(requests[0]).toMatchObject({
      store: false,
      reasoning: { effort: "low" },
      include: ["reasoning.encrypted_content"],
    });
  });
}

for (const event of [
  { type: "response.output_text.delta", delta: 42 },
  {
    type: "response.completed",
    response: {
      output: [
        { type: "function_call", call_id: "bad", name: "work", arguments: {} },
      ],
    },
  },
]) {
  it(`rejects malformed provider data at ${event.type} before passing it to the agent`, async () => {
    const info = createModelProviders().get("grok")?.info;
    if (!info) throw new Error("Missing Grok");
    const provider = createResponsesProvider(
      {
        ...info,
        baseURL: "https://api.x.ai/v1",
        messagePhases: false,
        searchTool: { type: "web_search" },
      },
      async () =>
        new Response(
          `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        ),
    );
    const texts: string[] = [];
    const session = provider.sessions.create("fake", {
      model: info.model,
      reasoningEffort: "low",
      maxOutputTokens: 100,
      maxToolRounds: 1,
      systemPrompt: "Test",
    });
    await expect(
      session.respond({
        input: [],
        tools: [],
        toolChoice: "auto",
        events: {
          onText: (text) => texts.push(text),
          onMessage: async () => {},
        },
      }),
    ).rejects.toThrow();
    expect(texts).toEqual([]);
  });
}
