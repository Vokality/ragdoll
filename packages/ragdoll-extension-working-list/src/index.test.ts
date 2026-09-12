import { describe, expect, it } from "bun:test";
import {
  createRegistry,
  type ConversationEventInput,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { createExtension } from "./index.js";

const REQUIRED_CAPABILITIES = [
  "storage",
  "logger",
  "conversationEvents",
] as const;

async function setup(initial?: unknown) {
  let saved: unknown = initial;
  let fail = false;
  const published: ConversationEventInput[] = [];
  const host: ExtensionHostEnvironment = {
    capabilities: new Set(REQUIRED_CAPABILITIES),
    storage: {
      read: async () => structuredClone(saved),
      write: async (_id, _key, value) => {
        if (fail) throw new Error("storage unavailable");
        saved = structuredClone(value);
      },
      delete: async () => {},
      list: async () => [],
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    conversationEvents: {
      publish: async (event) => {
        published.push(event);
        return { eventId: `event-${published.length}` };
      },
    },
  };
  const registry = createRegistry({
    now: Date.now,
    onListenerError: () => undefined,
  });
  await registry.register(createExtension(), { host });
  return {
    registry,
    host,
    published,
    saved: () => saved,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

describe("Working list", () => {
  it("publishes its required host capabilities in package and runtime manifests", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );

    expect(descriptor?.requiredCapabilities).toEqual([
      ...REQUIRED_CAPABILITIES,
    ]);
    expect(createExtension().manifest.requiredCapabilities).toEqual([
      ...REQUIRED_CAPABILITIES,
    ]);
    expect(descriptor?.optionalCapabilities).toEqual([]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([]);
    expect(descriptor?.capabilities).toEqual(["tools", "slots"]);
  });

  it("rejects corrupt stored state before exposing tools", async () => {
    await expect(
      createExtension().activate(
        {
          capabilities: new Set(REQUIRED_CAPABILITIES),
          storage: {
            read: async () => ({
              title: "Reply next",
              items: [
                { id: "same", label: "One" },
                { id: "same", label: "Two" },
              ],
              updatedAt: 1,
            }),
            write: async () => {
              throw new Error("Corrupt state must not be overwritten");
            },
            delete: async () => {},
            list: async () => [],
          },
          logger: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
          },
          conversationEvents: {
            publish: async () => ({ eventId: "event-1" }),
          },
        },
        { instanceId: "working-list-test", createdAt: 0 },
      ),
    ).rejects.toThrow("Working list item IDs must be unique");
  });

  it("loads its initial state from required host storage", async () => {
    const reads: Array<{ extensionId: string; key: string }> = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(REQUIRED_CAPABILITIES),
      storage: {
        read: async (extensionId, key) => {
          reads.push({ extensionId, key });
          return undefined;
        },
        write: async () => undefined,
        delete: async () => undefined,
        list: async () => [],
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      conversationEvents: {
        publish: async () => ({ eventId: "event-1" }),
      },
    };
    const loading = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await loading.register(createExtension(), { host });
    expect(reads).toEqual([{ extensionId: "working-list", key: "state" }]);
    await loading.destroy();
  });

  it("keeps in-memory state unchanged when storage rejects a write", async () => {
    const { registry, fail } = await setup();
    try {
      fail(true);
      expect(
        (
          await registry.executeTool("working_list_set_items", {
            title: "Reply next",
            items: [{ id: "m1", label: "Q3 budget" }],
          })
        ).success,
      ).toBe(false);
      expect(
        (await registry.executeTool("working_list_get", {})).data,
      ).toMatchObject({ title: "To handle", items: [] });
    } finally {
      await registry.destroy();
    }
  });

  it("rejects malformed arguments without writing", async () => {
    const { registry, saved } = await setup();
    try {
      for (const args of [
        { title: 42, items: [] },
        { title: "List", items: "nope" },
        {
          title: "List",
          items: [
            { id: "a", label: "One" },
            { id: "a", label: "Two" },
          ],
        },
        {},
      ]) {
        expect(
          (await registry.executeTool("working_list_set_items", args)).success,
        ).toBe(false);
      }
      expect(
        (await registry.executeTool("working_list_remove_item", {})).success,
      ).toBe(false);
      expect(saved()).toBeUndefined();
    } finally {
      await registry.destroy();
    }
  });

  it("fills the list slot and publishes list.item.selected on click", async () => {
    const { registry, published, saved } = await setup();
    try {
      const original = {
        id: "m1",
        label: "Q3 budget",
        sublabel: "Ava · 3 days",
        ref: "email-1",
      };
      expect(
        (
          await registry.executeTool("working_list_set_items", {
            title: "Reply next",
            items: [original],
          })
        ).success,
      ).toBe(true);
      original.label = "mutated";
      expect(
        (await registry.executeTool("working_list_get", {})).data,
      ).toMatchObject({
        title: "Reply next",
        items: [
          {
            id: "m1",
            label: "Q3 budget",
            sublabel: "Ava · 3 days",
            ref: "email-1",
          },
        ],
      });

      const slot = registry.getSlots()[0]?.slot;
      if (!slot) throw new Error("working list slot was not registered");
      expect(slot.id).toBe("working-list.main");
      const panel = slot.state.getState().panel;
      expect(panel.type).toBe("list");
      if (panel.type !== "list") throw new Error("expected list");
      expect(panel.title).toBe("Reply next");
      expect(panel.status?.label).toBe("1 item");
      expect(panel.items?.[0]?.label).toBe("Q3 budget");
      await panel.items?.[0]?.onClick?.();

      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        type: "list.item.selected",
        turnPolicy: "start-turn",
        payload: {
          itemId: "m1",
          label: "Q3 budget",
          sublabel: "Ava · 3 days",
          ref: "email-1",
          title: "Reply next",
        },
      });
      expect(published[0]?.payload).not.toHaveProperty("selectionSeq");

      await panel.actions?.find((action) => action.id === "clear")?.onClick();
      const cleared = slot.state.getState().panel;
      expect(cleared.type).toBe("list");
      if (cleared.type !== "list") throw new Error("expected list");
      expect(cleared.title).toBe("To handle");
      expect(cleared.items).toEqual([]);
      expect(saved()).toMatchObject({ title: "To handle", items: [] });
    } finally {
      await registry.destroy();
    }
  });

  it("does not persist a miss when removing an unknown item", async () => {
    const { registry, saved } = await setup();
    try {
      await registry.executeTool("working_list_set_items", {
        title: "Reply next",
        items: [{ id: "m1", label: "Q3 budget" }],
      });
      const before = saved();
      expect(
        (
          await registry.executeTool("working_list_remove_item", {
            itemId: "missing",
          })
        ).success,
      ).toBe(false);
      expect(saved()).toEqual(before);
    } finally {
      await registry.destroy();
    }
  });
});
