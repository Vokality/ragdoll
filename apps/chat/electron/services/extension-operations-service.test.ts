import { expect, test } from "bun:test";
import { ExtensionOperationsService } from "./extension-operations-service.js";

type Manager = ConstructorParameters<typeof ExtensionOperationsService>[0];
type Installer = ConstructorParameters<typeof ExtensionOperationsService>[1];

function fixture(overrides: Partial<Installer>) {
  const calls: string[] = [];
  const manager: Manager = {
    getAvailableExtensions: () => [
      {
        id: "example",
        packageName: "example",
        name: "Example",
        description: "",
        canDisable: true,
        hasConfigSchema: false,
        hasOAuth: false,
      },
    ],
    getDiscoveredExtensions: () => [],
    discoverAndLoadPackages: async () => [],
    unloadPackage: async (name) => {
      calls.push(`unload:${name}`);
      return true;
    },
    loadPackage: async (name) => {
      calls.push(`load:${name}`);
      return { success: true, extensionId: "example", packageName: name };
    },
    getDisabledExtensions: () => [],
    setDisabledExtensions: async () => {},
  };
  const installer: Installer = {
    installFromGitHub: async () => ({ success: false, error: "unused" }),
    uninstall: async () => ({ success: true }),
    getInstalledExtensions: async () => [],
    checkForUpdates: async () => [],
    prepareUpdate: async () => ({ success: false, error: "unused" }),
    ...overrides,
  };
  return {
    calls,
    service: new ExtensionOperationsService(manager, installer, {
      update: async () => {
        throw new Error("unused");
      },
    }),
  };
}

test("failed uninstall restores the previously loaded extension", async () => {
  for (const uninstall of [
    async () => ({ success: false as const, error: "missing" }),
    async () => {
      throw new Error("disk error");
    },
  ]) {
    const { service, calls } = fixture({ uninstall });
    expect((await service.uninstall("example")).success).toBe(false);
    expect(calls).toEqual(["unload:example", "load:example"]);
  }
});

test("update preparation exception restores the previously loaded extension", async () => {
  const { service, calls } = fixture({
    prepareUpdate: async () => {
      throw new Error("Cannot create backup");
    },
  });
  expect(await service.update("example")).toEqual({
    success: false,
    error: "Cannot create backup",
  });
  expect(calls).toEqual(["unload:example", "load:example"]);
});

test("successful uninstall stays unloaded", async () => {
  const { service, calls } = fixture({});
  expect(await service.uninstall("example")).toEqual({ success: true });
  expect(calls).toEqual(["unload:example"]);
});
