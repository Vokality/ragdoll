import { describe, expect, it } from "bun:test";
import {
  createRegistry,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { createExtension } from "./index.js";
import { MAX_NOTES } from "./notes-state.js";

const REQUIRED_CAPABILITIES = ["storage", "logger"] as const;

async function setup(initial?: unknown) {
  let saved: unknown = initial;
  let fail = false;
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
  };
  const registry = createRegistry({
    now: Date.now,
    onListenerError: () => undefined,
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

describe("Notes", () => {
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
              notes: [
                {
                  id: "same",
                  title: "One",
                  body: "First",
                  createdAt: 1,
                  updatedAt: 1,
                },
                {
                  id: "same",
                  title: "Two",
                  body: "Second",
                  createdAt: 1,
                  updatedAt: 1,
                },
              ],
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
        },
        { instanceId: "notes-test", createdAt: 0 },
      ),
    ).rejects.toThrow("Note IDs must be unique");
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
    };
    const loading = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await loading.register(createExtension(), { host });
    expect(reads).toEqual([{ extensionId: "notes", key: "state" }]);
    await loading.destroy();
  });

  it("keeps in-memory state unchanged when storage rejects a write", async () => {
    const { registry, fail } = await setup();
    try {
      fail(true);
      expect(
        (
          await registry.executeTool("notes_write", {
            title: "Weekend plan",
            body: "Saturday: market",
          })
        ).success,
      ).toBe(false);
      expect((await registry.executeTool("notes_list", {})).data).toEqual({
        selectedNoteId: null,
        notes: [],
      });
    } finally {
      await registry.destroy();
    }
  });

  it("rejects malformed arguments without writing", async () => {
    const { registry, saved } = await setup();
    try {
      for (const args of [
        { title: 42, body: "Hello" },
        { title: "Note", body: "" },
        { noteId: "missing" },
        {},
      ]) {
        expect((await registry.executeTool("notes_write", args)).success).toBe(
          false,
        );
      }
      expect(
        (await registry.executeTool("notes_get", {})).success,
      ).toBe(false);
      expect(saved()).toBeUndefined();
    } finally {
      await registry.destroy();
    }
  });

  it("writes a note onto the document slot and returns to the list on back", async () => {
    const { registry, saved } = await setup();
    try {
      const original = {
        id: "weekend",
        title: "Weekend plan",
        body: "Saturday: market\nSunday: rest",
      };
      const written = await registry.executeTool("notes_write", original);
      expect(written.success).toBe(true);
      original.body = "mutated";
      expect(written.data).toMatchObject({
        id: "weekend",
        title: "Weekend plan",
        excerpt: "Saturday: market Sunday: rest",
      });
      expect(written.data).not.toHaveProperty("body");

      const slot = registry.getSlots()[0]?.slot;
      if (!slot) throw new Error("notes slot was not registered");
      expect(slot.id).toBe("notes.main");
      const document = slot.state.getState().panel;
      expect(document.type).toBe("document");
      if (document.type !== "document") throw new Error("expected document");
      expect(document.title).toBe("Weekend plan");
      expect(document.body).toBe("Saturday: market\nSunday: rest");
      expect(document.status?.label).toBe("1 note");
      const storedAfterWrite = saved();
      expect(storedAfterWrite).toMatchObject({
        notes: [
          {
            id: "weekend",
            title: "Weekend plan",
            body: "Saturday: market\nSunday: rest",
          },
        ],
      });
      expect(storedAfterWrite).not.toHaveProperty("selectedNoteId");

      await document.actions?.find((action) => action.id === "back")?.onClick();
      const list = slot.state.getState().panel;
      expect(list.type).toBe("list");
      if (list.type !== "list") throw new Error("expected list");
      expect(list.items?.[0]?.label).toBe("Weekend plan");
      expect(list.items?.[0]?.sublabel).toBe(
        "Saturday: market Sunday: rest",
      );
      expect(saved()).toEqual(storedAfterWrite);
      await list.items?.[0]?.onClick?.();
      expect(slot.state.getState().panel.type).toBe("document");

      expect(
        (await registry.executeTool("notes_get", { noteId: "weekend" })).data,
      ).toMatchObject({
        id: "weekend",
        body: "Saturday: market\nSunday: rest",
      });

      await slot.state
        .getState()
        .panel.actions?.find((action) => action.id === "delete:weekend")
        ?.onClick();
      const cleared = slot.state.getState().panel;
      expect(cleared.type).toBe("list");
      if (cleared.type !== "list") throw new Error("expected list");
      expect(cleared.items).toEqual([]);
      expect(saved()).toEqual({ notes: [] });
    } finally {
      await registry.destroy();
    }
  });

  it("ignores a stored selectedNoteId and starts on the list", async () => {
    const { registry } = await setup({
      notes: [
        {
          id: "weekend",
          title: "Weekend plan",
          body: "Saturday: market",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      selectedNoteId: "gone",
    });
    try {
      const slot = registry.getSlots()[0]?.slot;
      if (!slot) throw new Error("notes slot was not registered");
      const panel = slot.state.getState().panel;
      expect(panel.type).toBe("list");
      if (panel.type !== "list") throw new Error("expected list");
      expect(panel.items?.[0]?.label).toBe("Weekend plan");
    } finally {
      await registry.destroy();
    }
  });

  it("does not persist a miss when deleting an unknown note", async () => {
    const { registry, saved } = await setup();
    try {
      await registry.executeTool("notes_write", {
        id: "weekend",
        title: "Weekend plan",
        body: "Saturday: market",
      });
      const before = saved();
      expect(
        (
          await registry.executeTool("notes_delete", {
            noteId: "missing",
          })
        ).success,
      ).toBe(false);
      expect(saved()).toEqual(before);
    } finally {
      await registry.destroy();
    }
  });

  it("rejects a new note when the collection is full", async () => {
    const { registry } = await setup();
    try {
      for (let index = 0; index < MAX_NOTES; index += 1) {
        const result = await registry.executeTool("notes_write", {
          id: `note-${index}`,
          title: `Note ${index}`,
          body: "Body",
        });
        expect(result.success).toBe(true);
      }
      expect(
        (
          await registry.executeTool("notes_write", {
            title: "Overflow",
            body: "Too many",
          })
        ).success,
      ).toBe(false);
      const listed = await registry.executeTool("notes_list", {});
      const data = listed.data;
      if (
        !data ||
        typeof data !== "object" ||
        !("notes" in data) ||
        !Array.isArray(data.notes)
      ) {
        throw new Error("expected notes list");
      }
      expect(data.notes).toHaveLength(MAX_NOTES);
    } finally {
      await registry.destroy();
    }
  });
});
