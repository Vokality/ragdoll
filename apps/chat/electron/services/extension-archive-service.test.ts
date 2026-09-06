import { createHash } from "node:crypto";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "tar";
import { describe, expect, it } from "bun:test";
import { ExtensionArchiveService } from "./extension-archive-service.js";

async function packedExtension(): Promise<{ bytes: Uint8Array; sha256: string }> {
  const root = await mkdtemp(join(tmpdir(), "ragdoll-archive-src-"));
  const packageDir = join(root, "package");
  await mkdir(packageDir);
  await writeFile(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "example", version: "1.0.0" }),
  );
  const archivePath = join(root, "extension.tar.gz");
  await create(
    {
      gzip: true,
      file: archivePath,
      cwd: root,
    },
    ["package"],
  );
  const bytes = await readFile(archivePath);
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

describe("ExtensionArchiveService", () => {
  it("extracts an archive whose sha256 matches the GitHub digest", async () => {
    const { bytes, sha256 } = await packedExtension();
    const service = new ExtensionArchiveService(
      async () => new Response(bytes),
    );
    const destination = await mkdtemp(join(tmpdir(), "ragdoll-archive-out-"));
    await service.downloadAndExtract(
      "https://example.test/extension.tar.gz",
      join(destination, "extension.tar.gz"),
      join(destination, "extracted"),
      sha256,
    );
    const manifest = await readFile(
      join(destination, "extracted", "package.json"),
      "utf8",
    );
    expect(JSON.parse(manifest)).toEqual({ name: "example", version: "1.0.0" });
  });

  it("rejects a mismatched digest before extraction", async () => {
    const { bytes } = await packedExtension();
    const service = new ExtensionArchiveService(
      async () => new Response(bytes),
    );
    const destination = await mkdtemp(join(tmpdir(), "ragdoll-archive-bad-"));
    await expect(
      service.downloadAndExtract(
        "https://example.test/extension.tar.gz",
        join(destination, "extension.tar.gz"),
        join(destination, "extracted"),
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).rejects.toThrow("digest does not match");
  });
});
