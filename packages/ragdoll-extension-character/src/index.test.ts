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
