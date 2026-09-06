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
