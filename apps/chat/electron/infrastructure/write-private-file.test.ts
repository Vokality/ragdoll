import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readdir,
  rm,
  writeFile,
  readFile,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePrivateFile } from "./write-private-file.js";

test("a failed replacement preserves the destination and cleans its temporary file", async () => {
  const root = await mkdtemp(join(tmpdir(), "private-write-test-"));
  try {
    const target = join(root, "target");
    await mkdir(target);
    await writeFile(join(target, "keep"), "original");
    await expect(writePrivateFile(target, "replacement")).rejects.toThrow();
    expect(await readFile(join(target, "keep"), "utf8")).toBe("original");
    expect(await readdir(root)).toEqual(["target"]);
    const file = join(root, "private.json");
    await writePrivateFile(file, "new");
    expect(await readFile(file, "utf8")).toBe("new");
    if (process.platform !== "win32")
      expect((await stat(file)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
