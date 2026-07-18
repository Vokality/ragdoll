import { describe, expect, it } from "bun:test";
import { createLoader, parseExtensionPackageJson } from "../src/loader.js";
import { createRegistry } from "../src/registry.js";
import type {
  ExtensionHostEnvironment,
  RagdollExtension,
} from "../src/types.js";

const host: ExtensionHostEnvironment = { capabilities: new Set() };

function packageManifest(
  id: string,
  capabilities: Array<"tools" | "slots" | "services" | "stateChannels">,
  requiredCapabilities: Array<
    | "storage"
    | "notifications"
    | "timers"
    | "scheduler"
    | "ipc"
    | "logger"
    | "oauth"
    | "config"
  > = [],
  entry = "./index.js",
) {
  return {
    id,
    name: id,
    entry,
    canDisable: true,
    capabilities,
    requiredCapabilities,
  };
}

describe("ExtensionLoader", () => {
  it("rejects incomplete and duplicate package metadata", () => {
    expect(() =>
      parseExtensionPackageJson(
        JSON.stringify({
          name: "old-package",
          version: "1.0.0",
          ragdollExtension: true,
        }),
      ),
    ).toThrow();

    expect(() =>
      parseExtensionPackageJson(
        JSON.stringify({
          name: "duplicate-package",
          version: "1.0.0",
          ragdollExtension: {
            ...packageManifest("duplicate", ["tools", "tools"]),
          },
        }),
      ),
    ).toThrow("capabilities must not contain duplicates");
  });

  it("discovers installed extensions through an explicit root layout", async () => {
    const packageJson = JSON.stringify({
      name: "@example/weather",
      version: "1.0.0",
      ragdollExtension: packageManifest("weather", ["tools"]),
    });
    const loader = createLoader(createRegistry(), {
      packageRoots: [{ path: "/extensions", layout: "installed" }],
      hostEnvironment: host,
      fileSystem: {
        pathExists: async (path) =>
          path === "/extensions" || path === "/extensions/weather/package.json",
        readFile: async () => packageJson,
        readDirectory: async () => ["weather"],
      },
    });

    expect(await loader.discoverPackages()).toEqual(["@example/weather"]);
  });

  it("resolves the declared extension entrypoint", async () => {
    let importedPath = "";
    const loadedExtension: RagdollExtension = {
      manifest: { id: "nested", name: "Nested", version: "1.0.0" },
      activate: () => ({
        tools: [
          {
            definition: {
              type: "function",
              function: {
                name: "nestedTool",
                description: "nested",
                parameters: { type: "object", properties: {} },
              },
            },
            handler: () => ({ success: true }),
          },
        ],
      }),
    };
    const packageJson = JSON.stringify({
      name: "nested-package",
      version: "1.0.0",
      ragdollExtension: packageManifest(
        "nested",
        ["tools"],
        [],
        "./dist/index.js",
      ),
    });
    const loader = createLoader(createRegistry(), {
      packageRoots: [{ path: "/extensions", layout: "packages" }],
      hostEnvironment: host,
      fileSystem: {
        pathExists: async (path) =>
          path === "/extensions/nested-package/package.json",
        readFile: async () => packageJson,
        readDirectory: async () => [],
      },
      importModule: async (path) => {
        importedPath = path;
        return { createExtension: () => loadedExtension };
      },
    });

    const result = await loader.loadPackage("nested-package");

    expect(result.success).toBe(true);
    expect(importedPath).toBe("/extensions/nested-package/dist/index.js");
    expect(loader.getLoadedPackages()).toEqual([
      { packageName: "nested-package", extensionId: "nested" },
    ]);
  });

  it("enforces host capabilities declared by the package manifest", async () => {
    const packageJson = JSON.stringify({
      name: "notifications-package",
      version: "1.0.0",
      ragdollExtension: packageManifest(
        "notifications",
        ["tools"],
        ["notifications"],
      ),
    });
    const extension: RagdollExtension = {
      manifest: {
        id: "notifications",
        name: "Notifications",
        version: "1.0.0",
      },
      activate: () => ({
        tools: [
          {
            definition: {
              type: "function",
              function: {
                name: "notify",
                description: "notify",
                parameters: { type: "object", properties: {} },
              },
            },
            handler: () => ({ success: true }),
          },
        ],
      }),
    };
    const loader = createLoader(createRegistry(), {
      packageRoots: [{ path: "/extensions", layout: "packages" }],
      hostEnvironment: host,
      fileSystem: {
        pathExists: async (path) =>
          path === "/extensions/notifications-package/package.json",
        readFile: async () => packageJson,
        readDirectory: async () => [],
      },
      importModule: async () => ({ createExtension: () => extension }),
    });

    const result = await loader.loadPackage("notifications-package");

    expect(result.success).toBe(false);
    expect(result.error).toContain("missing host capability 'notifications'");
  });

  it("rejects runtime capabilities that differ from the package manifest", async () => {
    const registry = createRegistry();
    const packageJson = JSON.stringify({
      name: "mismatched-package",
      version: "1.0.0",
      ragdollExtension: packageManifest("mismatched", ["slots"]),
    });
    const extension: RagdollExtension = {
      manifest: { id: "mismatched", name: "Mismatched", version: "1.0.0" },
      activate: () => ({
        tools: [
          {
            definition: {
              type: "function",
              function: {
                name: "unexpectedTool",
                description: "unexpected",
                parameters: { type: "object", properties: {} },
              },
            },
            handler: () => ({ success: true }),
          },
        ],
      }),
    };
    const loader = createLoader(registry, {
      packageRoots: [{ path: "/extensions", layout: "packages" }],
      hostEnvironment: host,
      fileSystem: {
        pathExists: async (path) =>
          path === "/extensions/mismatched-package/package.json",
        readFile: async () => packageJson,
        readDirectory: async () => [],
      },
      importModule: async () => ({ createExtension: () => extension }),
    });

    const result = await loader.loadPackage("mismatched-package");

    expect(result.success).toBe(false);
    expect(result.error).toContain("missing: slots; undeclared: tools");
    expect(registry.getExtension("mismatched")).toBeUndefined();
    expect(loader.isPackageLoaded("mismatched-package")).toBe(false);
  });

  it("forgets an unloaded package even when extension cleanup fails", async () => {
    const packageJson = JSON.stringify({
      name: "cleanup-package",
      version: "1.0.0",
      ragdollExtension: packageManifest("cleanup", ["tools"]),
    });
    const cleanupExtension: RagdollExtension = {
      manifest: { id: "cleanup", name: "Cleanup", version: "1.0.0" },
      activate: () => ({
        tools: [
          {
            definition: {
              type: "function",
              function: {
                name: "cleanupTool",
                description: "cleanup",
                parameters: { type: "object", properties: {} },
              },
            },
            handler: () => ({ success: true }),
          },
        ],
        dispose: () => {
          throw new Error("cleanup failed");
        },
      }),
    };
    const loader = createLoader(createRegistry(), {
      packageRoots: [{ path: "/extensions", layout: "packages" }],
      hostEnvironment: host,
      fileSystem: {
        pathExists: async (path) =>
          path === "/extensions/cleanup-package/package.json",
        readFile: async () => packageJson,
        readDirectory: async () => [],
      },
      importModule: async () => ({ createExtension: () => cleanupExtension }),
    });

    expect((await loader.loadPackage("cleanup-package")).success).toBe(true);
    await expect(loader.unloadPackage("cleanup-package")).rejects.toThrow(
      "cleanup failed",
    );
    expect(loader.isPackageLoaded("cleanup-package")).toBe(false);
  });
});
