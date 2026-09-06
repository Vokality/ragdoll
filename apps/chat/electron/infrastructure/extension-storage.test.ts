import { afterEach, expect, it } from "bun:test";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExtensionStorage } from "./extension-storage.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function createStorage() {
  const root = await mkdtemp(join(tmpdir(), "ragdoll-extension-storage-"));
  roots.push(root);
  return { root, storage: new ExtensionStorage(root) };
}

it("serializes mutations across handles for the same extension and reads pending writes", async () => {
  const { storage } = await createStorage();
  const first = storage.forExtension("tasks");
  const second = storage.forExtension("tasks");
  const writes = Array.from({ length: 20 }, (_, index) =>
    (index % 2 ? first : second).write("tasks", String(index), index),
  );
  const removed = second.delete("tasks", "0");
  expect(await first.list("tasks")).toHaveLength(19);
  await Promise.all([...writes, removed]);
  for (let index = 1; index < 20; index++)
    expect(await first.read("tasks", String(index))).toBe(index);
  expect(await first.read("tasks", "0")).toBeUndefined();
});

it("snapshots caller values and writes private files", async () => {
  const { root, storage } = await createStorage();
  const host = storage.forExtension("tasks");
  const value = { tasks: ["original"] };
  const write = host.write("tasks", "state", value);
  value.tasks.push("changed later");
  await write;
  expect(await host.read("tasks", "state")).toEqual({ tasks: ["original"] });
  expect((await stat(join(root, "tasks", "storage.json"))).mode & 0o777).toBe(
    0o600,
  );
});

it("treats prototype names as ordinary keys and isolates extension owners", async () => {
  const { storage } = await createStorage();
  const host = storage.forExtension("tasks");
  expect(await host.read("tasks", "constructor")).toBeUndefined();
  expect(await host.read("tasks", "__proto__")).toBeUndefined();
  await host.write("tasks", "__proto__", { saved: true });
  expect(await host.read("tasks", "__proto__")).toEqual({ saved: true });
  await expect(host.read("other", "state")).rejects.toThrow("cannot access");
  for (const owner of [
    "",
    ".",
    "..",
    "../other",
    "other/file",
    "other\\file",
  ]) {
    expect(() => storage.forExtension(owner)).toThrow(
      "Invalid extension storage owner",
    );
  }
});

it("preserves malformed documents and recovers its queue after failures", async () => {
  const { root, storage } = await createStorage();
  const host = storage.forExtension("tasks");
  const file = join(root, "tasks", "storage.json");
  await mkdir(join(root, "tasks"));
  await writeFile(file, "corrupt document");
  await expect(host.write("tasks", "state", {})).rejects.toThrow();
  expect(await readFile(file, "utf8")).toBe("corrupt document");
  await writeFile(file, "{}");
  await expect(host.write("tasks", "state", undefined)).rejects.toThrow(
    "JSON value",
  );
  await host.write("tasks", "state", { valid: true });
  expect(await host.read("tasks", "state")).toEqual({ valid: true });
});
