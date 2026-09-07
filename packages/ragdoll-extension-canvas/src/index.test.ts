import { expect, it } from "bun:test";
import {
  createRegistry,
  serializeSlotState,
  canvasDocumentSchema,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import { createExtension } from "./index.js";
import packageJson from "../package.json";

const rect = {
  id: "box",
  type: "rect",
  x: 10,
  y: 10,
  width: 80,
  height: 40,
  radius: 4,
  fill: "#334155",
  stroke: "none",
  strokeWidth: 0,
  opacity: 1,
};

async function setup(initial?: unknown) {
  let saved: unknown = initial;
  let fail = false;
  const host: ExtensionHostEnvironment = {
    capabilities: new Set(["storage", "logger"]),
    storage: {
      read: async () => structuredClone(saved),
      write: async (_id, _key, value) => {
        if (fail) throw new Error("Storage failed");
        saved = structuredClone(value);
      },
      delete: async () => {},
      list: async () => [],
    },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  };
  const registry = createRegistry({
    now: Date.now,
    onListenerError: (error) => {
      throw error;
    },
  });
  await registry.register(createExtension(), { host });
  return {
    registry,
    saved: () => saved,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
it("matches its package capability contract", () => {
  expect(createExtension().manifest.requiredCapabilities).toEqual(
    packageJson.ragdollExtension.requiredCapabilities,
  );
  expect(createExtension().manifest.optionalCapabilities).toEqual([]);
});
it("draws atomically, replaces IDs, removes elements, undoes and restores persisted state", async () => {
  const { registry, saved } = await setup();
  try {
    expect(
      (
        await registry.executeTool("canvas_draw", {
          expectedRevision: 0,
          elements: [rect],
          removeIds: [],
        })
      ).success,
    ).toBe(true);
    expect(
      (
        await registry.executeTool("canvas_draw", {
          expectedRevision: 1,
          elements: [{ ...rect, width: 100 }],
          removeIds: [],
        })
      ).success,
    ).toBe(true);
    expect((await registry.executeTool("canvas_get", {})).data).toMatchObject({
      revision: 2,
      document: { elements: [{ ...rect, width: 100 }] },
    });
    expect(
      (await registry.executeTool("canvas_clear", { expectedRevision: 2 }))
        .success,
    ).toBe(true);
    expect(
      (await registry.executeTool("canvas_undo", { expectedRevision: 3 }))
        .success,
    ).toBe(true);
    const reloaded = await setup(saved());
    expect(
      (await reloaded.registry.executeTool("canvas_get", {})).data,
    ).toMatchObject({
      revision: 4,
      document: { elements: [{ ...rect, width: 100 }] },
    });
    await reloaded.registry.destroy();
    expect(
      (
        await registry.executeTool("canvas_draw", {
          expectedRevision: 4,
          elements: [],
          removeIds: ["box"],
        })
      ).success,
    ).toBe(true);
  } finally {
    await registry.destroy();
  }
});
it("rejects stale and invalid edits without partial writes and recovers after storage failure", async () => {
  const { registry, fail } = await setup();
  try {
    const results = await Promise.all([
      registry.executeTool("canvas_draw", {
        expectedRevision: 0,
        elements: [rect],
        removeIds: [],
      }),
      registry.executeTool("canvas_draw", {
        expectedRevision: 0,
        elements: [{ ...rect, id: "other" }],
        removeIds: [],
      }),
    ]);
    expect(results.map((result) => result.success)).toEqual([true, false]);
    for (const args of [
      { expectedRevision: 1, elements: [rect, rect], removeIds: [] },
      {
        expectedRevision: 1,
        elements: [{ ...rect, fill: "url(https://example.com)" }],
        removeIds: [],
      },
      { expectedRevision: 1, elements: [], removeIds: ["missing"] },
    ])
      expect((await registry.executeTool("canvas_draw", args)).success).toBe(
        false,
      );
    fail(true);
    expect(
      (await registry.executeTool("canvas_clear", { expectedRevision: 1 }))
        .success,
    ).toBe(false);
    expect((await registry.executeTool("canvas_get", {})).data).toMatchObject({
      revision: 1,
    });
    fail(false);
    expect(
      (await registry.executeTool("canvas_clear", { expectedRevision: 1 }))
        .success,
    ).toBe(true);
  } finally {
    await registry.destroy();
  }
});
it("serializes the document and footer actions without callbacks", async () => {
  const { registry } = await setup();
  try {
    const slots = registry.getSlots();
    const slot = slots[0];
    expect(slot).toBeDefined();
    if (!slot) throw new Error("Missing canvas slot");
    const serialized = serializeSlotState(slot.slot.state.getState());
    expect(structuredClone(serialized)).toEqual(serialized);
    expect(serialized.panel.type).toBe("canvas");
    expect(serialized.panel.actions?.map((action) => action.id)).toEqual([
      "undo",
      "clear",
    ]);
    if (serialized.panel.type !== "canvas") throw new Error("Wrong panel");
    expect(
      canvasDocumentSchema.parse(serialized.panel.document).elements,
    ).toEqual([]);
  } finally {
    await registry.destroy();
  }
});
it("rejects corrupt stored documents", async () => {
  await expect(
    setup({ revision: 0, document: { elements: [] } }),
  ).rejects.toThrow();
});
