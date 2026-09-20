import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionPackageFileSystem } from "../infrastructure/extension-package-file-system.js";
import { ExtensionStorage } from "../infrastructure/extension-storage.js";
import { BUILT_IN_EXTENSIONS } from "../built-in-extensions.js";
import { ExtensionManager } from "./extension-manager.js";
import { ExtensionMessageBus } from "./extension-message-bus.js";
import { createHostSchedulerCapability } from "./host-scheduler-capability.js";
import { createHostTimersCapability } from "./host-timers-capability.js";

const roots: string[] = [];
let imports = 0;
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writePackage(
  root: string,
  id: string,
  version: string,
  toolName: string,
): Promise<void> {
  const path = join(root, id);
  await mkdir(join(path, "dist"), { recursive: true });
  await writeFile(
    join(path, "package.json"),
    JSON.stringify({
      name: id,
      version,
      type: "module",
      ragdollExtension: {
        id,
        canDisable: true,
        name: id,
        entry: "./dist/index.js",
        capabilities: ["tools"],
        requiredCapabilities: [],
        optionalCapabilities: [],
      },
    }),
  );
  await writeFile(
    join(path, "dist", "index.js"),
    `export function createExtension() {
      return {
        manifest: { id: ${JSON.stringify(id)}, name: ${JSON.stringify(id)}, version: ${JSON.stringify(version)}, capabilities: ["tools"], requiredCapabilities: [], optionalCapabilities: [] },
        activate: () => ({
          tools: [{
            definition: { type: "function", function: { name: ${JSON.stringify(toolName)}, description: "probe", parameters: { type: "object", properties: {} } } },
            handler: async () => ({ success: true }),
          }],
        }),
      };
    }`,
  );
}

function createManager(root: string, disabledExtensions: string[] = []) {
  const errors: unknown[][] = [];
  const timers = createHostTimersCapability();
  const notes = BUILT_IN_EXTENSIONS.filter(
    ({ descriptor }) => descriptor.extensionId === "notes",
  );
  const manager = new ExtensionManager({
    packageRoots: [{ path: root, layout: "installed" }],
    builtInExtensions: notes,
    fileSystem: createExtensionPackageFileSystem(),
    // Bun's module cache ignores the query string the host relies on under
    // Node, so import a uniquely named copy to stand in for it here.
    importModule: async (modulePath) => {
      const copy = `${modulePath}.${(imports += 1)}.mjs`;
      await writeFile(copy, await readFile(modulePath, "utf8"));
      return import(copy);
    },
    storage: new ExtensionStorage(root),
    messageBus: new ExtensionMessageBus(() => undefined),
    conversationEvents: { publish: async () => ({ eventId: "event-id" }) },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: (...args) => errors.push(args),
    },
    timers,
    scheduler: createHostSchedulerCapability(timers),
    request: fetch,
    now: Date.now,
    hostData: {
      loadConfig: async () => null,
      saveConfig: async () => undefined,
      loadOAuthTokens: async () => null,
      saveOAuthTokens: async () => undefined,
      clearOAuthTokens: async () => undefined,
    },
    oauthRedirects: {
      createSession: async () => {
        throw new Error("OAuth redirect was not expected");
      },
      destroy: () => undefined,
    },
    disabledExtensions,
    openExternal: async () => {},
    events: {
      slotStateChanged: () => undefined,
      slotsChanged: () => undefined,
      oauthConnected: () => undefined,
      oauthFailed: () => undefined,
    },
  });
  return { manager, errors };
}

const toolNames = (manager: ExtensionManager, extensionId: string) =>
  manager.getToolsForExtension(extensionId).map((tool) => tool.function.name);

describe("ExtensionManager user packages", () => {
  it("starts and loads healthy packages when another package is broken", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumen-packages-"));
    roots.push(root);
    // Claims the id of a built-in extension.
    await writePackage(root, "notes", "1.0.0", "impostor_tool");
    await writePackage(root, "healthy", "1.0.0", "healthy_tool");
    const { manager, errors } = createManager(root);
    try {
      await manager.initialize();

      expect(toolNames(manager, "healthy")).toEqual(["healthy_tool"]);
      expect(toolNames(manager, "notes")).not.toContain("impostor_tool");
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      await manager.destroy();
    }
  });

  it("runs the new code and metadata after a package is replaced on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumen-packages-"));
    roots.push(root);
    await writePackage(root, "demo", "1.0.0", "demo_v1");
    const { manager } = createManager(root);
    try {
      await manager.initialize();
      expect(toolNames(manager, "demo")).toEqual(["demo_v1"]);

      expect(await manager.unloadPackage("demo")).toBe(true);
      await writePackage(root, "demo", "2.0.0", "demo_v2");
      await manager.forgetPackage("demo");
      const results = await manager.discoverAndLoadPackages();

      expect(results).toMatchObject([{ extensionId: "demo", success: true }]);
      expect(toolNames(manager, "demo")).toEqual(["demo_v2"]);
    } finally {
      await manager.destroy();
    }
  });

  it("ignores saved disabled ids of extensions that no longer exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumen-packages-"));
    roots.push(root);
    await writePackage(root, "demo", "1.0.0", "demo_tool");
    const { manager } = createManager(root, ["uninstalled"]);
    try {
      await manager.initialize();

      await manager.setDisabledExtensions(["uninstalled", "demo"]);

      expect(manager.getDisabledExtensions()).toEqual(["demo"]);
      expect(toolNames(manager, "demo")).toEqual([]);
    } finally {
      await manager.destroy();
    }
  });
});
