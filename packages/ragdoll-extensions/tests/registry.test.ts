import { describe, expect, it } from "bun:test";
import { createExtension } from "../src/create-extension.js";
import { createRegistry } from "../src/registry.js";
import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  RagdollExtension,
} from "../src/types.js";

const host: ExtensionHostEnvironment = {
  capabilities: new Set(),
};
const registryDependencies = {
  now: Date.now,
  onListenerError: () => undefined,
};

function tool(name: string) {
  return {
    definition: {
      type: "function" as const,
      function: {
        name,
        description: name,
        parameters: { type: "object" as const, properties: {} },
      },
    },
    handler: () => ({ success: true }),
  };
}

function extension(
  id: string,
  contribution: ExtensionRuntimeContribution,
): RagdollExtension {
  return {
    manifest: {
      id,
      name: id,
      version: "1.0.0",
      requiredCapabilities: [],
      optionalCapabilities: [],
    },
    activate: () => contribution,
  };
}

describe("ExtensionRegistry lifecycle", () => {
  it("disposes a createExtension runtime exactly once", async () => {
    let disposeCount = 0;
    const registry = createRegistry(registryDependencies);
    const instance = createExtension({
      id: "lifecycle",
      name: "Lifecycle",
      version: "1.0.0",
      createRuntime: () => ({
        tools: [tool("lifecycleTool")],
        dispose: () => {
          disposeCount += 1;
        },
      }),
    });

    await registry.register(instance, { host });
    await registry.unregister("lifecycle");

    expect(disposeCount).toBe(1);
  });

  it("cleans up an activated contribution when registration fails", async () => {
    let disposeCount = 0;
    let deactivateCount = 0;
    const registry = createRegistry(registryDependencies);
    await registry.register(
      extension("owner", { tools: [tool("sharedTool")] }),
      { host },
    );

    const conflicting: RagdollExtension = {
      manifest: {
        id: "conflict",
        name: "Conflict",
        version: "1.0.0",
        requiredCapabilities: [],
        optionalCapabilities: [],
      },
      activate: () => ({
        tools: [tool("sharedTool")],
        dispose: () => {
          disposeCount += 1;
        },
      }),
      deactivate: () => {
        deactivateCount += 1;
      },
    };

    await expect(registry.register(conflicting, { host })).rejects.toThrow(
      "conflicts",
    );
    expect(disposeCount).toBe(1);
    expect(deactivateCount).toBe(1);
    expect(registry.has("conflict")).toBe(false);
    expect(registry.hasTool("sharedTool")).toBe(true);
  });

  it("cleans every extension when one destroy hook fails", async () => {
    const registry = createRegistry(registryDependencies);
    await registry.register(
      extension("broken-cleanup", {
        tools: [tool("brokenTool")],
        dispose: () => {
          throw new Error("cleanup failed");
        },
      }),
      { host },
    );
    await registry.register(
      extension("healthy-cleanup", { tools: [tool("healthyTool")] }),
      {
        host,
      },
    );

    await expect(registry.destroy()).rejects.toThrow("cleanup failed");
    expect(registry.getExtensionIds()).toEqual([]);
    expect(registry.getAllTools()).toEqual([]);
    expect(registry.getStats().listenerCount).toBe(0);
  });
});

describe("ExtensionRegistry capability integrity", () => {
  it("rejects duplicate capabilities within one contribution", async () => {
    const registry = createRegistry(registryDependencies);
    const duplicate = extension("duplicate", {
      tools: [tool("same"), tool("same")],
    });

    await expect(registry.register(duplicate, { host })).rejects.toThrow(
      "duplicate",
    );
    expect(registry.has("duplicate")).toBe(false);
    expect(registry.hasTool("same")).toBe(false);
  });

  it("rejects slot conflicts without overwriting the owner", async () => {
    const registry = createRegistry(registryDependencies);
    const state = {
      getState: () => ({
        badge: null,
        visible: true,
        panel: { type: "list" as const, title: "Panel", items: [] },
      }),
      subscribe: () => () => {},
    };
    await registry.register(
      extension("first", {
        slots: [
          {
            id: "shared.slot",
            label: "First",
            icon: "star",
            priority: 0,
            state,
          },
        ],
      }),
      { host },
    );

    await expect(
      registry.register(
        extension("second", {
          slots: [
            {
              id: "shared.slot",
              label: "Second",
              icon: "star",
              priority: 0,
              state,
            },
          ],
        }),
        { host },
      ),
    ).rejects.toThrow("conflicts");

    expect(registry.getSlot("shared.slot")?.extensionId).toBe("first");
    expect(registry.has("second")).toBe(false);
  });

  it("turns validator exceptions into failed validation and execution results", async () => {
    const registry = createRegistry(registryDependencies);
    await registry.register(
      extension("validator", {
        tools: [
          {
            ...tool("fragile"),
            validate: () => {
              throw new Error("validator crashed");
            },
          },
        ],
      }),
      { host },
    );

    expect(registry.validateTool("fragile", {})).toEqual({
      valid: false,
      error: "validator crashed",
    });
    expect(await registry.executeTool("fragile", {})).toEqual({
      success: false,
      error: "validator crashed",
    });
  });
});
