import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HostStorageCapability } from "@vokality/ragdoll-extensions";
import { writePrivateFile } from "./write-private-file.js";

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class ExtensionStorage {
  private readonly updates = new Map<string, Promise<void>>();
  constructor(private readonly rootPath: string) {}

  forExtension(extensionId: string): HostStorageCapability {
    if (
      !extensionId ||
      extensionId === "." ||
      extensionId === ".." ||
      /[\\/\0]/.test(extensionId)
    ) {
      throw new Error("Invalid extension storage owner");
    }
    const assertOwner = (requestedExtensionId: string): void => {
      if (requestedExtensionId !== extensionId) {
        throw new Error(
          `Extension '${extensionId}' cannot access '${requestedExtensionId}' storage`,
        );
      }
    };

    return {
      read: async (requestedExtensionId: string, key: string) => {
        assertOwner(requestedExtensionId);
        await this.updates.get(extensionId);
        const data = await this.readAll(extensionId);
        return Object.hasOwn(data, key) ? data[key] : undefined;
      },
      write: async (
        requestedExtensionId: string,
        key: string,
        value: unknown,
      ) => {
        assertOwner(requestedExtensionId);
        const encoded = JSON.stringify(value);
        if (encoded === undefined)
          throw new Error("Extension storage requires a JSON value");
        const snapshot: unknown = JSON.parse(encoded);
        await this.update(extensionId, (data) => {
          Object.defineProperty(data, key, {
            value: snapshot,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        });
      },
      delete: async (requestedExtensionId: string, key: string) => {
        assertOwner(requestedExtensionId);
        await this.update(extensionId, (data) => {
          delete data[key];
        });
      },
      list: async (requestedExtensionId: string) => {
        assertOwner(requestedExtensionId);
        await this.updates.get(extensionId);
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
      if (!isRecord(parsed)) {
        throw new Error(`Invalid storage document for '${extensionId}'`);
      }
      return parsed;
    } catch (error) {
      if (isMissingFile(error)) return {};
      throw error;
    }
  }

  private update(
    extensionId: string,
    mutate: (data: Record<string, unknown>) => void,
  ): Promise<void> {
    const previous = this.updates.get(extensionId) ?? Promise.resolve();
    const operation = previous.then(async () => {
      const data = await this.readAll(extensionId);
      mutate(data);
      await writePrivateFile(
        this.filePath(extensionId),
        JSON.stringify(data, null, 2),
      );
    });
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    this.updates.set(extensionId, settled);
    void settled.then(() => {
      if (this.updates.get(extensionId) === settled)
        this.updates.delete(extensionId);
    });
    return operation;
  }
}
