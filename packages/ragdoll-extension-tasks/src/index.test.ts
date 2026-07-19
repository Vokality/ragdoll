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

const REQUIRED_CAPABILITIES = ["storage", "logger"];

describe("Tasks package boundaries", () => {
  it("publishes its required host capabilities in package and runtime manifests", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );

    expect(descriptor?.requiredCapabilities).toEqual(REQUIRED_CAPABILITIES);
    expect(createExtension().manifest.requiredCapabilities).toEqual(
      REQUIRED_CAPABILITIES,
    );
    expect(descriptor?.optionalCapabilities).toEqual([]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([]);
  });

  it("loads its initial state from required host storage", async () => {
    const reads: Array<{ extensionId: string; key: string }> = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
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
    const registry = createRegistry();

    await registry.register(createExtension(), { host });

    expect(reads).toEqual([{ extensionId: "tasks", key: "state" }]);
    await registry.destroy();
  });
});
