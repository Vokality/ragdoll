import { expect, test } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ExtensionOperationsService } from "./extension-operations-service.js";

type Manager = ConstructorParameters<typeof ExtensionOperationsService>[0];
type Installer = ConstructorParameters<typeof ExtensionOperationsService>[1];

const example = {
  id: "example",
  packageName: "example",
  name: "Example",
  description: "",
  canDisable: true,
  hasConfigSchema: false,
  hasOAuth: false,
};

function fixture(
  overrides: Partial<Installer>,
  managerOverrides: Partial<Manager> = {},
) {
  const calls: string[] = [];
  const saved: string[][] = [];
  const storage = createInMemoryStorageRepository();
  let disabled: string[] = [];
  const manager: Manager = {
    getAvailableExtensions: () => [example],
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
    forgetPackage: async (name) => {
      calls.push(`forget:${name}`);
    },
    getDisabledExtensions: () => disabled,
    setDisabledExtensions: async (ids) => {
      disabled = [...ids];
    },
    ...managerOverrides,
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
    saved,
    service: new ExtensionOperationsService(manager, installer, {
      update: async (recipe) => {
        const data = await storage.update(recipe);
        saved.push(data.settings.disabledExtensions);
        return data;
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

test("uninstalling a disabled extension removes it from the saved disabled list", async () => {
  const { service, calls, saved } = fixture(
    {},
    {
      getAvailableExtensions: () => [],
      getDiscoveredExtensions: () => [example],
    },
  );
  await service.setDisabled(["example", "other"]);

  expect(await service.uninstall("example")).toEqual({ success: true });

  expect(calls).toEqual(["forget:example"]);
  expect(saved.at(-1)).toEqual(["other"]);
});

test("a disabled extension updates without being loaded", async () => {
  const settled: string[] = [];
  const { service, calls } = fixture(
    {
      prepareUpdate: async () => ({
        result: {
          success: true,
          extensionId: "example",
          name: "Example",
          version: "2.0.0",
        },
        commit: async () => void settled.push("commit"),
        rollback: async () => void settled.push("rollback"),
      }),
    },
    {
      getAvailableExtensions: () => [],
      getDiscoveredExtensions: () => [example],
    },
  );

  expect(await service.update("example")).toMatchObject({
    success: true,
    version: "2.0.0",
  });
  expect(settled).toEqual(["commit"]);
  expect(calls).toEqual(["forget:example"]);
});

test("a failed rollback is reported instead of rejecting the request", async () => {
  const { service } = fixture({
    prepareUpdate: async () => ({
      result: {
        success: true,
        extensionId: "example",
        name: "Example",
        version: "2.0.0",
      },
      commit: async () => {},
      rollback: async () => {
        throw new Error("disk full");
      },
    }),
  });

  const result = await service.update("example");

  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected a failed update");
  expect(result.error).toContain("disk full");
});

test("an install the host cannot activate is removed again", async () => {
  const removed: string[] = [];
  const { service } = fixture(
    {
      installFromGitHub: async () => ({
        success: true,
        extensionId: "example",
        name: "Example",
        version: "1.0.0",
      }),
      uninstall: async (id) => {
        removed.push(id);
        return { success: true };
      },
    },
    {
      discoverAndLoadPackages: async () => {
        throw new Error("duplicate id");
      },
    },
  );

  expect(await service.install("https://github.com/example/example")).toEqual({
    success: false,
    error: "duplicate id",
  });
  expect(removed).toEqual(["example"]);
});
