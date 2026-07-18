import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { HostStorageCapability } from "@vokality/ragdoll-extensions";

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export class ExtensionStorage {
  constructor(private readonly rootPath: string) {}

  forExtension(extensionId: string): HostStorageCapability {
    const assertOwner = (requestedExtensionId: string): void => {
      if (requestedExtensionId !== extensionId) {
        throw new Error(
          `Extension '${extensionId}' cannot access '${requestedExtensionId}' storage`,
        );
      }
    };

    return {
      read: async <T>(requestedExtensionId: string, key: string) => {
        assertOwner(requestedExtensionId);
        return (await this.readAll(extensionId))[key] as T | undefined;
      },
      write: async <T>(requestedExtensionId: string, key: string, value: T) => {
        assertOwner(requestedExtensionId);
        const data = await this.readAll(extensionId);
        data[key] = value;
        await this.writeAll(extensionId, data);
      },
      delete: async (requestedExtensionId: string, key: string) => {
        assertOwner(requestedExtensionId);
        const data = await this.readAll(extensionId);
        delete data[key];
        await this.writeAll(extensionId, data);
      },
      list: async (requestedExtensionId: string) => {
        assertOwner(requestedExtensionId);
        return Object.keys(await this.readAll(extensionId));
      },
    };
  }

  private filePath(extensionId: string): string {
    return join(this.rootPath, extensionId, "storage.json");
  }

  private async readAll(extensionId: string): Promise<Record<string, unknown>> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.filePath(extensionId), "utf8"),
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Invalid storage document for '${extensionId}'`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (isMissingFile(error)) return {};
      throw error;
    }
  }

  private async writeAll(
    extensionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const filePath = this.filePath(extensionId);
    const temporaryPath = `${filePath}.tmp`;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
    try {
      await rename(temporaryPath, filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}
