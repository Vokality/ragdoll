import { describe, expect, it } from "bun:test";
import {
  createRegistry,
  type ExtensionHostCapability,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { createExtension } from "./index.js";

function hostWithIpc(
  publish: (topic: string, payload: unknown) => void,
): ExtensionHostEnvironment {
  return {
    capabilities: new Set<ExtensionHostCapability>(["ipc"]),
    ipc: {
      publish,
      subscribe: () => () => undefined,
    },
  };
}

describe("Character package boundaries", () => {
  it("publishes its required host capabilities in package and runtime manifests", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );
    expect(descriptor?.requiredCapabilities).toEqual(["ipc"]);
    expect(createExtension().manifest.requiredCapabilities).toEqual(["ipc"]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([]);
  });

  it("forwards setMood through the owned extension-tool IPC topic", async () => {
    const published: Array<{ topic: string; payload: unknown }> = [];
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc((topic, payload) => {
        published.push({ topic, payload });
      }),
    });

    const result = await registry.executeTool("setMood", {
      mood: "smile",
      duration: 0.4,
    });

    expect(result).toEqual({
      success: true,
      data: { forwarded: true },
    });
    expect(published).toEqual([
      {
        topic: "extension-tool:character",
        payload: {
          extensionId: "character",
          tool: "setMood",
          args: { mood: "smile", duration: 0.4 },
        },
      },
    ]);
    await registry.destroy();
  });

  it("forwards setExpression through the owned extension-tool IPC topic", async () => {
    const published: Array<{ topic: string; payload: unknown }> = [];
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc((topic, payload) => {
        published.push({ topic, payload });
      }),
    });

    const result = await registry.executeTool("setExpression", {
      smile: 0.5,
      gazeX: -0.2,
      duration: 0.4,
    });

    expect(result).toEqual({
      success: true,
      data: { forwarded: true },
    });
    expect(published).toEqual([
      {
        topic: "extension-tool:character",
        payload: {
          extensionId: "character",
          tool: "setExpression",
          args: { smile: 0.5, gazeX: -0.2, duration: 0.4 },
        },
      },
    ]);
    await registry.destroy();
  });

  it("rejects non-finite setExpression fields before IPC", async () => {
    const published: unknown[] = [];
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc((_topic, payload) => published.push(payload)),
    });
    try {
      const fields = [
        "smile",
        "frown",
        "brows",
        "eyesOpen",
        "jaw",
        "gazeX",
        "gazeY",
        "duration",
      ] as const;
      for (const value of [NaN, Infinity, "-1", null]) {
        for (const field of fields) {
          expect(
            (await registry.executeTool("setExpression", { [field]: value }))
              .success,
          ).toBe(false);
        }
      }
      expect(published).toEqual([]);
    } finally {
      await registry.destroy();
    }
  });

  it("rejects out-of-range setExpression fields before IPC", async () => {
    const published: unknown[] = [];
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc((_topic, payload) => published.push(payload)),
    });
    try {
      expect(
        (await registry.executeTool("setExpression", { smile: 1.1 })).success,
      ).toBe(false);
      expect(
        (await registry.executeTool("setExpression", { eyesOpen: 1.31 }))
          .success,
      ).toBe(false);
      expect(
        (await registry.executeTool("setExpression", { brows: -1.01 })).success,
      ).toBe(false);
      expect(
        (await registry.executeTool("setExpression", { duration: 5.01 }))
          .success,
      ).toBe(false);
      expect(published).toEqual([]);
    } finally {
      await registry.destroy();
    }
  });

  it("accepts empty and in-range setExpression patches", async () => {
    const published: Array<{ topic: string; payload: unknown }> = [];
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc((topic, payload) => {
        published.push({ topic, payload });
      }),
    });
    try {
      const patches: Array<Record<string, number>> = [
        {},
        { smile: 0 },
        { eyesOpen: 1.3 },
        { duration: 0 },
      ];
      for (const args of patches) {
        expect(
          (await registry.executeTool("setExpression", args)).success,
        ).toBe(true);
      }
      expect(published).toEqual(
        patches.map((args) => ({
          topic: "extension-tool:character",
          payload: {
            extensionId: "character",
            tool: "setExpression",
            args,
          },
        })),
      );
    } finally {
      await registry.destroy();
    }
  });

  it("exposes a Grok-safe setExpression schema of optional numbers", async () => {
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension(), {
      host: hostWithIpc(() => undefined),
    });
    try {
      const tool = registry
        .getAllTools()
        .find((entry) => entry.function.name === "setExpression");
      if (!tool) throw new Error("setExpression tool was not registered");
      const parameters = tool.function.parameters;
      expect(parameters.required).toBeUndefined();
      expect("anyOf" in parameters).toBe(false);
      expect(Object.keys(parameters.properties).sort()).toEqual(
        [
          "brows",
          "duration",
          "eyesOpen",
          "frown",
          "gazeX",
          "gazeY",
          "jaw",
          "smile",
        ].sort(),
      );
      for (const property of Object.values(parameters.properties)) {
        expect(property.type).toBe("number");
        expect("anyOf" in property).toBe(false);
      }
    } finally {
      await registry.destroy();
    }
  });

  it("rejects registration when the host advertises ipc without an implementation", async () => {
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await expect(
      registry.register(createExtension(), {
        host: { capabilities: new Set(["ipc"]) },
      }),
    ).rejects.toThrow("without an implementation");
  });
});

it("rejects non-finite and out-of-range character parameters before IPC", async () => {
  const published: unknown[] = [];
  const registry = createRegistry({
    now: Date.now,
    onListenerError: () => undefined,
  });
  await registry.register(createExtension(), {
    host: hostWithIpc((_topic, payload) => published.push(payload)),
  });
  try {
    for (const value of [NaN, Infinity, -Infinity, "1", null]) {
      for (const [name, args] of [
        ["setMood", { mood: "smile", duration: value }],
        ["triggerAction", { action: "wink", duration: value }],
        ["setHeadPose", { yawDegrees: value }],
        ["setHeadPose", { pitchDegrees: value }],
        ["setHeadPose", { duration: value }],
      ] satisfies Array<[string, Record<string, unknown>]>) {
        expect((await registry.executeTool(name, args)).success).toBe(false);
      }
    }
    expect(
      (await registry.executeTool("setHeadPose", { yawDegrees: 36 })).success,
    ).toBe(false);
    expect(published).toEqual([]);
    expect(
      (await registry.executeTool("setMood", { mood: "smile", duration: 0 }))
        .success,
    ).toBe(true);
    expect(
      (
        await registry.executeTool("setHeadPose", {
          yawDegrees: -35,
          pitchDegrees: 20,
          duration: 2,
        })
      ).success,
    ).toBe(true);
    expect(published).toHaveLength(2);
  } finally {
    await registry.destroy();
  }
});
