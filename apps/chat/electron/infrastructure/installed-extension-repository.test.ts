import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstalledExtensionRepository } from "./installed-extension-repository.js";

test("missing inherited-property names are not installed extensions", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-registry-test-"));
  try {
    const repository = new InstalledExtensionRepository(
      join(root, "registry.json"),
      root,
    );
    for (const id of ["constructor", "toString", "__proto__"])
      expect(await repository.get(id)).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects registry key/id disagreement before deriving an extension path", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-registry-test-"));
  try {
    const file = join(root, "registry.json");
    await writeFile(
      file,
      JSON.stringify({
        extensions: {
          wrong: {
            id: "actual",
            name: "Example",
            version: "1.0.0",
            description: "",
            repoUrl: "https://github.com/example/example",
            installedAt: new Date(0).toISOString(),
          },
        },
      }),
    );
    const repository = new InstalledExtensionRepository(file, root);
    await expect(repository.get("wrong")).rejects.toThrow("keys must match");
    await expect(repository.list()).rejects.toThrow("keys must match");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
