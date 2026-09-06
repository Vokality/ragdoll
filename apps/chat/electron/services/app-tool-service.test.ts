import { expect, it } from "bun:test";
import type { SlotInfo } from "../electron-api.js";
import { AppToolService } from "./app-tool-service.js";
import { ExtensionCardService } from "./extension-card-service.js";
import type { AgentToolService } from "./openai-service.js";

function setup() {
  let visible = true;
  let slots: SlotInfo[] = [
    {
      slotId: "tasks.main",
      extensionId: "tasks",
      label: "Tasks",
      icon: "checklist",
      priority: 0,
    },
    {
      slotId: "game.board",
      extensionId: "game",
      label: "Game",
      icon: "grid",
      priority: 0,
    },
  ];
  const changes: (string | null)[] = [];
  const calls: string[] = [];
  const cards = new ExtensionCardService(
    {
      getAllSlots: () => slots,
      getSlotState: () => ({
        visible,
        badge: null,
        panel: { type: "list", title: "Card", items: [] },
      }),
    },
    (id) => changes.push(id),
  );
  const extensions: AgentToolService = {
    getTools: () => [
      {
        type: "function",
        function: {
          name: "listTasks",
          description: "List tasks",
          parameters: { type: "object", properties: {} },
        },
      },
    ],
    getToolsForExtension: () => [],
    executeTool: async (name) => {
      calls.push(name);
      return { success: true };
    },
  };
  return {
    tools: new AppToolService(extensions, cards),
    cards,
    changes,
    calls,
    extensions,
    hide: () => {
      visible = false;
      cards.reconcile();
    },
    remove: () => {
      slots = [];
      cards.reconcile();
    },
  };
}

it("app tools open, switch, and close cards independently of extension actions", async () => {
  const { tools, cards, changes, calls } = setup();
  expect(tools.getTools().map((tool) => tool.function.name)).toEqual([
    "listTasks",
    "lumen_list_cards",
    "lumen_open_card",
    "lumen_close_card",
  ]);
  expect((await tools.executeTool("lumen_list_cards", {})).success).toBe(true);
  await tools.executeTool("listTasks", {});
  expect(cards.getActive()).toBeNull();
  expect(
    (await tools.executeTool("lumen_open_card", { slotId: "tasks.main" }))
      .success,
  ).toBe(true);
  await tools.executeTool("lumen_open_card", { slotId: "tasks.main" });
  await tools.executeTool("lumen_open_card", { slotId: "game.board" });
  expect(cards.getActive()).toBe("game.board");
  await tools.executeTool("lumen_close_card", {});
  await tools.executeTool("lumen_close_card", {});
  expect(changes).toEqual(["tasks.main", "game.board", null]);
  expect(calls).toEqual(["listTasks"]);
});

it("invalid or unavailable card requests fail without changing selection", async () => {
  const { tools, cards, hide } = setup();
  cards.select("tasks.main");
  for (const args of [
    {},
    { slotId: 7 },
    { slotId: "missing" },
    { slotId: "game.board", extra: true },
  ]) {
    expect((await tools.executeTool("lumen_open_card", args)).success).toBe(
      false,
    );
    expect(cards.getActive()).toBe("tasks.main");
  }
  expect(
    (await tools.executeTool("lumen_close_card", { unexpected: true })).success,
  ).toBe(false);
  hide();
  expect(cards.getActive()).toBeNull();
  expect(
    (await tools.executeTool("lumen_open_card", { slotId: "tasks.main" }))
      .success,
  ).toBe(false);
});

it("removing an extension closes its active card", () => {
  const { cards, remove, changes } = setup();
  cards.select("tasks.main");
  remove();
  expect(changes).toEqual(["tasks.main", null]);
});

it("extension tools cannot shadow app-owned controls", () => {
  const { tools, extensions } = setup();
  extensions.getTools = () => [
    {
      type: "function",
      function: {
        name: "lumen_close_card",
        description: "Conflict",
        parameters: { type: "object", properties: {} },
      },
    },
  ];
  expect(() => tools.getTools()).toThrow("conflicts with an app tool");
});

it("exposes current card state after manual selection and tool execution", async () => {
  const { tools, cards } = setup();
  const description = () =>
    tools.getTools().find((tool) => tool.function.name === "lumen_close_card")
      ?.function.description;
  expect(description()).toContain("Current open card: null");
  cards.select("tasks.main");
  expect(description()).toContain('Current open card: "tasks.main"');
  await tools.executeTool("lumen_close_card", {});
  expect(description()).toContain("Current open card: null");
  cards.select("game.board");
  expect(description()).toContain('Current open card: "game.board"');
});
