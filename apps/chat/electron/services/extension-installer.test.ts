import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExtensionInstaller,
  type ExtensionInstallerConfig,
} from "./extension-installer.js";
import type { InstalledExtension } from "../electron-api.js";

async function fixture(
  releaseId = "example",
  resolveRelease?: ExtensionInstallerConfig["releases"]["resolve"],
) {
  const root = await mkdtemp(join(tmpdir(), "ragdoll-installer-test-"));
  const path = join(root, "example");
  await mkdir(path);
  await writeFile(join(path, "version.txt"), "old");
  const original: InstalledExtension = {
    id: "example",
    name: "Example",
    description: "",
    version: "1.0.0",
    path,
    repoUrl: "https://github.com/example/example",
    installedAt: new Date(0).toISOString(),
  };
  const entries = new Map([[original.id, original]]);
  let rejectRestore = false;
  const installer = new ExtensionInstaller({
    extensionsPath: root,
    repository: {
      get: async (id) => entries.get(id) ?? null,
      list: async () => [...entries.values()],
      delete: async (id) => {
        entries.delete(id);
      },
      set: async (entry) => {
        if (rejectRestore && entry.version === "1.0.0") {
          rejectRestore = false;
          throw new Error("Registry write failed");
        }
        entries.set(entry.id, entry);
      },
    },
    releases: {
      resolve:
        resolveRelease ??
        (async () => ({
          repoUrl: original.repoUrl,
          tag: "v2.0.0",
          downloadUrl:
            "https://github.com/example/example/releases/download/v2.0.0/package.tar.gz",
        })),
    },
    archives: {
      downloadAndExtract: async (_url, _archive, destination) => {
        await mkdir(destination, { recursive: true });
        await writeFile(join(destination, "version.txt"), "new");
        await writeFile(
          join(destination, "package.json"),
          JSON.stringify({
            name: "example",
            version: "2.0.0",
            ragdollExtension: {
              id: releaseId,
              canDisable: true,
              name: "Example",
              entry: "./dist/index.js",
              capabilities: ["tools"],
              requiredCapabilities: [],
              optionalCapabilities: [],
            },
          }),
        );
      },
    },
    createId: () => crypto.randomUUID(),
    now: () => 1,
    logger: console,
  });
  return {
    root,
    path,
    entries,
    original,
    installer,
    failRestore: () => {
      rejectRestore = true;
    },
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

test("an update cannot install a release with another extension id", async () => {
  const f = await fixture("different");
  try {
    const result = await f.installer.prepareUpdate("example");
    if (!("success" in result)) throw new Error("Expected an invalid update");
    expect(result.error).toContain("does not match");
    expect(await readFile(join(f.path, "version.txt"), "utf8")).toBe("old");
    expect([...f.entries.keys()]).toEqual(["example"]);
    expect(await readdir(f.root)).toEqual(["example"]);
  } finally {
    await f.dispose();
  }
});

test("rollback retains its recovery copy when restoring the registry fails", async () => {
  const f = await fixture();
  try {
    const update = await f.installer.prepareUpdate("example");
    if ("success" in update) throw new Error(update.error);
    expect(await readFile(join(f.path, "version.txt"), "utf8")).toBe("new");
    f.failRestore();
    await expect(update.rollback()).rejects.toThrow("Registry write failed");
    expect(
      (await readdir(f.root)).some((name) => name.startsWith(".update-")),
    ).toBe(true);
    await update.rollback();
    expect(f.entries.get("example")).toEqual(f.original);
    expect(await readFile(join(f.path, "version.txt"), "utf8")).toBe("old");
    expect(await readdir(f.root)).toEqual(["example"]);
    await expect(update.commit()).rejects.toThrow("settled");
  } finally {
    await f.dispose();
  }
});

test("install does not silently overwrite an existing extension", async () => {
  const f = await fixture();
  try {
    const result = await f.installer.installFromGitHub(f.original.repoUrl);
    if (result.success)
      throw new Error("Expected duplicate installation to fail");
    expect(result.error).toContain("already installed");
    expect(await readFile(join(f.path, "version.txt"), "utf8")).toBe("old");
    expect(f.entries.get("example")).toEqual(f.original);
  } finally {
    await f.dispose();
  }
});

test("committing an update keeps the new package and removes its recovery copy", async () => {
  const f = await fixture();
  try {
    const update = await f.installer.prepareUpdate("example");
    if ("success" in update) throw new Error(update.error);
    await update.commit();
    expect(f.entries.get("example")?.version).toBe("2.0.0");
    expect(await readFile(join(f.path, "version.txt"), "utf8")).toBe("new");
    expect(await readdir(f.root)).toEqual(["example"]);
    await expect(update.rollback()).rejects.toThrow("settled");
  } finally {
    await f.dispose();
  }
});

test("checks independent releases concurrently and preserves installed extension order", async () => {
  type Release = Awaited<
    ReturnType<ExtensionInstallerConfig["releases"]["resolve"]>
  >;
  const first = Promise.withResolvers<Release>();
  const second = Promise.withResolvers<Release>();
  const requests: string[] = [];
  const f = await fixture("example", (repoUrl) => {
    requests.push(repoUrl);
    return repoUrl.endsWith("/second") ? second.promise : first.promise;
  });
  const secondUrl = "https://github.com/example/second";
  f.entries.set("second", { ...f.original, id: "second", repoUrl: secondUrl });
  const checks = f.installer.checkForUpdates();
  try {
    // repository.list is the only prerequisite; neither release depends on the other.
    await Promise.resolve();
    expect(requests).toEqual([f.original.repoUrl, secondUrl]);
    second.resolve({
      repoUrl: secondUrl,
      tag: "v3.0.0",
      downloadUrl: "https://example.com/second.tar.gz",
    });
    first.resolve({
      repoUrl: f.original.repoUrl,
      tag: "v2.0.0",
      downloadUrl: "https://example.com/first.tar.gz",
    });
    expect(await checks).toMatchObject([
      { extensionId: "example", latestVersion: "2.0.0", hasUpdate: true },
      { extensionId: "second", latestVersion: "3.0.0", hasUpdate: true },
    ]);
  } finally {
    first.resolve({
      repoUrl: f.original.repoUrl,
      tag: "v2.0.0",
      downloadUrl: "https://example.com/first.tar.gz",
    });
    second.resolve({
      repoUrl: secondUrl,
      tag: "v3.0.0",
      downloadUrl: "https://example.com/second.tar.gz",
    });
    await checks;
    await f.dispose();
  }
});
